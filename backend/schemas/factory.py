from typing import Optional

from pydantic import BaseModel, EmailStr


class FactoryCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    lead_time_days: Optional[int] = None
    is_active: bool = True


class FactoryUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    lead_time_days: Optional[int] = None
    is_active: Optional[bool] = None


class FactoryResponse(BaseModel):
    id: int
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    lead_time_days: Optional[int] = None
    is_active: bool

    model_config = {"from_attributes": True}
