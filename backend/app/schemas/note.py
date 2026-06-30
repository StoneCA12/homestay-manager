from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import NoteCategory, NoteEntityType


class NoteOut(BaseModel):
    id: int
    entity_type: NoteEntityType
    entity_id: int
    category: NoteCategory
    content: str
    author_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class NoteCreate(BaseModel):
    entity_type: NoteEntityType
    entity_id: int
    category: NoteCategory
    content: str = Field(min_length=1, max_length=2000)
