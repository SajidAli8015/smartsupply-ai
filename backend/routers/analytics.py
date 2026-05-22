from datetime import datetime, timedelta, timezone
from decimal import Decimal
from math import ceil
from typing import List, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from core import cache
from core.dependencies import require_supplier
from db.session import get_db
from models.inventory import Inventory
from models.notification import Notification  # noqa: F401 — ensures model is imported
from models.order import Order, OrderItem, OrderStatus
from models.product import Product, SKU
from models.purchase_order import POLineItem, POStatus, PurchaseOrder
from models.user import User
from schemas.analytics import (
    InventorySummaryItem,
    KPIResponse,
    POPipelineItem,
    SalesDataPoint,
    SlowMoverItem,
    TopProductItem,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])

_REVENUE_STATUSES = [OrderStatus.shipped, OrderStatus.delivered]
_PERIOD_DAYS = {"week": 7, "month": 30, "quarter": 90}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _period_start(period: str):
    now = datetime.now(timezone.utc)
    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "week":
        return now - timedelta(days=7)
    if period == "month":
        return now - timedelta(days=30)
    return None  # "all" — no date filter


def _dec(value) -> Decimal:
    return Decimal(str(value)) if value is not None else Decimal("0")


# ── KPIs ──────────────────────────────────────────────────────────────────────

def _compute_kpis(db: Session, period: str) -> KPIResponse:
    ps = _period_start(period)

    rev_filters = [Order.status.in_(_REVENUE_STATUSES)]
    if ps:
        rev_filters.append(Order.created_at >= ps)

    ord_filters = [Order.created_at >= ps] if ps else []

    # Revenue
    total_revenue = _dec(
        db.query(func.sum(Order.total_amount)).filter(*rev_filters).scalar()
    )

    # Order counts
    total_orders = (
        db.query(func.count(Order.id)).filter(*ord_filters).scalar() or 0
    )
    orders_pending = (
        db.query(func.count(Order.id))
        .filter(Order.status == OrderStatus.pending, *ord_filters)
        .scalar() or 0
    )

    # COGS (uses current SKU cost_price as proxy — cost not stored on OrderItem)
    total_cogs = _dec(
        db.query(func.sum(OrderItem.quantity * SKU.cost_price))
        .join(Order, OrderItem.order_id == Order.id)
        .join(SKU, OrderItem.sku_id == SKU.id)
        .filter(*rev_filters)
        .scalar()
    )

    # Inventory value
    inventory_value = _dec(
        db.query(func.sum(SKU.cost_price * Inventory.quantity_on_hand))
        .join(Inventory, SKU.id == Inventory.sku_id)
        .scalar()
    )

    # Gross margin
    rev_f = float(total_revenue)
    gross_margin_pct = (
        round((rev_f - float(total_cogs)) / rev_f * 100, 2) if rev_f > 0 else 0.0
    )

    # Active POs (not terminal)
    active_pos = (
        db.query(func.count(PurchaseOrder.id))
        .filter(PurchaseOrder.status.notin_([POStatus.received, POStatus.cancelled]))
        .scalar() or 0
    )

    return KPIResponse(
        period=period,
        total_revenue=total_revenue,
        total_orders=total_orders,
        orders_pending=orders_pending,
        inventory_value=inventory_value,
        gross_margin_pct=gross_margin_pct,
        active_pos=active_pos,
    )


