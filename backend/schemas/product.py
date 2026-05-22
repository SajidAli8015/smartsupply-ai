from decimal import Decimal
from typing import Generic, List, Optional, TypeVar

from pydantic import BaseModel, computed_field

from models.product import ProductType

T = TypeVar("T")


class PagedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class InventoryBrief(BaseModel):
    quantity_on_hand: int
    quantity_reserved: int
    low_stock_threshold: int
    warehouse_location: Optional[str] = None

    @computed_field
    @property
    def available(self) -> int:
        return self.quantity_on_hand - self.quantity_reserved

    model_config = {"from_attributes": True}


class SKUBase(BaseModel):
    sku_code: str
    color: str
    size: str
    sale_price: Decimal
    cost_price: Decimal


class SKUCreate(SKUBase):
    pass


class SKUResponse(SKUBase):
    id: int
    product_id: int
    inventory: Optional[InventoryBrief] = None

    model_config = {"from_attributes": True}


class ProductBase(BaseModel):
    name: str
    type: ProductType
    description: Optional[str] = None
    base_price: Decimal
    cost_price: Decimal
    images: Optional[List[str]] = None


class ProductCreate(ProductBase):
    skus: List[SKUCreate] = []


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ProductType] = None
    description: Optional[str] = None
    base_price: Optional[Decimal] = None
    cost_price: Optional[Decimal] = None
    images: Optional[List[str]] = None


class ProductResponse(ProductBase):
    id: int
    skus: List[SKUResponse] = []

    model_config = {"from_attributes": True}
