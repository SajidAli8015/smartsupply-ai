from math import ceil

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from core.dependencies import require_supplier
from db.session import get_db
from models.user import User
from schemas.factory import FactoryCreate, FactoryResponse, FactoryUpdate
from schemas.product import PagedResponse
from services import factory_service

router = APIRouter(prefix="/factories", tags=["factories"])


@router.get("", response_model=PagedResponse[FactoryResponse])
def list_factories(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> PagedResponse[FactoryResponse]:
    items, total = factory_service.get_factories(db, page=page, page_size=page_size)
    return PagedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 0,
    )


@router.post("", response_model=FactoryResponse, status_code=status.HTTP_201_CREATED)
def create_factory(
    payload: FactoryCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> FactoryResponse:
    return factory_service.create_factory(db, payload)


@router.get("/{factory_id}", response_model=FactoryResponse)
def get_factory(
    factory_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> FactoryResponse:
    return factory_service.get_factory_by_id(db, factory_id)


@router.put("/{factory_id}", response_model=FactoryResponse)
def update_factory(
    factory_id: int,
    payload: FactoryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> FactoryResponse:
    return factory_service.update_factory(db, factory_id, payload)


@router.delete("/{factory_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_factory(
    factory_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_supplier),
) -> None:
    factory_service.delete_factory(db, factory_id)