@router.get("/kpis", response_model=KPIResponse)
def get_kpis(
    period: Literal["today", "week", "month", "all"] = "month",
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> KPIResponse:
    cache_key = f"smartsupply:kpi:{period}"

    cached = cache.get_cached(cache_key)
    if cached:
        return KPIResponse.model_validate_json(cached)

    result = _compute_kpis(db, period)
    cache.set_cached(cache_key, result.model_dump_json(), ttl=60)
    return result


# ── Sales over time ───────────────────────────────────────────────────────────

@router.get("/sales-over-time", response_model=List[SalesDataPoint])
def sales_over_time(
    period: Literal["week", "month", "quarter"] = "month",
    granularity: Literal["day", "week"] = "day",
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> List[SalesDataPoint]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=_PERIOD_DAYS[period])
    trunc = func.date_trunc(granularity, Order.created_at)

    rows = (
        db.query(
            trunc.label("date"),
            func.sum(Order.total_amount).label("revenue"),
            func.count(Order.id).label("order_count"),
        )
        .filter(
            Order.status.in_(_REVENUE_STATUSES),
            Order.created_at >= cutoff,
        )
        .group_by(trunc)
        .order_by(trunc)
        .all()
    )

    return [
        SalesDataPoint(
            date=row.date.strftime("%Y-%m-%d") if row.date else "",
            revenue=_dec(row.revenue),
            order_count=row.order_count or 0,
        )
        for row in rows
    ]


# ── Top products ──────────────────────────────────────────────────────────────

@router.get("/top-products", response_model=List[TopProductItem])
def top_products(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> List[TopProductItem]:
    rows = (
        db.query(
            Product.id.label("product_id"),
            Product.name.label("name"),
            func.sum(OrderItem.quantity).label("units_sold"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue"),
            func.sum(OrderItem.quantity * SKU.cost_price).label("total_cost"),
        )
        .select_from(SKU)
        .join(Product, SKU.product_id == Product.id)
        .join(OrderItem, SKU.id == OrderItem.sku_id)
        .join(Order, OrderItem.order_id == Order.id)
        .filter(Order.status.in_(_REVENUE_STATUSES))
        .group_by(Product.id, Product.name)
        .order_by(func.sum(OrderItem.quantity * OrderItem.unit_price).desc())
        .limit(limit)
        .all()
    )

    result = []
    for row in rows:
        rev = float(row.revenue or 0)
        cost = float(row.total_cost or 0)
        gm = round((rev - cost) / rev * 100, 2) if rev > 0 else 0.0
        result.append(TopProductItem(
            product_id=row.product_id,
            name=row.name,
            units_sold=row.units_sold or 0,
            revenue=_dec(row.revenue),
            gross_margin=gm,
        ))
    return result


# ── Slow movers ───────────────────────────────────────────────────────────────

@router.get("/slow-movers", response_model=List[SlowMoverItem])
def slow_movers(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> List[SlowMoverItem]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    recent_sales_sub = (
        db.query(
            OrderItem.sku_id.label("sku_id"),
            func.sum(OrderItem.quantity).label("units_sold"),
        )
        .join(Order, OrderItem.order_id == Order.id)
        .filter(
            Order.status.in_(_REVENUE_STATUSES),
            Order.created_at >= cutoff,
        )
        .group_by(OrderItem.sku_id)
        .subquery()
    )

    last_sale_sub = (
        db.query(
            OrderItem.sku_id.label("sku_id"),
            func.max(Order.created_at).label("last_sold_at"),
        )
        .join(Order, OrderItem.order_id == Order.id)
        .filter(Order.status.in_(_REVENUE_STATUSES))
        .group_by(OrderItem.sku_id)
        .subquery()
    )

    rows = (
        db.query(
            SKU.id.label("sku_id"),
            SKU.sku_code,
            Product.name.label("product_name"),
            Inventory.quantity_on_hand.label("current_stock"),
            (Inventory.quantity_on_hand * SKU.cost_price).label("stock_value"),
            last_sale_sub.c.last_sold_at,
            func.coalesce(recent_sales_sub.c.units_sold, 0).label("units_sold"),
        )
        .select_from(SKU)
        .join(Product, SKU.product_id == Product.id)
        .join(Inventory, SKU.id == Inventory.sku_id)
        .outerjoin(recent_sales_sub, SKU.id == recent_sales_sub.c.sku_id)
        .outerjoin(last_sale_sub, SKU.id == last_sale_sub.c.sku_id)
        .filter(func.coalesce(recent_sales_sub.c.units_sold, 0) < 10)
        .order_by(func.coalesce(recent_sales_sub.c.units_sold, 0).asc())
        .limit(100)
        .all()
    )

    return [
        SlowMoverItem(
            sku_id=row.sku_id,
            sku_code=row.sku_code,
            product_name=row.product_name,
            current_stock=row.current_stock,
            stock_value=_dec(row.stock_value),
            last_sold_at=row.last_sold_at,
        )
        for row in rows
    ]


# ── Inventory summary ─────────────────────────────────────────────────────────

@router.get("/inventory-summary", response_model=List[InventorySummaryItem])
def inventory_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> List[InventorySummaryItem]:
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

    daily_sales_sub = (
        db.query(
            OrderItem.sku_id.label("sku_id"),
            (func.sum(OrderItem.quantity) / 30.0).label("avg_daily_sales"),
        )
        .join(Order, OrderItem.order_id == Order.id)
        .filter(
            Order.status.in_(_REVENUE_STATUSES),
            Order.created_at >= thirty_days_ago,
        )
        .group_by(OrderItem.sku_id)
        .subquery()
    )

    rows = (
        db.query(
            SKU.id.label("sku_id"),
            SKU.sku_code,
            Product.name.label("product_name"),
            Inventory.quantity_on_hand,
            Inventory.quantity_reserved,
            (Inventory.quantity_on_hand - Inventory.quantity_reserved).label("available"),
            (Inventory.quantity_on_hand * SKU.cost_price).label("stock_value"),
            daily_sales_sub.c.avg_daily_sales,
        )
        .select_from(SKU)
        .join(Product, SKU.product_id == Product.id)
        .join(Inventory, SKU.id == Inventory.sku_id)
        .outerjoin(daily_sales_sub, SKU.id == daily_sales_sub.c.sku_id)
        .order_by(Inventory.quantity_on_hand.asc())
        .all()
    )

    result = []
    for row in rows:
        avg_daily = float(row.avg_daily_sales) if row.avg_daily_sales else 0.0
        days = round(float(row.quantity_on_hand) / avg_daily, 1) if avg_daily > 0 else None
        result.append(InventorySummaryItem(
            sku_id=row.sku_id,
            sku_code=row.sku_code,
            product_name=row.product_name,
            quantity_on_hand=row.quantity_on_hand,
            quantity_reserved=row.quantity_reserved,
            available=row.available,
            stock_value=_dec(row.stock_value),
            days_of_stock_remaining=days,
        ))
    return result


# ── PO pipeline ───────────────────────────────────────────────────────────────

@router.get("/po-pipeline", response_model=List[POPipelineItem])
def po_pipeline(
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> List[POPipelineItem]:
    rows = (
        db.query(
            PurchaseOrder.status.label("status"),
            func.count(PurchaseOrder.id.distinct()).label("count"),
            func.coalesce(
                func.sum(POLineItem.unit_cost * POLineItem.quantity_ordered), 0
            ).label("total_value"),
        )
        .outerjoin(POLineItem, PurchaseOrder.id == POLineItem.po_id)
        .group_by(PurchaseOrder.status)
        .order_by(PurchaseOrder.status)
        .all()
    )

    return [
        POPipelineItem(
            status=row.status.value,
            count=row.count,
            total_value=_dec(row.total_value),
        )
        for row in rows
    ]
