from ..body import Body
from pydantic import BaseModel, Field
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
import random
import datetime
from fastapi.concurrency import run_in_threadpool

logger = logging.getLogger("magicsandbox.discover")

class TestingSkipException(Exception):
    """Raised when skipping operations during testing"""
    pass

class Kind(str, Enum):
    APP = "app"
    FUNCTION = "function"

class DiscoverArgs(BaseModel):
    query: str | None = None
    includeMetadata: list[str] = Field(default_factory=lambda: ['id'])
    kind: Kind | None = None
    limit: int = Field(default=10, ge=1, le=100)

class DiscoverBody(Body):
    args: DiscoverArgs

cols = {
    'id': 'TEXT COLLATE NOCASE PRIMARY KEY',
    'author': 'TEXT',
    'name': 'TEXT',
    'version': 'TEXT',
    'major': 'INTEGER',
    'minor': 'INTEGER',
    'patch': 'INTEGER',
    'kind': 'TEXT',
    'description': 'TEXT',
    'documentation': 'TEXT',
    'type': 'TEXT',
    'minCost': 'NUMERIC',
    'finalCost': 'NUMERIC',
    'status': 'TEXT',
    'decode': 'TEXT',
    'usage': 'INTEGER',
}

insert_question_marks = ','.join(['?'] * len(cols))

def get_insert_item(item: dict):
    return [item.get(key) for key in cols]

def get_cols(includeMetadata: list[str]):
    out = ['id']
    for col in includeMetadata:
        if col in cols and col != 'id':
            out.append(col)
    return out

