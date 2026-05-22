import enum
from typing import Any, Optional

from pydantic import BaseModel, computed_field


class AdjustReason(str, enum.Enum):
    damage = "damage"
    recount = "recount"
    return_ = "return"
    other = "other"


class InventoryResponse(BaseModel):
    id: int
    sku_id: int
    sku_code: str
    color: str
    size: str
    quantity_on_hand: int
    quantity_reserved: int
    low_stock_threshold: int
    warehouse_location: Optional[str] = None

    @computed_field
    @property
    def available(self) -> int:
        return self.quantity_on_hand - self.quantity_reserved

    model_config = {"from_attributes": True}

    @classmethod
    def from_inventory(cls, inv: Any) -> "InventoryResponse":
        return cls(
            id=inv.id,
            sku_id=inv.sku_id,
            sku_code=inv.sku.sku_code,
            color=inv.sku.color,
            size=inv.sku.size,
            quantity_on_hand=inv.quantity_on_hand,
            quantity_reserved=inv.quantity_reserved,
            low_stock_threshold=inv.low_stock_threshold,
            warehouse_location=inv.warehouse_location,
        )


class InventoryAdjustRequest(BaseModel):
    quantity: int
    reason: AdjustReason
    notes: Optional[str] = None
