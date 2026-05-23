from fastapi import APIRouter, HTTPException
from app.core.database import database
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.auth_schema import RegisterRequest, LoginRequest

router = APIRouter()


@router.post("/auth/register")
async def register(data: RegisterRequest):
    check_query = "SELECT id FROM users WHERE email = :email"
    existing_user = await database.fetch_one(
        query=check_query,
        values={"email": data.email}
    )

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already exists")

    insert_query = """
    INSERT INTO users(full_name, email, password_hash)
    VALUES (:full_name, :email, :password_hash)
    """

    await database.execute(
        query=insert_query,
        values={
            "full_name": data.full_name,
            "email": data.email,
            "password_hash": hash_password(data.password)
        }
    )

    return {"message": "Register successfully"}


@router.post("/auth/login")
async def login(data: LoginRequest):
    query = """
    SELECT id::text as id, full_name, email, password_hash, role
    FROM users
    WHERE email = :email
    """

    user = await database.fetch_one(
        query=query,
        values={"email": data.email}
    )

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"]
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"]
        }
    }