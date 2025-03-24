import pytest
from pydantic import BaseModel
import os
os.environ['EMBEDDING_MODEL'] = 'sentence-transformers/all-mpnet-base-v2'
# need to pass S3_ENDPOINT_BUCKET, GEMINI_API_KEY as env vars
from .main import AppData, FindAppUpdateItem, FindAppArgs

'''
npm run pytest -- functions/findApp/test_main.py

note: the order of these tests matters (which is probably not a good practice)
'''

@pytest.fixture(scope="module")
def app_data(): #type: ignore
    return AppData([])

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
        finalCost=0.001,
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
        minCost=0.002,
        finalCost=0.002,
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
        finalCost=0.001,
        status='active',
    )])
    assert 'magicsandbox.FindAppPyTest@0.1.0' in app_data.app_embeddings['apps_to_ix']

class AppResult(BaseModel):
    id: str
    description: str
    minCost: float
    finalCost: float

@pytest.mark.asyncio(loop_scope="module")
async def test_find(app_data):
    args = FindAppArgs(
        input='help me build a todo list app',
        maxCost=0.001,
        apps=['magicsandbox.FindAppPyTest@0.1.1']
    )
    response = await app_data.find_app(args)
    assert isinstance(response, list)
    validated_responses = [AppResult(**app) for app in response]
    assert not any(app.id == 'magicsandbox.FindAppPyTest@0.1.0' for app in validated_responses) #minCost too high, should not be included
    assert any(app.id == 'magicsandbox.FindAppPyTest@0.1.1' for app in validated_responses)

@pytest.mark.asyncio(loop_scope="module")
async def test_sync(app_data):
    await app_data.sync_app_data() ##persist embeddings
    app_data.init_app_embeddings() ##read embeddings
    assert len(app_data.app_embeddings['apps']) > 0
