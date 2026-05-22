from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base

if TYPE_CHECKING:
    from models.purchase_order import PurchaseOrder


class Factory(Base):
    __tablename__ = "factories"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_person: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    lead_time_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    purchase_orders: Mapped[List["PurchaseOrder"]] = relationship(back_populates="factory")

    def __repr__(self) -> str:
        return f"<Factory id={self.id} name={self.name!r} active={self.is_active}>"
