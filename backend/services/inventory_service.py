from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.inventory import Inventory
from schemas.inventory import AdjustReason


def get_inventory(
    db: Session,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[Inventory], int]:
    total = db.query(func.count(Inventory.id)).scalar()
    items = (
        db.query(Inventory)
        .options(joinedload(Inventory.sku))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_low_stock(db: Session) -> List[Inventory]:
    return (
        db.query(Inventory)
        .options(joinedload(Inventory.sku))
        .filter(Inventory.quantity_on_hand <= Inventory.low_stock_threshold)
        .all()
    )


def adjust_inventory(
    db: Session,
    sku_id: int,
    quantity: int,
    reason: AdjustReason,
    notes: Optional[str] = None,
) -> Inventory:
    inv = (
        db.query(Inventory)
        .filter(Inventory.sku_id == sku_id)
        .first()
    )
    if inv is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SKU inventory not found")

    new_qty = inv.quantity_on_hand + quantity
    if new_qty < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Adjustment would result in negative stock ({new_qty})",
        )
    inv.quantity_on_hand = new_qty
    db.commit()

    return (
        db.query(Inventory)
        .options(joinedload(Inventory.sku))
        .filter(Inventory.sku_id == sku_id)
        .first()
    )
