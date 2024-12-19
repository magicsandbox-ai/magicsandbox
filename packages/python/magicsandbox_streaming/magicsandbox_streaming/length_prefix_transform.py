async def length_prefix_transform(stream, final_object=False):
    prev_chunk = None
    
    async for chunk in stream:
        if isinstance(chunk, str):
            chunk = chunk.encode('utf-8')
        if not isinstance(chunk, bytes):
            raise ValueError(f"Unexpected chunk type: {type(chunk)}")
        if prev_chunk is not None:
            yield length_prefix(prev_chunk) + prev_chunk 
        prev_chunk = chunk
    
    if prev_chunk is not None:
        if final_object:
            end_marker = b'\xff\xff\xff\xff'
        else:
            end_marker = length_prefix(prev_chunk)
        yield end_marker + prev_chunk

def length_prefix(chunk):
    return len(chunk).to_bytes(4, byteorder='big')
