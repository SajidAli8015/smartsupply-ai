from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.inventory import Inventory
from models.notification import Notification
from models.order import Order, OrderItem, OrderStatus
from models.product import SKU
from models.shipment import Shipment
from models.user import User, UserRole
from schemas.order import FulfillmentOrderResponse, OrderCreate

_PRIORITY_SECONDS = 24 * 3600


def _load_order(db: Session, order_id: int) -> Order:
    order = (
        db.query(Order)
        .options(
            joinedload(Order.buyer),
            joinedload(Order.items).joinedload(OrderItem.sku),
            joinedload(Order.shipments),
        )
        .filter(Order.id == order_id)
        .first()
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


def create_order(db: Session, order_data: OrderCreate, buyer_id: int) -> Order:
    # ── 1. Availability check (all reads before any writes) ──────────────────
    line_data: list = []
    for item in order_data.items:
        sku = db.get(SKU, item.sku_id)
        if sku is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SKU {item.sku_id} not found",
            )
        inv = db.query(Inventory).filter(Inventory.sku_id == item.sku_id).first()
        if inv is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No inventory record for SKU {item.sku_id}",
            )
        available = inv.quantity_on_hand - inv.quantity_reserved
        if available < item.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Insufficient stock for SKU {sku.sku_code}: "
                    f"available {available}, requested {item.quantity}"
                ),
            )
        line_data.append((item, sku, inv))

    # ── 2. Create order ───────────────────────────────────────────────────────
    total = sum(
        (sku.sale_price * item.quantity for item, sku, _ in line_data),
        Decimal("0"),
    )
    order = Order(
        buyer_id=buyer_id,
        status=OrderStatus.pending,
        total_amount=total,
        shipping_address=order_data.shipping_address,
    )
    db.add(order)
    db.flush()  # get order.id before writing items

    # ── 3. Write items + reserve inventory (single transaction) ──────────────
    for item, sku, inv in line_data:
        db.add(OrderItem(
            order_id=order.id,
            sku_id=item.sku_id,
            quantity=item.quantity,
            unit_price=sku.sale_price,
        ))
        inv.quantity_reserved += item.quantity

    # ── 4. Notify all active suppliers ───────────────────────────────────────
    suppliers = (
        db.query(User)
        .filter(User.role == UserRole.supplier, User.is_active == True)  # noqa: E712
        .all()
    )
    for supplier in suppliers:
        db.add(Notification(
            user_id=supplier.id,
            title="New Order Placed",
            message=(
                f"Order #{order.id} placed for {len(order_data.items)} SKU(s). "
                f"Total: PKR {total:,.2f}."
            ),
            type="new_order",
            is_read=False,
        ))

    db.commit()
    return _load_order(db, order.id)


def get_orders(
    db: Session,
    current_user: User,
    order_status: Optional[OrderStatus] = None,
    buyer_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[Order], int]:
    filters = []
    if current_user.role == UserRole.buyer:
        filters.append(Order.buyer_id == current_user.id)
    elif buyer_id is not None:
        filters.append(Order.buyer_id == buyer_id)
    if order_status is not None:
        filters.append(Order.status == order_status)

    total = db.query(func.count(Order.id)).filter(*filters).scalar()
    items = (
        db.query(Order)
        .filter(*filters)
        .options(
            joinedload(Order.buyer),
            joinedload(Order.items).joinedload(OrderItem.sku),
            joinedload(Order.shipments),
        )
        .order_by(Order.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_order_by_id(db: Session, order_id: int, current_user: User) -> Order:
    order = _load_order(db, order_id)
    if current_user.role == UserRole.buyer and order.buyer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this order",
        )
    return order


def update_order_status(
    db: Session,
    order_id: int,
    new_status: OrderStatus,
    tracking_number: Optional[str] = None,
    carrier: Optional[str] = None,
) -> Order:
    order = _load_order(db, order_id)

    if new_status == OrderStatus.shipped:
        if not tracking_number:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="tracking_number is required when marking an order as shipped",
            )
        db.add(Shipment(
            order_id=order.id,
            tracking_number=tracking_number,
            carrier=carrier,
            status="shipped",
            shipped_at=datetime.now(timezone.utc),
        ))

    elif new_status == OrderStatus.delivered:
        # Release reservation — items have left the warehouse
        for item in order.items:
            inv = db.query(Inventory).filter(Inventory.sku_id == item.sku_id).first()
            if inv:
                inv.quantity_reserved = max(0, inv.quantity_reserved - item.quantity)
        for shipment in order.shipments:
            if shipment.delivered_at is None:
                shipment.delivered_at = datetime.now(timezone.utc)
                shipment.status = "delivered"

    elif new_status == OrderStatus.cancelled:
        _release_reservation(db, order)

    order.status = new_status
    db.commit()
    return _load_order(db, order_id)


def cancel_order(db: Session, order_id: int, current_user: User) -> Order:
    order = _load_order(db, order_id)
    if order.buyer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own orders",
        )
    if order.status not in (OrderStatus.pending, OrderStatus.confirmed):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot cancel an order in '{order.status.value}' status. "
                "Only pending or confirmed orders can be cancelled."
            ),
        )
    _release_reservation(db, order)
    order.status = OrderStatus.cancelled
    db.commit()
    return _load_order(db, order_id)


def get_fulfillment_queue(db: Session) -> List[FulfillmentOrderResponse]:
    orders = (
        db.query(Order)
        .filter(Order.status.in_([OrderStatus.confirmed, OrderStatus.packed]))
        .options(
            joinedload(Order.buyer),
            joinedload(Order.items).joinedload(OrderItem.sku),
        )
        .order_by(Order.created_at.asc())
        .all()
    )
    now = datetime.now(timezone.utc)
    result = []
    for order in orders:
        created_at = order.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        is_priority = (now - created_at).total_seconds() > _PRIORITY_SECONDS
        resp = FulfillmentOrderResponse.model_validate(order)
        result.append(resp.model_copy(update={"is_priority": is_priority}))
    return result


# ── Helpers ───────────────────────────────────────────────────────────────────

def _release_reservation(db: Session, order: Order) -> None:
    for item in order.items:
        inv = db.query(Inventory).filter(Inventory.sku_id == item.sku_id).first()
        if inv:
            inv.quantity_reserved = max(0, inv.quantity_reserved - item.quantity)
