from math import ceil
from typing import List, Tuple

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from models.factory import Factory
from schemas.factory import FactoryCreate, FactoryUpdate


def _get_or_404(db: Session, factory_id: int) -> Factory:
    factory = db.get(Factory, factory_id)
    if factory is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Factory not found")
    return factory


def get_factories(db: Session, page: int = 1, page_size: int = 20) -> Tuple[List[Factory], int]:
    total = db.query(func.count(Factory.id)).scalar()
    items = (
        db.query(Factory)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_factory_by_id(db: Session, factory_id: int) -> Factory:
    return _get_or_404(db, factory_id)


def create_factory(db: Session, data: FactoryCreate) -> Factory:
    factory = Factory(**data.model_dump())
    db.add(factory)
    db.commit()
    db.refresh(factory)
    return factory


def update_factory(db: Session, factory_id: int, data: FactoryUpdate) -> Factory:
    factory = _get_or_404(db, factory_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(factory, field, value)
    db.commit()
    db.refresh(factory)
    return factory


def delete_factory(db: Session, factory_id: int) -> None:
    factory = _get_or_404(db, factory_id)
    factory.is_active = False
    db.commit()
