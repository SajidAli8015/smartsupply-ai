from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from core.dependencies import require_supplier
from db.session import get_db
from models.product import ProductType
from models.user import User
from schemas.product import (
    PagedResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    SKUCreate,
    SKUResponse,
)
from services import product_service

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=PagedResponse[ProductResponse])
def list_products(
    type: Optional[ProductType] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
) -> PagedResponse[ProductResponse]:
    items, total = product_service.get_products(
        db, product_type=type, search=search, page=page, page_size=page_size
    )
    return PagedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 0,
    )


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> ProductResponse:
    return product_service.create_product(db, payload)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)) -> ProductResponse:
    return product_service.get_product_by_id(db, product_id)


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> ProductResponse:
    return product_service.update_product(db, product_id, payload)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> None:
    product_service.delete_product(db, product_id)


@router.post("/{product_id}/skus", response_model=SKUResponse, status_code=status.HTTP_201_CREATED)
def add_sku(
    product_id: int,
    payload: SKUCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> SKUResponse:
    return product_service.add_sku(db, product_id, payload)
