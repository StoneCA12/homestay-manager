from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=100)
    role: UserRole = UserRole.RECEPTIONIST


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=8)
