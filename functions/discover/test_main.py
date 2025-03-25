import pytest
import pytest_asyncio
from pydantic import BaseModel
import os
os.environ['EMBEDDING_MODEL'] = 'sentence-transformers/all-mpnet-base-v2'
# need to pass S3_ENDPOINT_BUCKET, GEMINI_API_KEY as env vars
from .main import DiscoverData, DiscoverUpdateItem, DiscoverArgs

'''
npm run pytest -- functions/discover/test_main.py

note: the order of these tests matters (which is probably not a good practice)
'''

@pytest_asyncio.fixture(loop_scope="module", scope="module")
async def discover_data(): #type: ignore
    d_data = DiscoverData([])
    await d_data.startup()
    return d_data

@pytest.mark.asyncio(loop_scope="module")
async def test_insert(discover_data):
    await discover_data.update([DiscoverUpdateItem(
        id='magicsandbox.DiscoverPyTest@0.1.0',
        author='magicsandbox',
        name='DiscoverPyTest',
        version='0.1.0',
        major=0,
        minor=1,
        patch=0,
        kind='app',
        description='This is a test app',
        documentation=None,
        type=None,
        minCost=0.001,
        finalCost=0.001,
        status='active',
        decode=None,
    )])
    assert 'magicsandbox.DiscoverPyTest@0.1.0' in discover_data.embeddings['ids_to_ix']

@pytest.mark.asyncio(loop_scope="module")
async def test_update(discover_data):
    await discover_data.update([DiscoverUpdateItem(
        id='magicsandbox.DiscoverPyTest@0.1.0',
        author='magicsandbox',
        name='DiscoverPyTest',
        version='0.1.0',
        major=0,
        minor=1,
        patch=0,
        kind='app',
        description='This is an updated description',
        documentation=None,
        type=None,
        minCost=0.001,
        finalCost=0.001,
        status='active',
        decode=None,
    )])

@pytest.mark.asyncio(loop_scope="module")
async def test_new_version(discover_data):
    await discover_data.update([DiscoverUpdateItem(
        id='magicsandbox.DiscoverPyTest@0.1.1',
        author='magicsandbox',
        name='DiscoverPyTest',
        version='0.1.1',
        major=0,
        minor=1,
        patch=1,
        kind='app',
        description='This is a new version',
        documentation=None,
        type=None,
        minCost=0.001,
        finalCost=0.001,
        status='active',
        decode=None,
    )])
    assert 'magicsandbox.DiscoverPyTest@0.1.0' in discover_data.embeddings['ids_to_ix']
    assert 'magicsandbox.DiscoverPyTest@0.1.1' in discover_data.embeddings['ids_to_ix']

class DiscoverResult(BaseModel):
    id: str
    description: str
    minCost: float
    relevance: float

    model_config = {
        'extra': 'forbid'  # This makes the validation strict
    }

@pytest.mark.asyncio(loop_scope="module")
async def test_discover(discover_data):
    await discover_data.update([DiscoverUpdateItem(
        id='magicsandbox.Bananas@0.1.0',
        author='magicsandbox',
        name='Bananas',
        version='0.1.0',
        major=0,
        minor=1,
        patch=0,
        kind='app',
        description='This is a description about bananas',
        documentation=None,
        type=None,
        minCost=0.001,
        finalCost=0.001,
        status='active',
        decode=None,
    )])
    args = DiscoverArgs(
        query='bananas',
        includeMetadata=['description', 'minCost'],
    )
    response = await discover_data.discover(args)
    assert isinstance(response, list)
    validated_responses = [DiscoverResult(**d) for d in response]
    assert validated_responses[0].id == 'magicsandbox.Bananas@0.1.0' #description is relevant to query

@pytest.mark.asyncio(loop_scope="module")
async def test_sync(discover_data):
    await discover_data.sync_data() ##persist embeddings
    await discover_data.init_embeddings() ##read embeddings
    assert len(discover_data.embeddings['ids']) > 0
