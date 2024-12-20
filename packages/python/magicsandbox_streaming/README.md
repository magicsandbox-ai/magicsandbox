Streaming utilities for Magic Sandbox

## Usage

See the [Magic Sandbox docs](todo) for details.

```python
from magicsandbox import length_prefix_transform
from fastapi.responses import StreamingResponse
# ...
source = somehow_get_async_iterable() #your async iterable
return StreamingResponse(
  length_prefix_transform(source),
  headers={'x-length-prefix': 'true'}
)
```

## Local Development

```
pip install -e packages/python/magicsandbox_streaming
python
from magicsandbox_streaming import length_prefix_transform
```