class DiscoverData:
    def __init__(self, test_data = None):
        self.embedder = SentenceTransformer(os.getenv('EMBEDDING_MODEL'))
        self.s3 = boto3.client('s3')
        if os.getenv('NODE_ENV') == 'production':
            self.path = 'prod/discover'
        else:
            self.path = 'dev/discover'
        self.test_data = test_data
        self.embeddings = None

    async def startup(self):
        self.con = await aiosqlite.connect(':memory:')
        await self.init_data()
        asyncio.create_task(self.background_sync_data())

    async def background_sync_data(self):
        while True:
            # add some jitter in case multiple instances start at once
            await asyncio.sleep(random.uniform(3600, 4000))
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

    async def sync_data(self):
        url, headers = self.get_url_and_headers()
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers=headers, timeout=30.0, follow_redirects=True)
            data = response.json()
        await self.init_db(data)
        await run_in_threadpool(self.maybe_persist_embeddings)

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
            await cur.execute(f'''
                CREATE TABLE _data (
                    {', '.join([f'{col} {cols[col]}' for col in cols])}
                )
            ''')
            await cur.executemany(f'''
                INSERT INTO _data 
                VALUES ({insert_question_marks})
            ''', [get_insert_item(item) for item in data])
            await cur.execute('DROP TABLE IF EXISTS data')
            await cur.execute(f'''
                CREATE TABLE data AS
                WITH TBL1 AS (
                SELECT *
                    , row_number() over (partition by author, name order by major desc, minor desc, patch desc) = 1 as latest
                    , sum(usage) over (partition by author, name) as total_usage
                FROM _data
                WHERE status = 'active'
                )
                SELECT {','.join([col for col in cols if col != 'usage'])}
                    , total_usage as usage
                FROM TBL1
                WHERE latest
            ''')
            await cur.execute('DROP TABLE IF EXISTS _data')
            await cur.execute('DROP TABLE IF EXISTS popular')
            await cur.execute(f'''
                CREATE TABLE popular AS
                WITH TBL1 AS (
                SELECT *
                    , row_number() over (partition by kind order by usage desc) as rank
                FROM data
                )
                SELECT {','.join([col for col in cols])}
                FROM TBL1
                WHERE rank <= 100
            ''')
        await self.con.commit()
        await self.update_embeddings()

    async def update_embeddings(self):
        self.init_embeddings()
        async with self.con.cursor() as cur:
            await cur.execute('SELECT id, description, name FROM data')
            data = await cur.fetchall()
        existing_ids = []
        existing_ixs = []
        new_ids = []
        new_sentences = []
        for id, description, name in data:
            if id in self.embeddings['ids_to_ix']:
                existing_ids.append(id)
                existing_ixs.append(self.embeddings['ids_to_ix'][id])
            else:
                new_ids.append(id)
                new_sentences.append(description or name)  
        dim = self.embedder.get_sentence_embedding_dimension()
        if existing_ixs:
            existing_embeddings = self.embeddings['embeddings'][existing_ixs]
        else:
            existing_embeddings = torch.empty((0, dim))
        if new_sentences:
            new_embeddings = self.embed(new_sentences)
        else:
            new_embeddings = torch.empty((0, dim))
        ids = existing_ids + new_ids
        self.embeddings = {
            'ids': ids,
            'ids_to_ix': {id: ix for ix, id in enumerate(ids)},
            'embeddings': torch.cat([existing_embeddings, new_embeddings])
        }

    def init_embeddings(self):
        if self.embeddings is not None:
            return
        try:
            if self.test_data is not None:
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

    def maybe_persist_embeddings(self):
        try:
            response = self.s3.head_object(Bucket=os.getenv('S3_ENDPOINT_BUCKET'), Key=f'{self.path}/embeddings.msgpack')
            last_modified = response['LastModified']
            age_in_seconds = (datetime.datetime.now(datetime.timezone.utc) - last_modified).total_seconds()
            if age_in_seconds < 3600:
                return # don't persist embeddings if they are less than 1 hour old
        except self.s3.exceptions.NoSuchKey:
            pass
        self.persist_embeddings()
    
    def persist_embeddings(self):
        embeddings = {
            'ids': self.embeddings['ids'],
            'embeddings': self.embeddings['embeddings'].tolist()
        }
        self.s3.put_object(Bucket=os.getenv('S3_ENDPOINT_BUCKET'), Key=f'{self.path}/embeddings.msgpack', Body=msgpack.packb(embeddings))

    async def discover(self, args: DiscoverArgs):
        if args.query is None:
            return await self.get_popular(args)
        query_embedding = self.embed(args.query)
        valid_data = await self.get_valid_data(args)
        valid_mask = torch.tensor([id in valid_data for id in self.embeddings['ids']])
        original_indices = torch.where(valid_mask)[0]
        search_result = semantic_search(query_embedding, 
            self.embeddings['embeddings'][valid_mask],
            top_k=100,
            score_function=dot_score)
        out = []
        for d in search_result[0][:args.limit]:
            ix = original_indices[d['corpus_id']]
            id = self.embeddings['ids'][ix]
            result = valid_data[id]
            result['relevance'] = (d['score'] + 1) / 2  
            out.append(result)
        return out

    def embed(self, sentences):
        return self.embedder.encode(sentences, normalize_embeddings=True, convert_to_tensor=True)

    async def get_valid_data(self, args: DiscoverArgs):
        cols = get_cols(args.includeMetadata)
        filter_params = []
        filter_sql = ''
        if args.kind is not None: # todo could probably optimize this
            filter_sql = 'AND kind = ?'
            filter_params.append(args.kind)
        async with self.con.cursor() as cur:
            await cur.execute(f'''
                SELECT {', '.join(cols)} 
                FROM data
                {filter_sql}
                ''', filter_params)
            return {row[0]: {col: row[i] for i, col in enumerate(cols)} for row in await cur.fetchall()}

    async def get_popular(self, args: DiscoverArgs):
        # todo cleanup duplicated code
        cols = get_cols(args.includeMetadata)
        filter_params = []
        filter_sql = ''
        if args.kind is not None: # todo could probably optimize this
            filter_sql = 'AND kind = ?'
            filter_params.append(args.kind)
        async with self.con.cursor() as cur:
            await cur.execute(f'''
                SELECT {', '.join(cols)} 
                FROM popular
                {filter_sql}
                ORDER BY usage DESC
                LIMIT ?
                ''', filter_params + [args.limit])
            return [{col: row[i] for i, col in enumerate(cols)} for row in await cur.fetchall()]

async def discover(discover_data: DiscoverData, body: DiscoverBody):
    return await discover_data.discover(body.args)
