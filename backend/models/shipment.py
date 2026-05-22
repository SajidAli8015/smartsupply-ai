from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

if TYPE_CHECKING:
    from models.order import Order


class Shipment(Base):
    __tablename__ = "shipments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False)
    tracking_number: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    carrier: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    shipped_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    order: Mapped["Order"] = relationship(back_populates="shipments")

    def __repr__(self) -> str:
        return (
            f"<Shipment id={self.id} order_id={self.order_id} "
            f"carrier={self.carrier!r} tracking={self.tracking_number!r}>"
        )
