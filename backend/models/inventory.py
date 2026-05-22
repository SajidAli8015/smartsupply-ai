from typing import TYPE_CHECKING, Optional

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

if TYPE_CHECKING:
    from models.product import SKU


class Inventory(Base):
    __tablename__ = "inventory"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # One-to-one with SKU
    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"), unique=True, nullable=False)
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    low_stock_threshold: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    warehouse_location: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    sku: Mapped["SKU"] = relationship(back_populates="inventory")

    @property
    def quantity_available(self) -> int:
        """Units that can still be reserved/sold."""
        return self.quantity_on_hand - self.quantity_reserved

    def __repr__(self) -> str:
        return (
            f"<Inventory id={self.id} sku_id={self.sku_id} "
            f"on_hand={self.quantity_on_hand} reserved={self.quantity_reserved}>"
        )
