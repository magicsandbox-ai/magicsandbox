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
from .prompts import get_app_descriptions_from_input_prompt
import logging

logger = logging.getLogger(__name__)

'''
adjust this to enable functions as well
ratings
'''

class TestingSkipException(Exception):
    """Raised when skipping operations during testing"""
    pass

class FindAppArgs(BaseModel):
    input: str
    maxCost: float = 0.001

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
    finalCost: float
    status: str

class AppData:
    def __init__(self, init_data = None):
        self.con = sqlite3.connect(':memory:')
        self.embedder = SentenceTransformer(os.getenv('EMBEDDING_MODEL'))
        self.s3 = boto3.client('s3')
        if os.getenv('NODE_ENV') == 'production':
            self.path = 'prod/findApp'
        else:
            self.path = 'dev/findApp'
        self.init_data = init_data # use for testing
        self.init_app_data()

    async def start_background_tasks(self):
        asyncio.create_task(self.background_sync_app_data())

    async def background_sync_app_data(self):
        while True:
            await asyncio.sleep(3600)
            try:
                await self.sync_app_data()
            except Exception:
                logger.exception("Error syncing app data")

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
                finalCost NUMERIC,
                status TEXT
            )
        ''')
        cur.executemany('''
            INSERT INTO _app_data 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                item['finalCost'],
                item['status']
            ) for item in app_data
        ])
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
        new_apps = []
        new_apps_sentences = []
        for app in app_data:
            if app[0] not in self.app_embeddings['apps_to_ix']:
                new_apps.append(app[0])
                new_apps_sentences.append(app[1] or app[2])
        if len(new_apps) == 0:
            return
        new_apps_to_ix = {app: ix + len(self.app_embeddings['apps']) for ix, app in enumerate(new_apps)}
        new_apps_embeddings = self.embed(new_apps_sentences)
        self.app_embeddings = {
            'apps': self.app_embeddings['apps'] + new_apps,
            'apps_to_ix': self.app_embeddings['apps_to_ix'] | new_apps_to_ix,
            'embeddings': torch.cat([self.app_embeddings['embeddings'], new_apps_embeddings])
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
                description, kind, type, minCost, finalCost, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                finalCost = excluded.finalCost,
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
                item.finalCost,
                item.status
            ) for item in items
        ])
        self.materialize_db()
        self.add_app_embeddings([(item.id, item.description, item.name) for item in items])
        
    async def find_app(self, args: FindAppArgs):
        input_embedding = await self.embed_input(args.input)
        valid_apps = self.get_valid_apps(args.maxCost)
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
            app_data = valid_apps[app]
            apps.append({
                'id': app,
                'description': app_data['description'],
                'minCost': app_data['minCost'],
                'finalCost': app_data['finalCost']
            })
        return apps


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

    def get_valid_apps(self, maxCost: float):
        cur = self.con.cursor()
        cur.execute('SELECT id, description, minCost, finalCost FROM app_data WHERE latest AND minCost <= ?', (maxCost,))
        return {row[0]: {'description': row[1], 'minCost': row[2], 'finalCost': row[3]} for row in cur.fetchall()}



async def findApp(app_data: AppData, body: FindAppBody):
    return await app_data.find_app(body.args)

def findApp_update(app_data: AppData, items: list[FindAppUpdateItem]):
    return app_data.update_app_data(items)
