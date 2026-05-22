import pytest
from starlette.testclient import TestClient

from core.dependencies import require_supplier
from core.security import get_password_hash
from main import app
from models.user import User, UserRole

# Test-only route to verify 403 enforcement
@app.get("/api/v1/test/supplier-only", include_in_schema=False)
def _supplier_only(current_user: User = pytest.importorskip("fastapi").Depends(require_supplier)):
    return {"ok": True}


# Re-import after route registration so TestClient picks it up
from fastapi import Depends  # noqa: E402

app.routes  # ensure route is registered


REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/auth/me"
SUPPLIER_URL = "/api/v1/test/supplier-only"


def _register_buyer(client: TestClient, email: str = "buyer@test.com") -> str:
    resp = client.post(REGISTER_URL, json={
        "email": email,
        "password": "Password1",
        "full_name": "Test Buyer",
    })
    assert resp.status_code == 200
    return resp.json()["access_token"]


def _seed_supplier(db) -> str:
    """Insert a supplier user and return an access token."""
    from core.security import create_access_token
    from datetime import timedelta

    user = User(
        email="supplier@smartsupply.com",
        hashed_password=get_password_hash("Admin123!"),
        full_name="Supplier User",
        role=UserRole.supplier,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=30),
    )


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_register_returns_token(client):
    resp = client.post(REGISTER_URL, json={
        "email": "new@example.com",
        "password": "Password1",
        "full_name": "New User",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_correct_credentials_returns_token(client):
    _register_buyer(client, email="login@example.com")
    resp = client.post(LOGIN_URL, json={
        "email": "login@example.com",
        "password": "Password1",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password_returns_401(client):
    _register_buyer(client, email="wrong@example.com")
    resp = client.post(LOGIN_URL, json={
        "email": "wrong@example.com",
        "password": "WrongPass99",
    })
    assert resp.status_code == 401


def test_me_with_valid_token_returns_profile(client):
    token = _register_buyer(client, email="me@example.com")
    resp = client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "me@example.com"
    assert body["role"] == "buyer"


def test_me_without_token_returns_401(client):
    resp = client.get(ME_URL)
    assert resp.status_code == 401


def test_buyer_cannot_access_supplier_endpoint(client, db):
    buyer_token = _register_buyer(client, email="buyer2@example.com")
    resp = client.get(SUPPLIER_URL, headers={"Authorization": f"Bearer {buyer_token}"})
    assert resp.status_code == 403
