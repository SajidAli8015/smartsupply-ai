from math import ceil
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from core.dependencies import (
    get_current_user,
    require_buyer,
    require_staff_or_supplier,
)
from db.session import get_db
from models.order import OrderStatus
from models.user import User
from schemas.order import (
    FulfillmentOrderResponse,
    OrderCreate,
    OrderResponse,
    OrderStatusUpdate,
)
from schemas.product import PagedResponse
from services import order_service

orders_router = APIRouter(prefix="/orders", tags=["orders"])
fulfillment_router = APIRouter(prefix="/fulfillment", tags=["fulfillment"])


# ── Orders ────────────────────────────────────────────────────────────────────

@orders_router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_buyer),
) -> OrderResponse:
    return order_service.create_order(db, payload, buyer_id=current_user.id)


@orders_router.get("", response_model=PagedResponse[OrderResponse])
def list_orders(
    order_status: Optional[OrderStatus] = Query(None, alias="status"),
    buyer_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PagedResponse[OrderResponse]:
    items, total = order_service.get_orders(
        db,
        current_user=current_user,
        order_status=order_status,
        buyer_id=buyer_id,
        page=page,
        page_size=page_size,
    )
    return PagedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 0,
    )


@orders_router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrderResponse:
    return order_service.get_order_by_id(db, order_id, current_user)


@orders_router.put("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_staff_or_supplier),
) -> OrderResponse:
    return order_service.update_order_status(
        db,
        order_id=order_id,
        new_status=payload.status,
        tracking_number=payload.tracking_number,
        carrier=payload.carrier,
    )


@orders_router.post("/{order_id}/cancel", response_model=OrderResponse)
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_buyer),
) -> OrderResponse:
    return order_service.cancel_order(db, order_id, current_user)


# ── Fulfillment ───────────────────────────────────────────────────────────────

@fulfillment_router.get("/queue", response_model=List[FulfillmentOrderResponse])
def fulfillment_queue(
    db: Session = Depends(get_db),
    _: User = Depends(require_staff_or_supplier),
) -> List[FulfillmentOrderResponse]:
    return order_service.get_fulfillment_queue(db)
