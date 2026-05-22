from datetime import timedelta

import pytest
from starlette.testclient import TestClient

from core.security import create_access_token, get_password_hash
from models.user import User, UserRole

PRODUCTS_URL = "/api/v1/products"
INVENTORY_URL = "/api/v1/inventory"

_SHIRT_PAYLOAD = {
    "name": "Classic White Shirt",
    "type": "shirt",
    "description": "A classic white shirt",
    "base_price": "1500.00",
    "cost_price": "800.00",
    "images": [],
    "skus": [
        {
            "sku_code": "SHIRT-WHT-M",
            "color": "white",
            "size": "M",
            "sale_price": "1500.00",
            "cost_price": "800.00",
        },
        {
            "sku_code": "SHIRT-WHT-L",
            "color": "white",
            "size": "L",
            "sale_price": "1600.00",
            "cost_price": "800.00",
        },
    ],
}


def _supplier_token(db) -> str:
    user = User(
        email="supplier@test.com",
        hashed_password=get_password_hash("Admin123!"),
        full_name="Test Supplier",
        role=UserRole.supplier,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return create_access_token({"sub": str(user.id)}, timedelta(minutes=30))


def _buyer_token(client: TestClient) -> str:
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": "buyer@test.com", "password": "Password1", "full_name": "Test Buyer"},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _create_shirt(client, token) -> dict:
    resp = client.post(PRODUCTS_URL, json=_SHIRT_PAYLOAD, headers=_auth(token))
    assert resp.status_code == 201
    return resp.json()


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_list_products_returns_paginated(client, db):
    token = _supplier_token(db)
    _create_shirt(client, token)

    resp = client.get(PRODUCTS_URL)
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body
    assert "page" in body
    assert "total_pages" in body
    assert body["total"] >= 1
    assert body["page"] == 1


def test_list_products_filter_by_type(client, db):
    token = _supplier_token(db)
    _create_shirt(client, token)
    jeans_payload = {
        **_SHIRT_PAYLOAD,
        "name": "Blue Jeans",
        "type": "jeans",
        "skus": [
            {
                "sku_code": "JEANS-BLU-32",
                "color": "blue",
                "size": "32",
                "sale_price": "2500.00",
                "cost_price": "1200.00",
            }
        ],
    }
    client.post(PRODUCTS_URL, json=jeans_payload, headers=_auth(token))

    resp = client.get(PRODUCTS_URL, params={"type": "shirt"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert all(item["type"] == "shirt" for item in body["items"])


def test_create_product_supplier(client, db):
    token = _supplier_token(db)
    resp = client.post(PRODUCTS_URL, json=_SHIRT_PAYLOAD, headers=_auth(token))
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Classic White Shirt"
    assert body["type"] == "shirt"
    assert len(body["skus"]) == 2


def test_create_product_buyer_returns_403(client, db):
    token = _buyer_token(client)
    resp = client.post(PRODUCTS_URL, json=_SHIRT_PAYLOAD, headers=_auth(token))
    assert resp.status_code == 403


def test_get_product_by_id_with_skus(client, db):
    token = _supplier_token(db)
    created = _create_shirt(client, token)
    product_id = created["id"]

    resp = client.get(f"{PRODUCTS_URL}/{product_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == product_id
    assert len(body["skus"]) == 2
    # inventory levels should be embedded on each SKU
    for sku in body["skus"]:
        assert "inventory" in sku
        assert sku["inventory"]["quantity_on_hand"] == 0
        assert sku["inventory"]["available"] == 0


def test_adjust_inventory_increases_stock(client, db):
    token = _supplier_token(db)
    created = _create_shirt(client, token)
    sku_id = created["skus"][0]["id"]

    resp = client.post(
        f"{INVENTORY_URL}/{sku_id}/adjust",
        json={"quantity": 50, "reason": "recount"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["quantity_on_hand"] == 50
    assert body["available"] == 50


def test_adjust_negative_below_zero_returns_400(client, db):
    token = _supplier_token(db)
    created = _create_shirt(client, token)
    sku_id = created["skus"][0]["id"]

    # stock starts at 0, subtracting 1 should fail
    resp = client.post(
        f"{INVENTORY_URL}/{sku_id}/adjust",
        json={"quantity": -1, "reason": "damage"},
        headers=_auth(token),
    )
    assert resp.status_code == 400
