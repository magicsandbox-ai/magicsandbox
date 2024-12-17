from dotenv import load_dotenv
import os
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from sentence_transformers.util import semantic_search, dot_score
import torch
import semver
import sqlite3
import boto3
import json

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
'''

load_dotenv()

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
    deprecated: bool

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
                deprecated BOOLEAN
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
                item['deprecated']
            ) for item in app_data
        ])
        self.materialize()
        self.embedder = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
    
    def get_app_data(self):
        s3 = boto3.client('s3')
        response = s3.get_object(Bucket=os.getenv('S3_MAGICS_BUCKET_NAME'), Key='magics.json')
        return json.loads(response['Body'].read().decode('utf-8'))

    def materialize(self):
        cur = self.con.cursor()
        cur.execute('DROP TABLE IF EXISTS app_data')
        cur.execute('''
                         CREATE TABLE app_data AS
                         SELECT *
                            , row_number() over (partition by author, name order by major desc, minor desc, patch desc) = 1 as latest
                         FROM _app_data
                         WHERE kind = 'app' 
                            and not deprecated 
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
                description, kind, type, deprecated
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
                deprecated = excluded.deprecated
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
                item.deprecated
            ) for item in args.updates
        ])
        self.materialize()

app_embeddings = embed([d['description'] or d['name'] for d in app_data])

def findApp(args: FindAppArgs):
    #todo use maxCost
    #todo allow appWeights to not specify version
    #todo cross encoder: https://sbert.net/examples/applications/retrieve_rerank/README.html
    #todo approximate nearest neighbors
    input_embedding = embed([args.input])
    weights = torch.ones(len(app_embeddings))
    if args.appWeights:
        for app, weight in args.appWeights.items():
            if app in app_to_ix:
                weights[app_to_ix[app]] = weight
    weights_mask = weights > 0
    mask = latest_mask | weights_mask
    def weighted_score(q: torch.Tensor, c: torch.Tensor):
        masked_weights = weights[mask]
        return dot_score(q, c) * masked_weights
    result = semantic_search(input_embedding, 
                             app_embeddings[mask], 
                             top_k=1, 
                             score_function=weighted_score)
    return ix_to_app[result[0][0]['corpus_id']]

def findApp_update(args: FindAppUpdateArgs):
    global app_embeddings, ix_to_app, app_to_ix, latest, latest_mask
    for update in args.updates: #todo handle batch better
        ix = app_to_ix.get(update.id)
        if ix is None and not valid_app(update):
            continue
        app_embedding = embed([update.description or update.name])
        if ix is None:
            ix = len(ix_to_app)
            ix_to_app.append(update.id)
            app_to_ix[update.id] = ix
            app_embeddings = torch.cat([app_embeddings, app_embedding], dim=0)
            latest_version = latest.get(f'{update.author}.{update.name}', '0.0.0')
            if semver.compare(update.version, latest_version) >= 0:
                latest[f'{update.author}.{update.name}'] = update.version
                latest_mask[app_to_ix[f'{update.author}.{update.name}@{latest_version}']] = False
                latest_mask = torch.cat([latest_mask, torch.tensor([True])], dim=0)
            else:
                latest_mask = torch.cat([latest_mask, torch.tensor([False])], dim=0)
        else:
            if not valid_app(update):
                ix_to_app[ix] = None
                app_to_ix.pop(update.id)
            app_embeddings.index_copy_(0, torch.tensor([ix]), app_embedding)
            #handle not valid_app
