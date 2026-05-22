import enum
from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from db.base import Base

if TYPE_CHECKING:
    from models.notification import Notification
    from models.order import Order
    from models.purchase_order import PurchaseOrder


class UserRole(str, enum.Enum):
    supplier = "supplier"
    staff = "staff"
    buyer = "buyer"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole, name="userrole", values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    orders: Mapped[List["Order"]] = relationship(back_populates="buyer")
    purchase_orders: Mapped[List["PurchaseOrder"]] = relationship(
        back_populates="created_by_user"
    )
    notifications: Mapped[List["Notification"]] = relationship(back_populates="user")

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role.value!r}>"
