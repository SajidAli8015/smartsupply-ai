from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel

from models.purchase_order import POStatus


class FactoryBrief(BaseModel):
    id: int
    name: str
    contact_person: Optional[str] = None

    model_config = {"from_attributes": True}


class POLineItemCreate(BaseModel):
    sku_id: int
    quantity_ordered: int
    unit_cost: Decimal


class POLineItemResponse(BaseModel):
    id: int
    sku_id: int
    quantity_ordered: int
    quantity_received: int
    unit_cost: Decimal

    model_config = {"from_attributes": True}


class PurchaseOrderCreate(BaseModel):
    factory_id: int
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None
    line_items: List[POLineItemCreate] = []


class PurchaseOrderUpdate(BaseModel):
    notes: Optional[str] = None
    expected_delivery_date: Optional[date] = None


class POStatusUpdate(BaseModel):
    status: POStatus


class POReceiveItem(BaseModel):
    sku_id: int
    quantity_received: int


class POReceiveRequest(BaseModel):
    items: List[POReceiveItem]


class PurchaseOrderResponse(BaseModel):
    id: int
    factory_id: int
    factory: FactoryBrief
    created_by: int
    status: POStatus
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime
    line_items: List[POLineItemResponse] = []

    model_config = {"from_attributes": True}
