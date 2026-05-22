import enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from db.base import Base

if TYPE_CHECKING:
    from models.product import SKU
    from models.shipment import Shipment
    from models.user import User


class OrderStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    packed = "packed"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"
    returned = "returned"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus, name="orderstatus", values_callable=lambda e: [m.value for m in e]),
        default=OrderStatus.pending,
        nullable=False,
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # {"name": str, "line1": str, "city": str, "state": str, "zip": str, "country": str}
    shipping_address: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    stripe_payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    buyer: Mapped["User"] = relationship(back_populates="orders")
    items: Mapped[List["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan"
    )
    shipments: Mapped[List["Shipment"]] = relationship(back_populates="order")

    def __repr__(self) -> str:
        return (
            f"<Order id={self.id} buyer_id={self.buyer_id} "
            f"status={self.status.value!r} total={self.total_amount}>"
        )


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False)
    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Relationships
    order: Mapped["Order"] = relationship(back_populates="items")
    sku: Mapped["SKU"] = relationship(back_populates="order_items")

    def __repr__(self) -> str:
        return (
            f"<OrderItem id={self.id} order_id={self.order_id} "
            f"sku_id={self.sku_id} qty={self.quantity}>"
        )
