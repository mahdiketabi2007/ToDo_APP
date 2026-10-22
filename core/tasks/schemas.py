from pydantic import BaseModel , Field
from typing import Optional
from datetime import datetime

class TaskBaseSchema(BaseModel):
    title: str = Field(... , max_length=150 , min_length=1 , description="title of the task")
    description: Optional[str] = Field(default="" , max_length=500 ,  description="description of the task")
    is_completed : bool = Field(... , description="status of the task")

class TaskCreateSchema(TaskBaseSchema):
    pass

class TaskUpdateSchema(TaskBaseSchema):
    pass

class TaskResponseSchema(TaskBaseSchema):
    id : int = Field(... , description="unique id of the task")
    created_date : datetime = Field(... , description="creation date and time of the task")
    updated_date: datetime = Field(..., description="updating date and time of the task")