from math import ceil
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.dependencies import require_staff_or_supplier
from db.session import get_db
from models.user import User
from schemas.inventory import InventoryAdjustRequest, InventoryResponse
from schemas.product import PagedResponse
from services import inventory_service

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("", response_model=PagedResponse[InventoryResponse])
def list_inventory(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_staff_or_supplier),
) -> PagedResponse[InventoryResponse]:
    items, total = inventory_service.get_inventory(db, page=page, page_size=page_size)
    return PagedResponse(
        items=[InventoryResponse.from_inventory(inv) for inv in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 0,
    )


@router.get("/low-stock", response_model=List[InventoryResponse])
def low_stock(
    db: Session = Depends(get_db),
    _: User = Depends(require_staff_or_supplier),
) -> List[InventoryResponse]:
    items = inventory_service.get_low_stock(db)
    return [InventoryResponse.from_inventory(inv) for inv in items]


@router.post("/{sku_id}/adjust", response_model=InventoryResponse)
def adjust_inventory(
    sku_id: int,
    payload: InventoryAdjustRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff_or_supplier),
) -> InventoryResponse:
    inv = inventory_service.adjust_inventory(
        db,
        sku_id=sku_id,
        quantity=payload.quantity,
        reason=payload.reason,
        notes=payload.notes,
    )
    return InventoryResponse.from_inventory(inv)
