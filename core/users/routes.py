from fastapi import APIRouter , Path , Depends, HTTPException
from fastapi.responses import JSONResponse
from core.users.schemas import *
from core.users.models import UserModel
from core.core.database import get_db
from sqlalchemy.orm import Session
from typing import List
from core.auth.jwt_auth import generate_access_token , generate_refresh_token , decode_refresh_token
router = APIRouter(tags=["users"] , prefix="/users")

@router.post("/login")
async def user_login(request : UserLoginSchema , db : Session = Depends(get_db)):
    user_obj = db.query(UserModel).filter(UserModel.username == request.username).first()
    if not user_obj:
        raise HTTPException(status_code=400, detail="User does not exist")
    if not user_obj.verify_password(request.password):
        raise HTTPException(status_code=400, detail="Incorrect password")

    access_token = generate_access_token(user_obj.id)
    refresh_token = generate_refresh_token(user_obj.id)

    return JSONResponse(content={"detail" : "logged in successfully" ,"access_token": access_token, "refresh_token": refresh_token})



@router.post("/register")
async def user_register(request : UserRegisterSchema , db : Session = Depends(get_db)):
    if db.query(UserModel).filter(UserModel.username == request.username ).first() :
        raise HTTPException(status_code=400, detail="Username already exists")
    user_obj = UserModel(username=request.username)
    user_obj.set_password(request.password)
    db.add(user_obj)
    db.commit()
    return JSONResponse(content="user registered successfully", status_code=201)

@router.post("/refresh-token")
async def user_refresh_token(request : UserRefreshTokenSchema  , db : Session = Depends(get_db)):
    user_id = decode_refresh_token(request.token , db)
    access_token = generate_access_token(user_id)
    return JSONResponse(content={"access_token":access_token})