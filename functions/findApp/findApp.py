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

'''
create s3 endpoint bucket
embeddings
updated embeddings
persist embeddings - S3, once per hour, .npy file, metadata json separate
requirements:
- vector search is very fast
- updates infrequent, not as important to be fast
- persistent data, but only checkpoints - so could be in memory
- apply filters prior to vector search (latest, cost, valid)
- vector search can account for user provided weights
- sqlite, duckdb, pgvector, chroma, faiss?
careful with case sensitivity
adjust this to enable functions as well

todo variable cost for ratings?
'''

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
    description: str
    kind: str
    type: str
    status: str

class AppData:
    def __init__(self):
        self.con = sqlite3.connect(':memory:')
        self.embedder = SentenceTransformer(os.getenv('EMBEDDING_MODEL'))
        self.s3 = boto3.client('s3')  # Create S3 client once
        self.init_app_data()
        asyncio.create_task(self.schedule_sync_app_data())

    async def schedule_sync_app_data(self):
        while True:
            await asyncio.sleep(3600)
            try:
                await self.sync_app_data()
            except Exception as e:
                traceback.print_exc()

    def init_app_data(self):
        url, headers = self.get_url_and_headers()
        with httpx.Client() as client:
            response = client.get(url, headers=headers, timeout=30.0)
            app_data = response.json()
        self.init_db(app_data)
        self.app_embeddings = self.get_app_embeddings()

    async def sync_app_data(self):
        url, headers = self.get_url_and_headers()
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=30.0)
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
                id TEXT PRIMARY KEY,
                author TEXT,
                name TEXT,
                version TEXT,
                major INTEGER,
                minor INTEGER,
                patch INTEGER,
                description TEXT,
                kind TEXT,
                type TEXT,
                status TEXT
            )
        ''')
        cur.executemany('''
            INSERT INTO _app_data 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', [
            (
                item['id'],
                item['author'],
                item['name'],
                item['version'],
                item['major'],
                item['minor'],
                item['patch'],
                item['description'],
                item['kind'],
                item['type'],
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
              , row_number() over (partition by author, name order by major desc, minor desc, patch desc) = 1 as latest
            FROM _app_data
            WHERE kind = 'app' 
              and status = 'active'
              and type != 'assistant'
                         ''')
        self.con.commit()

    def get_app_embeddings(self):
        response = self.s3.get_object(Bucket=os.getenv('S3_ENDPOINT_BUCKET'), Key='findApp/app_embeddings.msgpack')
        return msgpack.unpackb(response['Body'].read())

    def persist_app_embeddings(self):
        # todo make async?
        self.s3.put_object(Bucket=os.getenv('S3_ENDPOINT_BUCKET'), Key='findApp/app_embeddings.msgpack', Body=msgpack.packb(self.app_embeddings))

    def update_app_data(self, items: list[FindAppUpdateItem]):
        cur = self.con.cursor()
        cur.executemany('''
            INSERT INTO _app_data (
                id, author, name, version, major, minor, patch,
                description, kind, type, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                author = excluded.author,
                name = excluded.name,
                version = excluded.version,
                major = excluded.major,
                minor = excluded.minor,
                patch = excluded.patch,
                description = excluded.description,
                kind = excluded.kind,
                type = excluded.type,
                status = excluded.status
        ''', [
            (
                item.id,
                item.author,
                item.name,
                item.version,
                item.major,
                item.minor,
                item.patch,
                item.description,
                item.kind,
                item.type,
                item.status
            ) for item in items
        ])
        self.materialize_db()
        
    async def find_app(self, args: FindAppArgs):
        # todo translate index after mask, what if app embedding doesn't exist?
        input_embedding = await self.embed_input(args.input)
        valid_apps = self.get_valid_apps(args.maxCost, args.apps)
        valid_mask = torch.tensor([id in valid_apps for id in self.app_embeddings['apps']])
        original_indices = torch.where(valid_mask)[0]
        search_result = semantic_search(input_embedding, 
            self.app_embeddings['embeddings'][valid_mask],
            top_k=10,
            score_function=dot_score)
        apps = []
        for i in search_result[0]:
            apps.append(self.app_embeddings['apps'][original_indices[i]])
        return {
            'inputEmbedding': input_embedding,
            'apps': apps,
            'inputId': str(uuid.uuid4())
        }
    

    async def embed_input(self, input: str):
        descriptions = await self.get_app_descriptions_from_input(input)
        description_embeddings = self.embed(descriptions + [input])
        weights = torch.tensor([0.5, 0.4, 0.3, 0.2])[:len(descriptions)] # todo different weights? or another approach?
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
        # todo case sensitivity, what if apps is empty, what if apps doesn't specify version
        # todo include apps here?
        cur = self.con.cursor()
        cur.execute('''
            SELECT id
            FROM app_data
            WHERE id IN (?)
              OR (latest AND cost <= ?)
        ''', (apps, maxCost))
        return {row[0] for row in cur.fetchall()}

    def rate_app(self, rating: Rating):
        input_embedding = self.get_input_embedding(rating.inputId)
        app_embedding = self.get_app_embedding(rating.app)
        app_embedding_norm = app_embedding.norm()
        rating = min(max(rating.rating, -.1), .5)
        learning_rate = .05
        # todo calculate desired norm separately
        self.set_app_embedding(
            rating.app, 
            app_embedding + learning_rate * rating * input_embedding / app_embedding_norm
            )

    def get_input_embedding(self, inputId: str):
        pass

    def get_app_embedding(self, app: str):
        pass
        
    def set_app_embedding(self, app: str, embedding: torch.Tensor):
        pass


app_data = AppData()

async def findApp(body: FindAppBody):
    if body.args.rating and body.app.startswith('magicsandbox.Assistant'):
        app_data.rate_app(body.args.rating)
    return await app_data.find_app(body.args)

def findApp_update(items: list[FindAppUpdateItem]):
    return app_data.update_app_data(items)
