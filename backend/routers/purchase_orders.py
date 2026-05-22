from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, require_staff_or_supplier, require_supplier
from db.session import get_db
from models.purchase_order import POStatus
from models.user import User
from schemas.product import PagedResponse
from schemas.purchase_order import (
    POReceiveRequest,
    POStatusUpdate,
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    PurchaseOrderUpdate,
)
from services import po_service

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


@router.get("", response_model=PagedResponse[PurchaseOrderResponse])
def list_purchase_orders(
    po_status: Optional[POStatus] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> PagedResponse[PurchaseOrderResponse]:
    items, total = po_service.get_purchase_orders(
        db, po_status=po_status, page=page, page_size=page_size
    )
    return PagedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 0,
    )


@router.post("", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_supplier),
) -> PurchaseOrderResponse:
    return po_service.create_po(db, payload, created_by_id=current_user.id)


@router.get("/{po_id}", response_model=PurchaseOrderResponse)
def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> PurchaseOrderResponse:
    return po_service.get_po_by_id(db, po_id)


@router.put("/{po_id}/status", response_model=PurchaseOrderResponse)
def update_po_status(
    po_id: int,
    payload: POStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> PurchaseOrderResponse:
    return po_service.update_po_status(db, po_id, payload.status)


@router.post("/{po_id}/receive", response_model=PurchaseOrderResponse)
def receive_purchase_order(
    po_id: int,
    payload: POReceiveRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff_or_supplier),
) -> PurchaseOrderResponse:
    return po_service.receive_po(db, po_id, payload)
