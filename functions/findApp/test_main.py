import pytest
import torch
from pydantic import BaseModel
from fastapi import Response
import msgpack
import os
os.environ['EMBEDDING_MODEL'] = 'sentence-transformers/all-mpnet-base-v2'
# need to pass S3_ENDPOINT_BUCKET, GEMINI_API_KEY as env vars
from .main import init_app_data, FindAppUpdateItem, FindAppArgs, Rating

'''
note: the order of these tests matters (which is probably not a good practice)
test maxCost
'''

@pytest.fixture(scope="module")
def app_data(): #type: ignore
    return init_app_data([])

def test_insert(app_data):
    app_data.update_app_data([FindAppUpdateItem(
        id='magicsandbox.FindAppPyTest@0.1.0',
        author='magicsandbox',
        name='FindAppPyTest',
        version='0.1.0',
        major=0,
        minor=1,
        patch=0,
        description='This is a test app',
        kind='app',
        type=None,
        minCost=0.001,
        status='active',
    )])
    assert 'magicsandbox.FindAppPyTest@0.1.0' in app_data.app_embeddings['apps_to_ix']

def test_update(app_data):
    app_data.update_app_data([FindAppUpdateItem(
        id='magicsandbox.FindAppPyTest@0.1.0',
        author='magicsandbox',
        name='FindAppPyTest',
        version='0.1.0',
        major=0,
        minor=1,
        patch=0,
        description='This is an updated description',
        kind='app',
        type=None,
        minCost=0.001,
        status='active',
    )])

def test_new_version(app_data):
    app_data.update_app_data([FindAppUpdateItem(
        id='magicsandbox.FindAppPyTest@0.1.1',
        author='magicsandbox',
        name='FindAppPyTest',
        version='0.1.1',
        major=0,
        minor=1,
        patch=1,
        description='This is a new version',
        kind='app',
        type=None,
        minCost=0.001,
        status='active',
    )])
    old_embedding = app_data.app_embeddings['embeddings'][app_data.app_embeddings['apps_to_ix']['magicsandbox.FindAppPyTest@0.1.0']]
    new_embedding = app_data.app_embeddings['embeddings'][app_data.app_embeddings['apps_to_ix']['magicsandbox.FindAppPyTest@0.1.1']]
    assert torch.allclose(old_embedding, new_embedding)

class AppResult(BaseModel):
    app: str
    embedding: list[float]
    score: float
    minCost: float

class FindAppResponse(BaseModel):
    inputEmbedding: list[float]
    apps: list[AppResult]
    inputId: str

@pytest.mark.asyncio(loop_scope="module")
async def test_find(app_data):
    args = FindAppArgs(
        input='help me build a todo list app',
        maxCost=0.001,
        apps=['magicsandbox.FindAppPyTest@0.1.1']
    )
    response = await app_data.find_app(args)
    assert isinstance(response, Response)
    result = msgpack.unpackb(response.body)
    validated_response = FindAppResponse(**result)
    assert len(validated_response.inputEmbedding) > 0
    assert any(app.app == 'magicsandbox.FindAppPyTest@0.1.1' for app in validated_response.apps)

@pytest.mark.asyncio(loop_scope="module")
async def test_rating(app_data):
    # first search to get an inputId
    args = FindAppArgs(
        input='help me build a todo list app',
    )
    response = await app_data.find_app(args)
    result = msgpack.unpackb(response.body)
    input_id = result['inputId']
    app = result['apps'][0]['app']
    old_embedding = app_data.app_embeddings['embeddings'][app_data.app_embeddings['apps_to_ix'][app]].clone()
    app_data.rate_app(Rating(
        inputId=input_id,
        app=app,
        rating=1.0
    ))
    assert input_id not in app_data.input_ids
    new_embedding = app_data.app_embeddings['embeddings'][app_data.app_embeddings['apps_to_ix'][app]]
    assert new_embedding.norm() > old_embedding.norm()
    # could test that new embedding is closer to input embedding

@pytest.mark.asyncio(loop_scope="module")
async def test_sync(app_data):
    await app_data.sync_app_data()
    app_data.init_app_embeddings()
    assert len(app_data.app_embeddings['apps']) > 0
