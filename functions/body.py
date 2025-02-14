from pydantic import BaseModel

class Options(BaseModel):
    maxCost: float
    stream: bool

class UserInfo(BaseModel):
    userId: str | None = None

class Body(BaseModel):
    id: str
    options: Options
    userInfo: UserInfo | None = None
    app: str | None = None