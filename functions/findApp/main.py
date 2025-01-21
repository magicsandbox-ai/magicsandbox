from ..body import Body
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from sentence_transformers.util import semantic_search, dot_score
import torch
import sqlite3
import os
import httpx
from litellm import acompletion
import re
import asyncio
import traceback
import boto3
import msgpack
from fastapi import Response
import uuid
import time
from .prompts import get_app_descriptions_from_input_prompt

'''
more sophisticated handling of input_ids - make sure memory doesn't grow too large
adjust this to enable functions as well
variable cost for ratings?

issues with scaling this horizontally:
 - inputId not shared across instances
 - instances will overwrite each other when persisting embeddings / not share updates
'''

class TestingSkipException(Exception):
    """Raised when skipping operations during testing"""
    pass
    
class Rating(BaseModel):
    inputId: str
    app: str
    rating: float

class FindAppArgs(BaseModel):
    input: str
    maxCost: float = 0.001
    apps: list[str] = []
    rating: Rating | None = None

class FindAppBody(Body):
    args: FindAppArgs

class FindAppUpdateItem(BaseModel):
    id: str
    author: str
    name: str
    version: str
    major: int
    minor: int
    patch: int
    kind: str
    description: str | None
    type: str | None
    minCost: float
    status: str

class AppData:
    def __init__(self, init_data):
        self.con = sqlite3.connect(':memory:')
        self.embedder = SentenceTransformer(os.getenv('EMBEDDING_MODEL'))
        self.s3 = boto3.client('s3')
        if os.getenv('NODE_ENV') == 'production':
            self.path = 'prod/findApp'
        else:
            self.path = 'dev/findApp'
        self.input_ids = {}
        self.init_data = init_data # use for testing
        self.init_app_data()
        if self.init_data is None: # skip sync when testing
            asyncio.create_task(self.schedule_sync_app_data())

    async def schedule_sync_app_data(self):
        while True:
            await asyncio.sleep(3600)
            try:
                await self.sync_app_data()
            except Exception as e:
                traceback.print_exc()

    def init_app_data(self):
        if self.init_data is not None: # skip request when testing
            app_data = self.init_data
        else:
            url, headers = self.get_url_and_headers()
            with httpx.Client() as client:
                response = client.get(url, headers=headers, timeout=30.0, follow_redirects=True)
                app_data = response.json()
        self.init_db(app_data)
        self.init_app_embeddings(skip_request=self.init_data is not None)

    async def sync_app_data(self):
        url, headers = self.get_url_and_headers()
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=30.0, follow_redirects=True)
            app_data = response.json()
        self.init_db(app_data)
        self.persist_app_embeddings()
        self.input_ids = {k: v for k, v in self.input_ids.items() if v['ts'] > time.time() - 60 * 60 * 3}

    def get_url_and_headers(self):
        if os.getenv('NODE_ENV') == 'production':
            url = 'https://magicsandbox.ai/magics'
        else:
            if os.getenv('PORT'): # indicates running locally with docker compose
                url = 'http://main:3000/magics?docker=true' # query param used to generate correct redirect url
            else:
                url = 'http://localhost:3000/magics'
        headers = {'Authorization': f'Bearer {os.getenv("MAGICSANDBOX_API_KEY")}'}
        return url, headers

    def init_db(self, app_data):
        cur = self.con.cursor()
        cur.execute('DROP TABLE IF EXISTS _app_data')
        cur.execute('''
            CREATE TABLE _app_data (
                id TEXT COLLATE NOCASE PRIMARY KEY,
                author TEXT,
                name TEXT,
                author_name TEXT COLLATE NOCASE,
                version TEXT,
                major INTEGER,
                minor INTEGER,
                patch INTEGER,
                kind TEXT,
                description TEXT,
                type TEXT,
                minCost NUMERIC,
                status TEXT
            )
        ''')
        cur.executemany('''
            INSERT INTO _app_data 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', [
            (
                item['id'],
                item['author'],
                item['name'],
                item['author'] + '.' + item['name'],
                item['version'],
                item['major'],
                item['minor'],
                item['patch'],
                item['kind'],
                item['description'],
                item['type'],
                item['minCost'],
                item['status']
            ) for item in app_data
        ])
        cur.execute('CREATE INDEX idx_author_name ON _app_data (author_name)')
        self.materialize_db()

    def materialize_db(self):
        cur = self.con.cursor()
        cur.execute('DROP TABLE IF EXISTS app_data')
        cur.execute('''
            CREATE TABLE app_data AS
            SELECT *
                , row_number() over (partition by author_name order by major desc, minor desc, patch desc) = 1 as latest
            FROM _app_data
            WHERE kind = 'app' 
              and status = 'active'
              and COALESCE(type, '') != 'assistant'
        ''')
        self.con.commit()

    def init_app_embeddings(self, skip_request = False):
        try:
            if skip_request:
                raise TestingSkipException()
            response = self.s3.get_object(Bucket=os.getenv('S3_ENDPOINT_BUCKET'), Key=f'{self.path}/app_embeddings.msgpack')
            app_embeddings = msgpack.unpackb(response['Body'].read())
            self.app_embeddings = {
                'apps': app_embeddings['apps'],
                'apps_to_ix': {app: ix for ix, app in enumerate(app_embeddings['apps'])},
                'embeddings': torch.tensor(app_embeddings['embeddings'])
            }
        except (self.s3.exceptions.NoSuchKey, TestingSkipException): #todo remove NoSuchKey
            self.app_embeddings = {
                'apps': [],
                'apps_to_ix': {},
                'embeddings': torch.empty((0, self.embedder.get_sentence_embedding_dimension()))
            }
        cur = self.con.cursor()
        cur.execute('SELECT id, description, name FROM app_data')
        self.add_app_embeddings(cur.fetchall())

    def add_app_embeddings(self, app_data):
        updated_apps = []
        updated_apps_embeddings = []
        new_apps = []
        new_apps_sentences = []
        cur = self.con.cursor()
        cur.execute('SELECT author_name, id FROM app_data')
        latest_apps = {row[0]: row[1] for row in cur.fetchall()}
        for app in app_data:
            if app[0] not in self.app_embeddings['apps_to_ix']:
                latest_app = latest_apps.get(app[0].split('@')[0], None)
                if latest_app:
                    updated_apps.append(app[0])
                    updated_apps_embeddings.append(self.app_embeddings['embeddings'][self.app_embeddings['apps_to_ix'][latest_app]])
                else:
                    new_apps.append(app[0])
                    new_apps_sentences.append(app[1] or app[2])
        if len(updated_apps) + len(new_apps) == 0:
            return
        updated_apps_to_ix = {app: ix + len(self.app_embeddings['apps']) for ix, app in enumerate(updated_apps)}
        new_apps_to_ix = {app: ix + len(self.app_embeddings['apps']) + len(updated_apps) for ix, app in enumerate(new_apps)}
        new_apps_embeddings = self.embed(new_apps_sentences)
        embeddings_to_cat = [self.app_embeddings['embeddings']]
        if len(updated_apps_embeddings) > 0:
            embeddings_to_cat.append(torch.stack(updated_apps_embeddings))
        embeddings_to_cat.append(new_apps_embeddings)
        self.app_embeddings = {
            'apps': self.app_embeddings['apps'] + updated_apps + new_apps,
            'apps_to_ix': self.app_embeddings['apps_to_ix'] | updated_apps_to_ix | new_apps_to_ix,
            'embeddings': torch.cat(embeddings_to_cat)
        }

    def persist_app_embeddings(self):
        # todo make async?
        app_embeddings = {
            'apps': self.app_embeddings['apps'],
            'embeddings': self.app_embeddings['embeddings'].tolist()
        }
        self.s3.put_object(Bucket=os.getenv('S3_ENDPOINT_BUCKET'), Key=f'{self.path}/app_embeddings.msgpack', Body=msgpack.packb(app_embeddings))

    def update_app_data(self, items: list[FindAppUpdateItem]):
        cur = self.con.cursor()
        cur.executemany('''
            INSERT INTO _app_data (
                id, author, name, author_name, version, major, minor, patch,
                description, kind, type, minCost, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                author = excluded.author,
                name = excluded.name,
                author_name = excluded.author_name,
                version = excluded.version,
                major = excluded.major,
                minor = excluded.minor,
                patch = excluded.patch,
                description = excluded.description,
                kind = excluded.kind,
                type = excluded.type,
                minCost = excluded.minCost,
                status = excluded.status
        ''', [
            (
                item.id,
                item.author,
                item.name,
                item.author + '.' + item.name,
                item.version,
                item.major,
                item.minor,
                item.patch,
                item.description,
                item.kind,
                item.type,
                item.minCost,
                item.status
            ) for item in items
        ])
        # add_app_embeddings needs to run prior to materialize_db
        # since a new version is initialized with the embedding of the previous latest version (pulled from app_data)
        self.add_app_embeddings([(item.id, item.description, item.name) for item in items])
        self.materialize_db()
        
    async def find_app(self, args: FindAppArgs):
        input_embedding = await self.embed_input(args.input)
        input_id = str(uuid.uuid4())
        self.input_ids[input_id] = {'embedding': input_embedding, 'ts': time.time()}
        valid_apps = self.get_valid_apps(args.maxCost, args.apps)
        valid_mask = torch.tensor([id in valid_apps for id in self.app_embeddings['apps']])
        original_indices = torch.where(valid_mask)[0]
        search_result = semantic_search(input_embedding, 
            self.app_embeddings['embeddings'][valid_mask],
            top_k=10,
            score_function=dot_score)
        apps = []
        for d in search_result[0]:
            ix = original_indices[d['corpus_id']]
            app = self.app_embeddings['apps'][ix]
            apps.append({
                'app': app,
                'embedding': self.app_embeddings['embeddings'][ix].tolist(),
                'score': d['score'],
                'minCost': valid_apps[app]
            })
        response = {
            'inputEmbedding': input_embedding.tolist(),
            'apps': apps,
            'inputId': input_id
        }
        return Response(content=msgpack.packb(response))

    async def embed_input(self, input: str):
        descriptions = await self.get_app_descriptions_from_input(input)
        description_embeddings = self.embed(descriptions + [input])
        weights = torch.tensor([0.5, 0.4, 0.3, 0.2])[:len(descriptions) + 1] # todo different weights? or another approach?
        combined_embedding = torch.sum(
            description_embeddings * weights.unsqueeze(1),
            dim=0
        )
        return combined_embedding / torch.norm(combined_embedding)

    async def get_app_descriptions_from_input(self, input: str):
        # todo prompt caching?
        prompt = get_app_descriptions_from_input_prompt(input)
        response = await acompletion(
            model='gemini/gemini-1.5-flash-002',
            messages=[{'role': 'user', 'content': prompt}],
            max_completion_tokens=200,
            timeout=60
        )
        content = response['choices'][0]['message']['content']
        descriptions = re.findall(r'"(.+?)"', content)
        return descriptions

    def embed(self, sentences):
        return self.embedder.encode(sentences, normalize_embeddings=True, convert_to_tensor=True)

    def get_valid_apps(self, maxCost: float, apps: list[str]):
        apps = apps[:10] # at most 10 as documented
        cur = self.con.cursor()
        if len(apps) == 1:
            cur.execute('SELECT id, description, name, minCost FROM _app_data WHERE id = :app OR author_name = :app', {'app': apps[0]})
            app_data = cur.fetchall()
        elif len(apps) > 1:
            cur.execute('DROP TABLE IF EXISTS requested_apps')
            cur.execute('CREATE TEMP TABLE requested_apps (app TEXT COLLATE NOCASE)')
            cur.executemany('INSERT INTO requested_apps VALUES (?)', [(app,) for app in apps])
            cur.execute('SELECT id, description, name, minCost FROM _app_data WHERE id IN (SELECT app FROM requested_apps) OR author_name IN (SELECT app FROM requested_apps)')
            app_data = cur.fetchall()
        else:
            app_data = []
        self.add_app_embeddings(app_data)
        cur.execute('SELECT id, minCost FROM app_data WHERE latest AND minCost <= ?', (maxCost,))
        return {row[0]: row[1] for row in cur.fetchall()} | {row[0]: row[3] for row in app_data}

    def rate_app(self, rating: Rating):
        input_embedding = self.input_ids.pop(rating.inputId, None)
        if not input_embedding:
            print(f'inputId {rating.inputId} not found')
            return
        input_embedding = input_embedding['embedding']
        ix = self.app_embeddings['apps_to_ix'].get(rating.app, None)
        if not ix:
            print(f'app {rating.app} not found')
            return
        app_embedding = self.app_embeddings['embeddings'][ix]
        learning_rate = .05
        rating = min(max(rating.rating, -1), 1)
        # norm update should be multiplicative, diminishing updates, and symmetric around 1
        app_embedding_norm = app_embedding.norm()
        update_factor = torch.exp(learning_rate * rating / (1 + torch.abs(app_embedding_norm.log())))
        new_app_embedding_norm = min(max(app_embedding_norm * update_factor, 0.2), 5)
        new_app_embedding = app_embedding + learning_rate * rating * input_embedding
        self.app_embeddings['embeddings'][ix] = new_app_embedding / new_app_embedding.norm() * new_app_embedding_norm

def init_app_data(init_data):
    global app_data
    app_data = AppData(init_data)
    return app_data

async def findApp(body: FindAppBody):
    if body.args.rating and body.app.startswith('magicsandbox.Assistant'):
        app_data.rate_app(body.args.rating)
    return await app_data.find_app(body.args)

def findApp_update(items: list[FindAppUpdateItem]):
    return app_data.update_app_data(items)
