from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class KPIResponse(BaseModel):
    period: str
    total_revenue: Decimal
    total_orders: int
    orders_pending: int
    inventory_value: Decimal
    gross_margin_pct: float
    active_pos: int


class SalesDataPoint(BaseModel):
    date: str
    revenue: Decimal
    order_count: int


class TopProductItem(BaseModel):
    product_id: int
    name: str
    units_sold: int
    revenue: Decimal
    gross_margin: float


class SlowMoverItem(BaseModel):
    sku_id: int
    sku_code: str
    product_name: str
    current_stock: int
    stock_value: Decimal
    last_sold_at: Optional[datetime] = None


class InventorySummaryItem(BaseModel):
    sku_id: int
    sku_code: str
    product_name: str
    quantity_on_hand: int
    quantity_reserved: int
    available: int
    stock_value: Decimal
    days_of_stock_remaining: Optional[float] = None


class POPipelineItem(BaseModel):
    status: str
    count: int
    total_value: Decimal
