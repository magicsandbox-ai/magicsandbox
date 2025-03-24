from ..body import Body
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from sentence_transformers.util import semantic_search, dot_score
import torch
import aiosqlite
import os
import httpx
import asyncio
import boto3
import msgpack
import logging
from enum import Enum

logger = logging.getLogger("magicsandbox.discover")

class TestingSkipException(Exception):
    """Raised when skipping operations during testing"""
    pass

class Kind(str, Enum):
    APP = "app"
    FUNCTION = "function"

class DiscoverArgs(BaseModel):
    query: str
    includeMetadata: list[str]
    kind: Kind | None

class DiscoverBody(Body):
    args: DiscoverArgs

class DiscoverUpdateItem(BaseModel):
    id: str
    author: str
    name: str
    version: str
    major: int
    minor: int
    patch: int
    kind: Kind
    description: str | None
    documentation: str | None
    type: str | None
    minCost: float
    finalCost: float
    status: str
    decode: str

insert_question_marks = ','.join(['?'] * len(DiscoverUpdateItem.model_fields))

def get_insert_item(item: DiscoverUpdateItem):
    return [getattr(item, key) for key in DiscoverUpdateItem.model_fields]

def get_cols(includeMetadata: list[str]):
    cols = ['id']
    for col in includeMetadata:
        if col in DiscoverUpdateItem.model_fields and col != 'id':
            cols.append(col)
    return cols

