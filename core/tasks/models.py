from core.core.database import Base
from sqlalchemy import Boolean, Column, Integer, String, Text , func , DateTime , ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime


class TaskModel(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True , autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String(150) , nullable=False)
    description = Column(Text, default="")
    is_completed = Column(Boolean, default=False)
    created_date = Column(DateTime,nullable=False,default=datetime.now)
    updated_date = Column(DateTime,nullable=False,default=datetime.now,onupdate=datetime.now)

    user = relationship("UserModel" , back_populates="tasks" , uselist=False)

    def __repr__(self) -> str:
        return f"Task(id={self.id!r}, title={self.title!r}, is_done={self.is_completed!r})"