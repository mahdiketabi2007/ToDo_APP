from fastapi import APIRouter , Path , Depends, HTTPException
from fastapi.responses import JSONResponse
from core.tasks.schemas import *
from core.tasks.models import TaskModel
from core.users.models import UserModel
from core.auth.jwt_auth import get_authenticated_user
from core.core.database import get_db
from sqlalchemy.orm import Session
from typing import List

router = APIRouter(tags=["tasks"])

@router.get("/tasks" , response_model=List[TaskResponseSchema])
async def retrieve_tasks_list(db : Session = Depends(get_db) , user : UserModel = Depends(get_authenticated_user)):
    result = db.query(TaskModel).where(user.id == TaskModel.user_id).all()
    return result

@router.get("/tasks/{task_id}" , response_model=TaskResponseSchema)
async def retrieve_task_detail(task_id : int = Path(...,gt = 0) , db : Session = Depends(get_db), user : UserModel = Depends(get_authenticated_user)):
    result = db.query(TaskModel).where(TaskModel.id == task_id , TaskModel.user_id == user.id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Task not found")
    return result

@router.post("/tasks" , response_model=TaskResponseSchema)
async def create_task(request : TaskCreateSchema , db : Session = Depends(get_db) , user : UserModel = Depends(get_authenticated_user)):
    data = request.model_dump()
    data.update({"user_id" : user.id})
    task_obj = TaskModel(**data)
    db.add(task_obj)
    db.commit()
    db.refresh(task_obj)
    return task_obj

@router.put("/tasks/{task_id}" , response_model=TaskResponseSchema)
async def update_tasks(request : TaskUpdateSchema , task_id : int = Path(...,gt = 0) , db : Session = Depends(get_db), user : UserModel = Depends(get_authenticated_user)):
    task_obj = db.query(TaskModel).where(TaskModel.id == task_id , TaskModel.user_id == user.id).first()
    if not task_obj:
        raise HTTPException(status_code=404, detail="Task not found")

    for field,value in request.model_dump().items():
        setattr(task_obj, field, value)

    db.commit()
    db.refresh(task_obj)
    return task_obj

@router.delete("/tasks/{task_id}" , status_code=204)
async def delete_tasks(task_id : int = Path(...,gt = 0), db : Session = Depends(get_db), user : UserModel = Depends(get_authenticated_user)):
    task_obj = db.query(TaskModel).where(TaskModel.id == task_id , TaskModel.user_id == user.id).first()
    if not task_obj:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task_obj)
    db.commit()
