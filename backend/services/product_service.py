from typing import List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from models.inventory import Inventory
from models.product import Product, ProductType, SKU
from schemas.product import ProductCreate, ProductUpdate, SKUCreate


def _load_product(db: Session, product_id: int) -> Product:
    product = (
        db.query(Product)
        .options(joinedload(Product.skus).joinedload(SKU.inventory))
        .filter(Product.id == product_id, Product.is_active == True)  # noqa: E712
        .first()
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


def get_products(
    db: Session,
    product_type: Optional[ProductType] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> Tuple[List[Product], int]:
    filters = [Product.is_active == True]  # noqa: E712
    if product_type:
        filters.append(Product.type == product_type)
    if search:
        filters.append(Product.name.ilike(f"%{search}%"))

    total = db.query(func.count(Product.id)).filter(*filters).scalar()
    items = (
        db.query(Product)
        .filter(*filters)
        .options(joinedload(Product.skus).joinedload(SKU.inventory))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_product_by_id(db: Session, product_id: int) -> Product:
    return _load_product(db, product_id)


def create_product(db: Session, product_data: ProductCreate) -> Product:
    product = Product(
        name=product_data.name,
        type=product_data.type,
        description=product_data.description,
        base_price=product_data.base_price,
        cost_price=product_data.cost_price,
        images=product_data.images,
        is_active=True,
    )
    db.add(product)
    db.flush()

    for sku_data in product_data.skus:
        sku = SKU(
            product_id=product.id,
            sku_code=sku_data.sku_code,
            color=sku_data.color,
            size=sku_data.size,
            sale_price=sku_data.sale_price,
            cost_price=sku_data.cost_price,
        )
        db.add(sku)
        db.flush()
        db.add(Inventory(sku_id=sku.id, quantity_on_hand=0, quantity_reserved=0))

    db.commit()
    return _load_product(db, product.id)


def update_product(db: Session, product_id: int, product_data: ProductUpdate) -> Product:
    product = _load_product(db, product_id)
    for field, value in product_data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    db.commit()
    return _load_product(db, product_id)


def delete_product(db: Session, product_id: int) -> None:
    product = _load_product(db, product_id)
    product.is_active = False
    db.commit()


def add_sku(db: Session, product_id: int, sku_data: SKUCreate) -> SKU:
    _load_product(db, product_id)  # raises 404 if missing
    sku = SKU(
        product_id=product_id,
        sku_code=sku_data.sku_code,
        color=sku_data.color,
        size=sku_data.size,
        sale_price=sku_data.sale_price,
        cost_price=sku_data.cost_price,
    )
    db.add(sku)
    db.flush()
    db.add(Inventory(sku_id=sku.id, quantity_on_hand=0, quantity_reserved=0))
    db.commit()
    return (
        db.query(SKU)
        .options(joinedload(SKU.inventory))
        .filter(SKU.id == sku.id)
        .first()
    )
