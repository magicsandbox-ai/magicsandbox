from abc import ABC, abstractmethod
import tiktoken
from vertexai.preview import tokenization

class Tokenizer(ABC):
    def count(self, text: str) -> int:
        return len(self.encode(text))
    @abstractmethod
    def encode(self, text: str) -> list:
        pass
    @abstractmethod
    def decode(self, tokens: list) -> str:
        pass

class TiktokenTokenizer(Tokenizer):
    def __init__(self, model: str):
        self.encoding = tiktoken.encoding_for_model(model)
        self.model = model
    def encode(self, text: str) -> list:
        return self.encoding.encode(text, disallowed_special=())
    def decode(self, tokens: list) -> str:
        return self.encoding.decode(tokens)

class VertexTokenizer(Tokenizer):
    def __init__(self, model: str):
        self.tokenizer = tokenization.get_tokenizer_for_model(model)
        self.model = model
    def encode(self, text: str) -> list:
        return self.tokenizer.compute_tokens(text).tokens_info[0].tokens
    def decode(self, tokens: list) -> str:
        return ''.join([token.decode('utf-8', errors='replace') for token in tokens])

class DefaultTokenizer(Tokenizer):
    def __init__(self):
        self.model = 'default'
    def encode(self, text: str) -> list:
        return list(text.encode('utf-8'))
    def decode(self, tokens: list) -> str:
        return bytes(tokens).decode('utf-8', errors='replace')