class DiscoverData:
    def __init__(self, test_data = None):
        self.embedder = SentenceTransformer(os.getenv('EMBEDDING_MODEL'))
        self.s3 = boto3.client('s3')
        if os.getenv('NODE_ENV') == 'production':
            self.path = 'prod/discover'
        else:
            self.path = 'dev/discover'
        self.test_data = test_data

    async def startup(self):
        self.con = await aiosqlite.connect(':memory:')
        await self.init_data()
        asyncio.create_task(self.background_sync_data())

    async def background_sync_data(self):
        while True:
            await asyncio.sleep(3600)
            try:
                await self.sync_data()
            except Exception:
                logger.exception("Error syncing data")

    async def init_data(self):
        if self.test_data is not None: # skip request when testing
            data = self.test_data
        else:
            url, headers = self.get_url_and_headers()
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=30.0, follow_redirects=True)
                data = response.json()
        await self.init_db(data)
        await self.init_embeddings(skip_request=self.test_data is not None)

    async def sync_data(self):
        url, headers = self.get_url_and_headers()
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=30.0, follow_redirects=True)
            data = response.json()
        await self.init_db(data)
        self.persist_embeddings()

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

    async def init_db(self, data):
        async with self.con.cursor() as cur:
            await cur.execute('DROP TABLE IF EXISTS _data')
            await cur.execute('''
                CREATE TABLE _data (
                    id TEXT COLLATE NOCASE PRIMARY KEY,
                    author TEXT,
                    name TEXT,
                    version TEXT,
                    major INTEGER,
                    minor INTEGER,
                    patch INTEGER,
                    kind TEXT,
                    description TEXT,
                    documentation TEXT,
                    type TEXT,
                    minCost NUMERIC,
                    finalCost NUMERIC,
                    status TEXT,
                    decode TEXT
                )
            ''')
            await cur.executemany(f'''
                INSERT INTO _data 
                VALUES ({insert_question_marks})
            ''', [get_insert_item(item) for item in data])
        await self.materialize_db()

    async def materialize_db(self):
        async with self.con.cursor() as cur:
            await cur.execute('DROP TABLE IF EXISTS data')
            await cur.execute('''
                CREATE TABLE data AS
                SELECT *
                    , row_number() over (partition by author, name order by major desc, minor desc, patch desc) = 1 as latest
                FROM _data
                WHERE status = 'active'
            ''')
        await self.con.commit()

    async def init_embeddings(self, skip_request = False):
        try:
            if skip_request:
                raise TestingSkipException()
            response = self.s3.get_object(Bucket=os.getenv('S3_ENDPOINT_BUCKET'), Key=f'{self.path}/embeddings.msgpack')
            embeddings = msgpack.unpackb(response['Body'].read())
            self.embeddings = {
                'ids': embeddings['ids'],
                'ids_to_ix': {id: ix for ix, id in enumerate(embeddings['ids'])},
                'embeddings': torch.tensor(embeddings['embeddings'])
            }
        except (self.s3.exceptions.NoSuchKey, TestingSkipException): #todo remove NoSuchKey
            self.embeddings = {
                'ids': [],
                'ids_to_ix': {},
                'embeddings': torch.empty((0, self.embedder.get_sentence_embedding_dimension()))
            }
        async with self.con.cursor() as cur:
            await cur.execute('SELECT id, description, name FROM data')
            self.add_embeddings(await cur.fetchall())

    def add_embeddings(self, data):
        new_ids = []
        new_sentences = []
        for d in data:
            if d[0] not in self.embeddings['ids_to_ix']:
                new_ids.append(d[0])
                new_sentences.append(d[1] or d[2])
        if len(new_ids) == 0:
            return
        new_ids_to_ix = {id: ix + len(self.embeddings['ids']) for ix, id in enumerate(new_ids)}
        new_embeddings = self.embed(new_sentences)
        self.embeddings = {
            'ids': self.embeddings['ids'] + new_ids,
            'ids_to_ix': self.embeddings['ids_to_ix'] | new_ids_to_ix,
            'embeddings': torch.cat([self.embeddings['embeddings'], new_embeddings])
        }

    def persist_embeddings(self):
        # todo make async?
        embeddings = {
            'ids': self.embeddings['ids'],
            'embeddings': self.embeddings['embeddings'].tolist()
        }
        self.s3.put_object(Bucket=os.getenv('S3_ENDPOINT_BUCKET'), Key=f'{self.path}/embeddings.msgpack', Body=msgpack.packb(embeddings))
        
    async def discover(self, args: DiscoverArgs):
        query_embedding = self.embed(args.query)
        valid_data = await self.get_valid_data(args)
        valid_mask = torch.tensor([id in valid_data for id in self.embeddings['ids']])
        original_indices = torch.where(valid_mask)[0]
        search_result = semantic_search(query_embedding, 
            self.embeddings['embeddings'][valid_mask],
            top_k=100,
            score_function=dot_score)
        out = []
        for d in search_result[0]:
            ix = original_indices[d['corpus_id']]
            id = self.embeddings['ids'][ix]
            out.append(valid_data[id])
        return out

    def embed(self, sentences):
        return self.embedder.encode(sentences, normalize_embeddings=True, convert_to_tensor=True)

    async def get_valid_data(self, args: DiscoverArgs):
        cols = get_cols(args.includeMetadata)
        filter = '' if args.kind is None else f'AND kind = "{args.kind}"'
        async with self.con.cursor() as cur:
            await cur.execute(f'''
                SELECT {', '.join(cols)} 
                FROM data 
                WHERE latest
                {filter}
                ''')
            return {row[0]: {col: row[i] for i, col in enumerate(cols)} for row in await cur.fetchall()}

    async def update(self, items: list[DiscoverUpdateItem]):
        async with self.con.cursor() as cur:
            await cur.executemany(f'''
                INSERT INTO _data (
                    id, author, name, version, major, minor, patch, kind
                    description, documentation, type, minCost, finalCost, status, decode
                ) VALUES ({insert_question_marks})
                ON CONFLICT(id) DO UPDATE SET
                    author = excluded.author,
                    name = excluded.name,
                    version = excluded.version,
                    major = excluded.major,
                    minor = excluded.minor,
                    patch = excluded.patch,
                    kind = excluded.kind,
                    description = excluded.description,
                    documentation = excluded.documentation,
                    type = excluded.type,
                    minCost = excluded.minCost,
                    finalCost = excluded.finalCost,
                    status = excluded.status,
                    decode = excluded.decode
                )
            ''', [get_insert_item(item) for item in items])
        await self.materialize_db()
        self.add_embeddings([(item.id, item.description, item.name) for item in items])


async def discover(discover_data: DiscoverData, body: DiscoverBody):
    return await discover_data.discover(body.args)

async def discover_update(discover_data: DiscoverData, items: list[DiscoverUpdateItem]):
    return await discover_data.update(items)
