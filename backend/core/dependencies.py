from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from core.security import verify_token
from db.session import get_db
from models.user import User, UserRole

# auto_error=False so we can return 401 (not 403) when the header is absent
http_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = verify_token(credentials.credentials, token_type="access")
    try:
        user_id = int(payload["sub"])
    except (KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def require_supplier(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.supplier:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Supplier access required",
        )
    return current_user


def require_staff_or_supplier(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role == UserRole.buyer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff or supplier access required",
        )
    return current_user


def require_buyer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.buyer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Buyer access required",
        )
    return current_user
