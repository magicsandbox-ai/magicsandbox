from pydantic import BaseModel

class Options(BaseModel):
    maxCost: float
    stream: bool

class Body(BaseModel):
    fn: str
    options: Options
    app: str | None = None