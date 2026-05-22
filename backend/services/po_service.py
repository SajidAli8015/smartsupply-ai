from math import ceil
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.inventory import Inventory
from models.notification import Notification
from models.purchase_order import POLineItem, POStatus, PurchaseOrder
from schemas.purchase_order import POReceiveRequest, PurchaseOrderCreate, PurchaseOrderUpdate

# Forward-only status machine; terminal states map to empty sets
_VALID_TRANSITIONS: dict = {
    POStatus.draft:         {POStatus.placed, POStatus.cancelled},
    POStatus.placed:        {POStatus.confirmed, POStatus.cancelled},
    POStatus.confirmed:     {POStatus.in_production, POStatus.cancelled},
    POStatus.in_production: {POStatus.shipped, POStatus.cancelled},
    POStatus.shipped:       {POStatus.received},
    POStatus.received:      set(),
    POStatus.cancelled:     set(),
}


def _load_po(db: Session, po_id: int) -> PurchaseOrder:
    po = (
        db.query(PurchaseOrder)
        .options(
            joinedload(PurchaseOrder.factory),
            joinedload(PurchaseOrder.line_items),
        )
        .filter(PurchaseOrder.id == po_id)
        .first()
    )
    if po is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
    return po


def get_purchase_orders(
    db: Session,
    po_status: Optional[POStatus] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[PurchaseOrder], int]:
    filters = []
    if po_status:
        filters.append(PurchaseOrder.status == po_status)

    total = db.query(func.count(PurchaseOrder.id)).filter(*filters).scalar()
    items = (
        db.query(PurchaseOrder)
        .filter(*filters)
        .options(
            joinedload(PurchaseOrder.factory),
            joinedload(PurchaseOrder.line_items),
        )
        .order_by(PurchaseOrder.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_po_by_id(db: Session, po_id: int) -> PurchaseOrder:
    return _load_po(db, po_id)


def create_po(db: Session, po_data: PurchaseOrderCreate, created_by_id: int) -> PurchaseOrder:
    po = PurchaseOrder(
        factory_id=po_data.factory_id,
        created_by=created_by_id,
        status=POStatus.draft,
        expected_delivery_date=po_data.expected_delivery_date,
        notes=po_data.notes,
    )
    db.add(po)
    db.flush()

    for item in po_data.line_items:
        db.add(POLineItem(
            po_id=po.id,
            sku_id=item.sku_id,
            quantity_ordered=item.quantity_ordered,
            quantity_received=0,
            unit_cost=item.unit_cost,
        ))

    db.commit()
    return _load_po(db, po.id)


def update_po(db: Session, po_id: int, po_data: PurchaseOrderUpdate) -> PurchaseOrder:
    po = _load_po(db, po_id)
    for field, value in po_data.model_dump(exclude_unset=True).items():
        setattr(po, field, value)
    db.commit()
    return _load_po(db, po_id)


def update_po_status(db: Session, po_id: int, new_status: POStatus) -> PurchaseOrder:
    po = _load_po(db, po_id)
    allowed = _VALID_TRANSITIONS[po.status]
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot transition from '{po.status.value}' to '{new_status.value}'. "
                f"Allowed transitions: {[s.value for s in allowed] or 'none (terminal state)'}."
            ),
        )
    po.status = new_status
    db.commit()
    return _load_po(db, po_id)


def receive_po(db: Session, po_id: int, receive_req: POReceiveRequest) -> PurchaseOrder:
    po = _load_po(db, po_id)

    if po.status != POStatus.shipped:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Can only receive a PO in 'shipped' status, current status is '{po.status.value}'.",
        )

    line_items_by_sku = {li.sku_id: li for li in po.line_items}

    for item in receive_req.items:
        li = line_items_by_sku.get(item.sku_id)
        if li is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SKU {item.sku_id} is not a line item of purchase order {po_id}.",
            )
        li.quantity_received = item.quantity_received

        inv = db.query(Inventory).filter(Inventory.sku_id == item.sku_id).first()
        if inv is not None:
            inv.quantity_on_hand += item.quantity_received

    po.status = POStatus.received

    db.add(Notification(
        user_id=po.created_by,
        title="Purchase Order Received",
        message=(
            f"Purchase Order #{po.id} has been received. "
            f"{len(receive_req.items)} SKU(s) updated."
        ),
        type="po_received",
        is_read=False,
    ))

    db.commit()
    return _load_po(db, po_id)
