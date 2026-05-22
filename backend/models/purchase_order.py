import enum
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Date, DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from db.base import Base

if TYPE_CHECKING:
    from models.factory import Factory
    from models.product import SKU
    from models.user import User


class POStatus(str, enum.Enum):
    draft = "draft"
    placed = "placed"
    confirmed = "confirmed"
    in_production = "in_production"
    shipped = "shipped"
    received = "received"
    cancelled = "cancelled"


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    factory_id: Mapped[int] = mapped_column(ForeignKey("factories.id"), nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[POStatus] = mapped_column(
        SAEnum(POStatus, name="postatus", values_callable=lambda e: [m.value for m in e]),
        default=POStatus.draft,
        nullable=False,
    )
    expected_delivery_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    factory: Mapped["Factory"] = relationship(back_populates="purchase_orders")
    created_by_user: Mapped["User"] = relationship(back_populates="purchase_orders")
    line_items: Mapped[List["POLineItem"]] = relationship(
        back_populates="purchase_order", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<PurchaseOrder id={self.id} status={self.status.value!r} "
            f"factory_id={self.factory_id}>"
        )


class POLineItem(Base):
    __tablename__ = "po_line_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    po_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"), nullable=False)
    quantity_ordered: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Relationships
    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="line_items")
    sku: Mapped["SKU"] = relationship(back_populates="po_line_items")

    def __repr__(self) -> str:
        return (
            f"<POLineItem id={self.id} po_id={self.po_id} "
            f"sku_id={self.sku_id} qty_ordered={self.quantity_ordered}>"
        )
