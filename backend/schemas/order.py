from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from models.order import OrderStatus


class SKUBrief(BaseModel):
    id: int
    sku_code: str
    color: str
    size: str

    model_config = {"from_attributes": True}


class BuyerBrief(BaseModel):
    id: int
    email: str
    full_name: str

    model_config = {"from_attributes": True}


class ShipmentBrief(BaseModel):
    id: int
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None
    status: Optional[str] = None
    shipped_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class OrderItemCreate(BaseModel):
    sku_id: int
    quantity: int = Field(ge=1)


class OrderItemResponse(BaseModel):
    id: int
    sku_id: int
    sku: SKUBrief
    quantity: int
    unit_price: Decimal

    model_config = {"from_attributes": True}


class OrderCreate(BaseModel):
    items: List[OrderItemCreate] = Field(min_length=1)
    shipping_address: Dict[str, Any]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    tracking_number: Optional[str] = None
    carrier: Optional[str] = None


class OrderResponse(BaseModel):
    id: int
    buyer_id: int
    buyer: BuyerBrief
    status: OrderStatus
    total_amount: Decimal
    shipping_address: Optional[Dict[str, Any]] = None
    stripe_payment_id: Optional[str] = None
    created_at: datetime
    items: List[OrderItemResponse] = []
    shipments: List[ShipmentBrief] = []

    model_config = {"from_attributes": True}


class FulfillmentOrderResponse(BaseModel):
    id: int
    buyer_id: int
    buyer: Optional[BuyerBrief] = None
    status: OrderStatus
    total_amount: Decimal
    shipping_address: Optional[Dict[str, Any]] = None
    created_at: datetime
    items: List[OrderItemResponse] = []
    is_priority: bool = False  # True if older than 24 h; set by service, not ORM

    model_config = {"from_attributes": True}
