from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from sentence_transformers.util import semantic_search, dot_score
import torch
import sqlite3
import json
import os
import requests
'''
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

todo variable cost for ratings?
'''

class FindAppArgs(BaseModel):
    input: str
    maxCost: float = 0.001
    appWeights: dict | None = None

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

class FindAppUpdateArgs(BaseModel):
    updates: list[FindAppUpdateItem]

class AppData:
    def __init__(self):
        self.con = sqlite3.connect(':memory:')
        app_data = self.get_app_data()
        cur = self.con.cursor()
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
        self.materialize()
        self.embedder = SentenceTransformer(os.getenv('EMBEDDING_MODEL'))

    def get_app_data(self):
        if os.getenv('NODE_ENV') == 'production':
            url = 'https://magicsandbox.ai/magics'
        else:
            url = 'http://localhost:3001/magics'
        headers = {'Authorization': f'Bearer {os.getenv("MAGICSANDBOX_API_KEY")}'}
        response = requests.get(url, headers=headers, timeout=30)
        return response.json()

    def materialize(self):
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

    def embed(self, sentences):
        #normalize so we can use dot product which is faster than cosine similarity
        return self.embedder.encode(sentences, normalize_embeddings=True, convert_to_tensor=True)
    
    def find_app(self, args: FindAppArgs):
        cur = self.con.cursor()
        if args.appWeights:
            cur.execute('CREATE TEMP TABLE app_weights (id TEXT, weight FLOAT)')
            cur.executemany(
                'INSERT INTO app_weights VALUES (?, ?)',
                [(id, weight) for id, weight in args.appWeights.items()]
            )
        
        if args.appWeights:
            cur.execute('DROP TABLE app_weights')
        self.con.commit()
    
    def update_app(self, args: FindAppUpdateArgs):
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
            ) for item in args.updates
        ])
        self.materialize()

def findApp(args: FindAppArgs):
    pass

def findApp_update(args: FindAppUpdateArgs):
    pass
