import enum
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from db.base import Base

if TYPE_CHECKING:
    from models.inventory import Inventory
    from models.order import OrderItem
    from models.purchase_order import POLineItem


class ProductType(str, enum.Enum):
    shirt = "shirt"
    jeans = "jeans"


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[ProductType] = mapped_column(
        SAEnum(ProductType, name="producttype", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # JSON array of S3 object keys, e.g. ["uploads/shirt-front.jpg", ...]
    images: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    skus: Mapped[List["SKU"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Product id={self.id} name={self.name!r} type={self.type.value!r}>"


class SKU(Base):
    __tablename__ = "skus"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    color: Mapped[str] = mapped_column(String(100), nullable=False)
    size: Mapped[str] = mapped_column(String(50), nullable=False)
    sku_code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    sale_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Relationships
    product: Mapped["Product"] = relationship(back_populates="skus")
    inventory: Mapped[Optional["Inventory"]] = relationship(
        back_populates="sku", uselist=False
    )
    po_line_items: Mapped[List["POLineItem"]] = relationship(back_populates="sku")
    order_items: Mapped[List["OrderItem"]] = relationship(back_populates="sku")

    def __repr__(self) -> str:
        return (
            f"<SKU id={self.id} code={self.sku_code!r} "
            f"color={self.color!r} size={self.size!r}>"
        )
