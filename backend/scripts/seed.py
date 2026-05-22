#!/usr/bin/env python
"""
Seed the SmartSupply AI database with realistic Pakistani apparel business data.

Usage (run from backend/):
    python scripts/seed.py           # idempotent — safe to run multiple times
    python scripts/seed.py --reset   # wipe all seed tables first, then seed
"""

import argparse
import os
import random
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

# Ensure backend/ is on sys.path when invoked as `python scripts/seed.py`
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt as _bcrypt_lib
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.session import SessionLocal
import models  # noqa: F401 — registers all ORM tables with Base.metadata
from models.factory import Factory
from models.inventory import Inventory
from models.notification import Notification
from models.order import Order, OrderItem, OrderStatus
from models.product import Product, ProductType, SKU
from models.purchase_order import POLineItem, POStatus, PurchaseOrder
from models.shipment import Shipment
from models.user import User, UserRole

# ---------------------------------------------------------------------------
# Globals
# ---------------------------------------------------------------------------

_rng = random.Random(42)  # fixed seed → deterministic data on every --reset

# Mutable counters — track only NEW rows inserted this run
_counts: dict = {
    "users": 0,
    "factories": 0,
    "products": 0,
    "skus": 0,
    "inventory": 0,
    "purchase_orders": 0,
    "po_line_items": 0,
    "orders": 0,
    "order_items": 0,
    "shipments": 0,
    "notifications": 0,
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash(pw: str) -> str:
    # Use bcrypt directly — passlib 1.7.4 has a compatibility issue with
    # bcrypt 5.x's strict 72-byte limit during its wrap-bug detection probe.
    # The resulting $2b$ hash is fully compatible with passlib verification.
    return _bcrypt_lib.hashpw(pw.encode("utf-8"), _bcrypt_lib.gensalt()).decode("utf-8")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _rand_past(min_days: int, max_days: int) -> datetime:
    return _utcnow() - timedelta(days=_rng.randint(min_days, max_days))


def _future_date(min_days: int, max_days: int) -> date:
    return (datetime.now() + timedelta(days=_rng.randint(min_days, max_days))).date()


def _pk_address(recipient_name: str) -> dict:
    cities = [
        ("Karachi",    "Sindh",       "74000"),
        ("Lahore",     "Punjab",      "54000"),
        ("Faisalabad", "Punjab",      "38000"),
        ("Rawalpindi", "Punjab",      "46000"),
        ("Multan",     "Punjab",      "60000"),
        ("Islamabad",  "ICT",         "44000"),
        ("Peshawar",   "KPK",         "25000"),
        ("Quetta",     "Balochistan", "87000"),
    ]
    streets = [
        "Main Shahrah-e-Faisal", "Garden Road", "Tariq Road",
        "M.A. Jinnah Road", "Gulberg Main Boulevard", "MM Alam Road",
        "Link Road", "Jail Road", "Sharea Quaideen", "Clifton Road",
    ]
    city, province, zipcode = _rng.choice(cities)
    return {
        "name":     recipient_name,
        "line1":    f"House {_rng.randint(1, 300)}, {_rng.choice(streets)}",
        "city":     city,
        "province": province,
        "zip":      zipcode,
        "country":  "Pakistan",
    }


def _stripe_id() -> str:
    chars = "abcdefghijklmnopqrstuvwxyz0123456789"
    return "pi_" + "".join(_rng.choices(chars, k=24))


def _tracking_number(carrier: str) -> str:
    prefix = {"TCS": "TCS", "Leopards": "LEO", "PostEx": "PEX"}[carrier]
    return f"{prefix}-{''.join(_rng.choices('0123456789', k=12))}"


# ---------------------------------------------------------------------------
# Static seed data
# ---------------------------------------------------------------------------

_FIXED_PW = "Admin123!"

_STAFF: list[tuple[str, str]] = [
    ("Usman Tariq",   "usman.tariq@smartsupply.com"),
    ("Fatima Malik",  "fatima.malik@smartsupply.com"),
]

_BUYERS: list[tuple[str, str]] = [
    ("Ali Raza",       "ali.raza@gmail.com"),
    ("Sara Qureshi",   "sara.qureshi@yahoo.com"),
    ("Hassan Siddiqui","hassan.siddiqui@gmail.com"),
    ("Ayesha Baig",    "ayesha.baig@hotmail.com"),
    ("Zain Chaudhry",  "zain.chaudhry@gmail.com"),
    ("Maryam Iqbal",   "maryam.iqbal@yahoo.com"),
    ("Bilal Hussain",  "bilal.hussain@gmail.com"),
    ("Nadia Farooq",   "nadia.farooq@outlook.com"),
    ("Kamran Sheikh",  "kamran.sheikh@gmail.com"),
    ("Sana Mirza",     "sana.mirza@yahoo.com"),
    ("Omar Khawaja",   "omar.khawaja@gmail.com"),
    ("Hira Butt",      "hira.butt@hotmail.com"),
    ("Faisal Nawaz",   "faisal.nawaz@gmail.com"),
    ("Rabia Javed",    "rabia.javed@yahoo.com"),
    ("Tariq Mehmood",  "tariq.mehmood@gmail.com"),
    ("Amna Sohail",    "amna.sohail@hotmail.com"),
    ("Asad Rehman",    "asad.rehman@gmail.com"),
    ("Zara Ansari",    "zara.ansari@yahoo.com"),
    ("Imran Ghani",    "imran.ghani@gmail.com"),
    ("Farah Malik",    "farah.malik@outlook.com"),
]

_FACTORIES: list[dict] = [
    {
        "name":           "Al-Kausar Garments",
        "contact_person": "Khalid Pervez",
        "email":          "procurement@alkausar.pk",
        "phone":          "+92-21-35678901",
        "address":        "Plot 42, SITE Industrial Area, Karachi, Sindh",
        "lead_time_days": 18,
    },
    {
        "name":           "Chenab Textile Mills",
        "contact_person": "Zahid Ashraf",
        "email":          "orders@chenabmills.pk",
        "phone":          "+92-41-8765432",
        "address":        "8-km Millat Road, Faisalabad, Punjab",
        "lead_time_days": 21,
    },
    {
        "name":           "Lahore Weaving Co.",
        "contact_person": "Shahid Rashid",
        "email":          "info@lahoreweaving.pk",
        "phone":          "+92-42-35891234",
        "address":        "Block C, Gulberg Industrial Area, Lahore, Punjab",
        "lead_time_days": 14,
    },
]

# Each SKU entry: color, size, sku_code, sale_price (PKR), cost_price (PKR)
_PRODUCTS: list[dict] = [
    {
        "name":        "Premium Cotton Kurta",
        "type":        ProductType.shirt,
        "description": "Handcrafted premium cotton kurta with fine embroidery — perfect for formal and semi-formal occasions.",
        "base_price":  Decimal("1800.00"),
        "cost_price":  Decimal("1100.00"),
        "images":      ["uploads/kurta-white-front.jpg", "uploads/kurta-white-back.jpg"],
        "skus": [
            ("White",    "S",  "KURTA-WHT-S",  Decimal("1800.00"), Decimal("1100.00")),
            ("White",    "M",  "KURTA-WHT-M",  Decimal("1800.00"), Decimal("1100.00")),
            ("Sky Blue", "M",  "KURTA-BLU-M",  Decimal("1900.00"), Decimal("1150.00")),
            ("Sky Blue", "L",  "KURTA-BLU-L",  Decimal("1900.00"), Decimal("1150.00")),
        ],
    },
    {
        "name":        "Formal Dress Shirt",
        "type":        ProductType.shirt,
        "description": "Premium poplin formal dress shirt with spread collar — ideal for office wear and business events.",
        "base_price":  Decimal("2200.00"),
        "cost_price":  Decimal("1350.00"),
        "images":      ["uploads/dress-shirt-white-front.jpg"],
        "skus": [
            ("White",      "M",  "DRESS-WHT-M",  Decimal("2200.00"), Decimal("1350.00")),
            ("White",      "L",  "DRESS-WHT-L",  Decimal("2200.00"), Decimal("1350.00")),
            ("Light Blue", "M",  "DRESS-LBL-M",  Decimal("2200.00"), Decimal("1350.00")),
            ("Light Blue", "XL", "DRESS-LBL-XL", Decimal("2300.00"), Decimal("1400.00")),
        ],
    },
    {
        "name":        "Casual Oxford Shirt",
        "type":        ProductType.shirt,
        "description": "Versatile casual Oxford shirt with button-down collar — great for everyday wear.",
        "base_price":  Decimal("1500.00"),
        "cost_price":  Decimal("900.00"),
        "images":      ["uploads/oxford-white.jpg", "uploads/oxford-navy.jpg"],
        "skus": [
            ("White", "M", "OXFRD-WHT-M", Decimal("1500.00"), Decimal("900.00")),
            ("White", "L", "OXFRD-WHT-L", Decimal("1500.00"), Decimal("900.00")),
            ("Navy",  "L", "OXFRD-NVY-L", Decimal("1600.00"), Decimal("960.00")),
        ],
    },
    {
        "name":        "Classic Linen Shirt",
        "type":        ProductType.shirt,
        "description": "Lightweight classic linen shirt — cool, breathable, and perfect for Pakistan's warm climate.",
        "base_price":  Decimal("1600.00"),
        "cost_price":  Decimal("980.00"),
        "images":      ["uploads/linen-offwhite.jpg", "uploads/linen-beige.jpg"],
        "skus": [
            ("Off-White", "M", "LINEN-OWT-M", Decimal("1600.00"), Decimal("980.00")),
            ("Beige",     "M", "LINEN-BEI-M", Decimal("1700.00"), Decimal("1020.00")),
            ("Beige",     "L", "LINEN-BEI-L", Decimal("1700.00"), Decimal("1020.00")),
        ],
    },
    {
        "name":        "Executive Poplin Shirt",
        "type":        ProductType.shirt,
        "description": "High-thread-count poplin executive shirt with French cuffs — premium boardroom presence.",
        "base_price":  Decimal("2500.00"),
        "cost_price":  Decimal("1550.00"),
        "images":      ["uploads/poplin-white.jpg", "uploads/poplin-blue.jpg"],
        "skus": [
            ("White",       "M", "POPLN-WHT-M",  Decimal("2500.00"), Decimal("1550.00")),
            ("White",       "L", "POPLN-WHT-L",  Decimal("2500.00"), Decimal("1550.00")),
            ("Powder Blue", "M", "POPLN-PBL-M",  Decimal("2500.00"), Decimal("1550.00")),
            ("Powder Blue", "L", "POPLN-PBL-L",  Decimal("2500.00"), Decimal("1550.00")),
        ],
    },
    {
        "name":        "Classic Denim Jeans",
        "type":        ProductType.jeans,
        "description": "5-pocket straight-fit denim jeans with superior stretch comfort — a wardrobe staple.",
        "base_price":  Decimal("3500.00"),
        "cost_price":  Decimal("2100.00"),
        "images":      ["uploads/denim-indigo.jpg", "uploads/denim-black.jpg"],
        "skus": [
            ("Indigo Blue", "30", "DENIM-IND-30", Decimal("3500.00"), Decimal("2100.00")),
            ("Indigo Blue", "32", "DENIM-IND-32", Decimal("3500.00"), Decimal("2100.00")),
            ("Black",       "32", "DENIM-BLK-32", Decimal("3800.00"), Decimal("2280.00")),
            ("Black",       "34", "DENIM-BLK-34", Decimal("3800.00"), Decimal("2280.00")),
        ],
    },
    {
        "name":        "Slim Fit Chinos",
        "type":        ProductType.jeans,
        "description": "Tapered slim-fit chinos in stretch cotton — comfortable enough for casual Fridays, smart enough for client meetings.",
        "base_price":  Decimal("2800.00"),
        "cost_price":  Decimal("1700.00"),
        "images":      ["uploads/chino-khaki.jpg", "uploads/chino-olive.jpg"],
        "skus": [
            ("Khaki",       "30", "CHINO-KHK-30", Decimal("2800.00"), Decimal("1700.00")),
            ("Khaki",       "32", "CHINO-KHK-32", Decimal("2800.00"), Decimal("1700.00")),
            ("Olive Green", "32", "CHINO-OLV-32", Decimal("3000.00"), Decimal("1800.00")),
        ],
    },
    {
        "name":        "Relaxed Fit Cargo Pants",
        "type":        ProductType.jeans,
        "description": "Multi-pocket relaxed cargo pants in durable cotton twill — built for utility and style.",
        "base_price":  Decimal("3200.00"),
        "cost_price":  Decimal("1950.00"),
        "images":      ["uploads/cargo-olive.jpg", "uploads/cargo-sand.jpg"],
        "skus": [
            ("Olive", "30", "CARGO-OLV-30", Decimal("3200.00"), Decimal("1950.00")),
            ("Olive", "32", "CARGO-OLV-32", Decimal("3200.00"), Decimal("1950.00")),
            ("Sand",  "32", "CARGO-SND-32", Decimal("3400.00"), Decimal("2050.00")),
            ("Sand",  "34", "CARGO-SND-34", Decimal("3400.00"), Decimal("2050.00")),
        ],
    },
]

_WAREHOUSES = ["A-01", "A-02", "A-03", "B-01", "B-02", "B-03", "C-01", "C-02", "C-03"]
_COURIERS   = ["TCS", "Leopards", "PostEx"]

# (status, count) — total = 15
_PO_PLAN: list[tuple] = [
    (POStatus.draft,         2),
    (POStatus.placed,        2),
    (POStatus.confirmed,     2),
    (POStatus.in_production, 3),
    (POStatus.shipped,       3),
    (POStatus.received,      3),
]

# (status, count) — total = 80
_ORDER_PLAN: list[tuple] = [
    (OrderStatus.pending,    8),
    (OrderStatus.confirmed,  8),
    (OrderStatus.packed,     8),
    (OrderStatus.shipped,   15),
    (OrderStatus.delivered, 30),
    (OrderStatus.cancelled,  7),
    (OrderStatus.returned,   4),
]

_PO_NOTES = [
    "Urgent order — peak season approaching.",
    "Quality check required before dispatch.",
    "Second batch of summer collection.",
    "Please ensure correct labelling and packaging.",
    "Expedited shipping requested.",
    "Includes replacement items for defective batch.",
    "Pre-Eid rush order — delivery deadline is firm.",
    "New season launch stock.",
    None,
    None,
]

# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------

def reset_db(db: Session) -> None:
    print("  Truncating all tables (CASCADE)...")
    db.execute(text(
        "TRUNCATE TABLE "
        "notifications, shipments, order_items, po_line_items, "
        "orders, purchase_orders, inventory, skus, products, "
        "factories, users "
        "RESTART IDENTITY CASCADE"
    ))
    db.commit()
    print("  Done.\n")


# ---------------------------------------------------------------------------
# Seed: users
# ---------------------------------------------------------------------------

def seed_users(db: Session) -> tuple[User, list[User], list[User]]:
    """Returns (supplier, staff_list, buyer_list)."""
    print("Creating users...")
    hashed = _hash(_FIXED_PW)

    def _get_or_create(email: str, full_name: str, role: UserRole, days_ago_range: tuple) -> tuple[User, bool]:
        u = db.query(User).filter_by(email=email).first()
        if u:
            return u, False
        u = User(
            email=email,
            hashed_password=hashed,
            full_name=full_name,
            role=role,
            is_active=True,
            created_at=_rand_past(*days_ago_range),
        )
        db.add(u)
        db.flush()
        _counts["users"] += 1
        return u, True

    supplier, _ = _get_or_create(
        "supplier@smartsupply.com", "Ahmed Khan", UserRole.supplier, (120, 180)
    )

    staff = []
    for full_name, email in _STAFF:
        u, _ = _get_or_create(email, full_name, UserRole.staff, (60, 120))
        staff.append(u)

    buyers = []
    for full_name, email in _BUYERS:
        u, _ = _get_or_create(email, full_name, UserRole.buyer, (7, 150))
        buyers.append(u)

    db.commit()
    total = 1 + len(_STAFF) + len(_BUYERS)
    existing = total - _counts["users"]
    print(f"  {_counts['users']} created, {existing} already existed.")
    return supplier, staff, buyers


# ---------------------------------------------------------------------------
# Seed: factories
# ---------------------------------------------------------------------------

def seed_factories(db: Session) -> list[Factory]:
    print("Creating factories...")
    factories = []
    for data in _FACTORIES:
        f = db.query(Factory).filter_by(name=data["name"]).first()
        if not f:
            f = Factory(**{k: v for k, v in data.items()}, is_active=True)
            db.add(f)
            db.flush()
            _counts["factories"] += 1
        factories.append(f)
    db.commit()
    existing = len(_FACTORIES) - _counts["factories"]
    print(f"  {_counts['factories']} created, {existing} already existed.")
    return factories


# ---------------------------------------------------------------------------
# Seed: products & SKUs
# ---------------------------------------------------------------------------

def seed_products_and_skus(db: Session) -> list[SKU]:
    print("Creating products and SKUs...")
    all_skus: list[SKU] = []

    for p_data in _PRODUCTS:
        product = db.query(Product).filter_by(name=p_data["name"]).first()
        if not product:
            product = Product(
                name=p_data["name"],
                type=p_data["type"],
                description=p_data["description"],
                base_price=p_data["base_price"],
                cost_price=p_data["cost_price"],
                images=p_data["images"],
                created_at=_rand_past(90, 270),
            )
            db.add(product)
            db.flush()
            _counts["products"] += 1

        for color, size, code, sale_price, cost_price in p_data["skus"]:
            sku = db.query(SKU).filter_by(sku_code=code).first()
            if not sku:
                sku = SKU(
                    product_id=product.id,
                    color=color,
                    size=size,
                    sku_code=code,
                    sale_price=sale_price,
                    cost_price=cost_price,
                )
                db.add(sku)
                db.flush()
                _counts["skus"] += 1
            all_skus.append(sku)

    db.commit()
    print(
        f"  {_counts['products']} products created, "
        f"{len(_PRODUCTS) - _counts['products']} already existed. "
        f"  {_counts['skus']} SKUs created."
    )
    return all_skus


# ---------------------------------------------------------------------------
# Seed: inventory
# ---------------------------------------------------------------------------

def seed_inventory(db: Session, skus: list[SKU]) -> None:
    print("Creating inventory records...")
    for sku in skus:
        if db.query(Inventory).filter_by(sku_id=sku.id).first():
            continue
        qty = _rng.randint(10, 200)
        reserved = _rng.randint(0, min(qty // 4, 15))
        db.add(Inventory(
            sku_id=sku.id,
            quantity_on_hand=qty,
            quantity_reserved=reserved,
            low_stock_threshold=20,
            warehouse_location=_rng.choice(_WAREHOUSES),
        ))
        _counts["inventory"] += 1
    db.commit()
    existing = len(skus) - _counts["inventory"]
    print(f"  {_counts['inventory']} created, {existing} already existed.")


# ---------------------------------------------------------------------------
# Seed: purchase orders
# ---------------------------------------------------------------------------

def seed_purchase_orders(
    db: Session,
    factories: list[Factory],
    creators: list[User],
    skus: list[SKU],
) -> None:
    print("Creating purchase orders...")

    if db.query(PurchaseOrder).count() >= 15:
        print("  Skipped -- 15+ purchase orders already exist.")
        return

    # Days-ago range for created_at per status
    age: dict = {
        POStatus.draft:         (0,  7),
        POStatus.placed:        (2,  14),
        POStatus.confirmed:     (5,  25),
        POStatus.in_production: (10, 50),
        POStatus.shipped:       (21, 70),
        POStatus.received:      (45, 130),
    }

    for status, count in _PO_PLAN:
        min_d, max_d = age[status]
        for _ in range(count):
            created_at = _rand_past(min_d, max_d)
            factory    = _rng.choice(factories)
            creator    = _rng.choice(creators)

            if status in (POStatus.draft,):
                delivery_date = None
            elif status == POStatus.received:
                delivery_date = (_utcnow() - timedelta(days=_rng.randint(5, 30))).date()
            else:
                lead = factory.lead_time_days or 21
                delivery_date = _future_date(lead - 7, lead + 14)

            po = PurchaseOrder(
                factory_id=factory.id,
                created_by=creator.id,
                status=status,
                expected_delivery_date=delivery_date,
                notes=_rng.choice(_PO_NOTES),
                created_at=created_at,
            )
            db.add(po)
            db.flush()
            _counts["purchase_orders"] += 1

            # 2–4 line items per PO
            for sku in _rng.sample(skus, k=_rng.randint(2, 4)):
                qty = _rng.randint(20, 200)
                received = (
                    qty if status == POStatus.received
                    else (_rng.randint(0, qty // 2) if status == POStatus.shipped else 0)
                )
                db.add(POLineItem(
                    po_id=po.id,
                    sku_id=sku.id,
                    quantity_ordered=qty,
                    quantity_received=received,
                    unit_cost=sku.cost_price,
                ))
                _counts["po_line_items"] += 1

    db.commit()
    print(
        f"  {_counts['purchase_orders']} purchase orders, "
        f"{_counts['po_line_items']} line items created."
    )


# ---------------------------------------------------------------------------
# Seed: orders
# ---------------------------------------------------------------------------

def seed_orders(db: Session, buyers: list[User], skus: list[SKU]) -> list[Order]:
    print("Creating orders...")

    if db.query(Order).count() >= 80:
        print("  Skipped -- 80+ orders already exist.")
        return db.query(Order).all()

    # Typical age range (days ago) per order status
    age: dict = {
        OrderStatus.delivered:  (30, 180),
        OrderStatus.returned:   (30,  90),
        OrderStatus.cancelled:  (1,  180),
        OrderStatus.shipped:    (7,   45),
        OrderStatus.packed:     (2,   14),
        OrderStatus.confirmed:  (1,    7),
        OrderStatus.pending:    (0,    3),
    }

    orders: list[Order] = []
    for status, count in _ORDER_PLAN:
        min_d, max_d = age[status]
        for _ in range(count):
            buyer      = _rng.choice(buyers)
            created_at = _rand_past(min_d, max_d)

            # 1–3 items per order
            chosen = _rng.sample(skus, k=_rng.randint(1, 3))
            total  = Decimal("0.00")
            items  = []
            for sku in chosen:
                qty    = _rng.randint(1, 4)
                price  = sku.sale_price
                total += price * qty
                items.append((sku, qty, price))

            paid = status not in (OrderStatus.pending, OrderStatus.cancelled)
            order = Order(
                buyer_id=buyer.id,
                status=status,
                total_amount=total,
                shipping_address=_pk_address(buyer.full_name),
                stripe_payment_id=_stripe_id() if paid else None,
                created_at=created_at,
            )
            db.add(order)
            db.flush()
            _counts["orders"] += 1

            for sku, qty, price in items:
                db.add(OrderItem(
                    order_id=order.id,
                    sku_id=sku.id,
                    quantity=qty,
                    unit_price=price,
                ))
                _counts["order_items"] += 1

            orders.append(order)

    db.commit()
    print(
        f"  {_counts['orders']} orders, "
        f"{_counts['order_items']} order items created."
    )
    return orders


# ---------------------------------------------------------------------------
# Seed: shipments
# ---------------------------------------------------------------------------

def seed_shipments(db: Session, orders: list[Order]) -> None:
    print("Creating shipments...")

    shippable_statuses = {OrderStatus.shipped, OrderStatus.delivered, OrderStatus.returned}
    for order in orders:
        if order.status not in shippable_statuses:
            continue
        if db.query(Shipment).filter_by(order_id=order.id).first():
            continue

        carrier    = _rng.choice(_COURIERS)
        tracking   = _tracking_number(carrier)
        shipped_at = order.created_at + timedelta(days=_rng.randint(1, 3))

        if order.status == OrderStatus.delivered:
            delivered_at = shipped_at + timedelta(days=_rng.randint(2, 5))
            ship_status  = "delivered"
        elif order.status == OrderStatus.returned:
            delivered_at = shipped_at + timedelta(days=_rng.randint(2, 4))
            ship_status  = "returned"
        else:
            delivered_at = None
            ship_status  = "in_transit"

        db.add(Shipment(
            order_id=order.id,
            tracking_number=tracking,
            carrier=carrier,
            status=ship_status,
            shipped_at=shipped_at,
            delivered_at=delivered_at,
        ))
        _counts["shipments"] += 1

    db.commit()
    existing = sum(
        1 for o in orders if o.status in shippable_statuses
    ) - _counts["shipments"]
    print(f"  {_counts['shipments']} created, {existing} already existed.")


# ---------------------------------------------------------------------------
# Seed: notifications
# ---------------------------------------------------------------------------

def seed_notifications(
    db: Session,
    supplier: User,
    skus: list[SKU],
    orders: list[Order],
) -> None:
    print("Creating notifications...")

    if db.query(Notification).filter_by(user_id=supplier.id).count() > 0:
        print("  Skipped -- notifications already exist for supplier.")
        return

    def _add(title: str, message: str, notif_type: str, created_at: datetime, is_read: bool = False) -> None:
        db.add(Notification(
            user_id=supplier.id,
            title=title,
            message=message,
            type=notif_type,
            is_read=is_read,
            created_at=created_at,
        ))
        _counts["notifications"] += 1

    # — Low-stock alerts ——————————————————————————————————————————————————————
    low_inv = (
        db.query(Inventory)
        .filter(Inventory.quantity_on_hand < Inventory.low_stock_threshold)
        .all()
    )
    for inv in low_inv:
        sku = db.get(SKU, inv.sku_id)
        if not sku:
            continue
        product = db.get(Product, sku.product_id)
        _add(
            title="Low Stock Alert",
            message=(
                f"SKU {sku.sku_code} ({product.name} — {sku.color}, {sku.size}) "
                f"has only {inv.quantity_on_hand} units remaining "
                f"(threshold: {inv.low_stock_threshold}). Reorder soon."
            ),
            notif_type="low_stock",
            created_at=_rand_past(1, 7),
            is_read=False,
        )

    # — New order notifications (10 most recent orders) ———————————————————————
    recent_orders = sorted(orders, key=lambda o: o.created_at, reverse=True)[:10]
    for order in recent_orders:
        buyer = db.get(User, order.buyer_id)
        _add(
            title="New Order Received",
            message=(
                f"Order #{order.id} placed by {buyer.full_name} — "
                f"Rs. {order.total_amount:,.2f} — "
                f"Status: {order.status.value}."
            ),
            notif_type="new_order",
            created_at=order.created_at + timedelta(minutes=_rng.randint(2, 15)),
            is_read=_rng.choice([True, True, False]),  # mostly read
        )

    # — Purchase order update notifications ——————————————————————————————————
    po_notif_map: dict[POStatus, tuple[str, str]] = {
        POStatus.confirmed: (
            "Purchase Order Confirmed",
            "PO #{id} has been confirmed by {factory}. Expected delivery: {date}.",
        ),
        POStatus.in_production: (
            "Production Started",
            "PO #{id} with {factory} has entered the production phase.",
        ),
        POStatus.shipped: (
            "Purchase Order Shipped",
            "PO #{id} from {factory} has been dispatched. Delivery expected soon.",
        ),
        POStatus.received: (
            "Stock Received",
            "PO #{id} from {factory} has been received and inventory has been updated.",
        ),
    }

    active_pos = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.status.in_(list(po_notif_map.keys())))
        .limit(8)
        .all()
    )
    for po in active_pos:
        factory = db.get(Factory, po.factory_id)
        title, msg_tpl = po_notif_map[po.status]
        _add(
            title=title,
            message=msg_tpl.format(
                id=po.id,
                factory=factory.name,
                date=po.expected_delivery_date or "TBD",
            ),
            notif_type="po_update",
            created_at=po.created_at + timedelta(hours=_rng.randint(1, 6)),
            is_read=_rng.choice([True, False]),
        )

    db.commit()
    print(f"  {_counts['notifications']} created.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed SmartSupply AI with realistic Pakistani apparel business data."
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Wipe all seed tables first (TRUNCATE … RESTART IDENTITY CASCADE), then seed.",
    )
    args = parser.parse_args()

    db: Session = SessionLocal()
    try:
        if args.reset:
            print("\n--- Reset ------------------------------------------------------------")
            reset_db(db)

        print("--- Seeding ----------------------------------------------------------")
        supplier, staff, buyers = seed_users(db)
        factories                = seed_factories(db)
        skus                     = seed_products_and_skus(db)
        seed_inventory(db, skus)
        seed_purchase_orders(db, factories, [supplier] + staff, skus)
        orders = seed_orders(db, buyers, skus)
        seed_shipments(db, orders)
        seed_notifications(db, supplier, skus, orders)

        # — Summary ——————————————————————————————————————————————————————————
        col = 20
        total = sum(_counts.values())
        print("\n--- Summary ----------------------------------------------------------")
        for table, count in _counts.items():
            print(f"  {table:<{col}} {count:>5} new records")
        print(f"  {'-' * (col + 13)}")
        print(f"  {'TOTAL':<{col}} {total:>5} new records")
        print()

    finally:
        db.close()


if __name__ == "__main__":
    main()
