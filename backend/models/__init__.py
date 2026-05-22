# Importing every model here ensures they are all registered with Base.metadata
# before Alembic autogenerate or any SQLAlchemy operation runs.

from models.factory import Factory
from models.inventory import Inventory
from models.notification import Notification
from models.order import Order, OrderItem, OrderStatus
from models.product import Product, ProductType, SKU
from models.purchase_order import POLineItem, POStatus, PurchaseOrder
from models.shipment import Shipment
from models.user import User, UserRole

__all__ = [
    # Users
    "User",
    "UserRole",
    # Products & SKUs
    "Product",
    "ProductType",
    "SKU",
    # Inventory
    "Inventory",
    # Factories
    "Factory",
    # Purchase orders
    "PurchaseOrder",
    "POStatus",
    "POLineItem",
    # Orders
    "Order",
    "OrderStatus",
    "OrderItem",
    # Shipments
    "Shipment",
    # Notifications
    "Notification",
]
