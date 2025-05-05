import pytest
import pytest_asyncio
from pydantic import BaseModel
import os
os.environ['EMBEDDING_MODEL'] = 'sentence-transformers/all-mpnet-base-v2'
# need to pass S3_ENDPOINT_BUCKET, GEMINI_API_KEY as env vars
from .main import DiscoverData, DiscoverArgs

'''
npm run pytest -- functions/discover/test_main.py
'''

sample_data = [
    {
        'id': 'magicsandbox.Test@0.1.0',
        'author': 'magicsandbox',
        'name': 'Test',
        'version': '0.1.0',
        'major': 0,
        'minor': 1,
        'patch': 0,
        'kind': 'app',
        'description': 'This is a test app',
        'documentation': None,
        'type': None,
        'minCost': 0.001,
        'status': 'active',
        'decode': None,
        'usage': 10,
    },
    {
        'id': 'magicsandbox.Bananas@0.1.0',
        'author': 'magicsandbox',
        'name': 'Bananas',
        'version': '0.1.0',
        'major': 0,
        'minor': 1,
        'patch': 0,
        'kind': 'app',
        'description': 'This is a description about bananas',
        'documentation': None,
        'type': None,
        'minCost': 0.001,
        'status': 'active',
        'decode': None,
        'usage': 5,
    },
    {
        'id': 'magicsandbox.Test@0.1.1',
        'author': 'magicsandbox',
        'name': 'Test',
        'version': '0.1.1',
        'major': 0,
        'minor': 1,
        'patch': 1,
        'kind': 'app',
        'description': 'This is an updated version of the test app',
        'documentation': None,
        'type': None,
        'minCost': 0.001,
        'status': 'active',
        'decode': None,
        'usage': 0,
    },
]

async def create_discover_data():
    d_data = DiscoverData(sample_data[:2])
    await d_data.startup()
    return d_data

@pytest_asyncio.fixture(loop_scope="module", scope="module")
async def discover_data(): #type: ignore
    return await create_discover_data()

class DiscoverResult(BaseModel):
    id: str
    description: str
    minCost: float
    relevance: float
    usage: int

    model_config = {
        'extra': 'forbid'  # This makes the validation strict
    }

async def assert_discover_works(discover_data):
    args = DiscoverArgs(
        query='bananas',
        includeMetadata=['description', 'minCost', 'usage'],
    )
    response = await discover_data.discover(args)
    assert isinstance(response, list)
    validated_responses = [DiscoverResult(**d) for d in response]
    assert validated_responses[0].id == 'magicsandbox.Bananas@0.1.0' #description is relevant to query

@pytest.mark.asyncio(loop_scope="module")
async def test_discover(discover_data):
    await assert_discover_works(discover_data)

@pytest.mark.asyncio(loop_scope="module")
async def test_popular(discover_data):
    args = DiscoverArgs(
        kind='app',
    )
    response = await discover_data.discover(args)
    assert response[0]['id'] == 'magicsandbox.Test@0.1.0' #highest usage

@pytest.mark.asyncio(loop_scope="module")
async def test_sync(discover_data):
    discover_data.persist_embeddings()
    discover_data.embeddings = None #force init_embeddings to read from s3
    discover_data.test_data = None #force init_embeddings to read from s3
    discover_data.init_embeddings()
    assert len(discover_data.embeddings['ids']) == 2 #test read was successful
    assert sample_data[0]['id'] in discover_data.embeddings['ids']
    assert sample_data[1]['id'] in discover_data.embeddings['ids']
    await discover_data.init_db(sample_data) #provide a new version, as if sync_data was called
    assert len(discover_data.embeddings['ids']) == 2 # should only have embeddings for the latest versions
    assert sample_data[0]['id'] not in discover_data.embeddings['ids']
    assert sample_data[1]['id'] in discover_data.embeddings['ids']
    assert sample_data[2]['id'] in discover_data.embeddings['ids']
    await assert_discover_works(discover_data) #verity discover still works after all that
