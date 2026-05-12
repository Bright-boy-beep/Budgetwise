"""
tests/backend/test_routes.py — API route tests.

Run with: pytest tests/backend/ -v
"""

import pytest
from app import create_app, db


@pytest.fixture
def app():
    """Create a test application with an in-memory SQLite database."""
    app = create_app()
    app.config.update({
        "TESTING":                True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY":          "test-secret",
    })
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_headers(client):
    """Register a test user and return JWT auth headers."""
    client.post("/api/auth/register", json={
        "name": "Test User", "email": "test@example.com", "password": "password123"
    })
    res = client.post("/api/auth/login", json={
        "email": "test@example.com", "password": "password123"
    })
    token = res.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


# ── Auth Tests ─────────────────────────────────────────────────────────────────

class TestAuth:
    def test_register_success(self, client):
        res = client.post("/api/auth/register", json={
            "name": "Bright", "email": "bright@example.com", "password": "secure123"
        })
        assert res.status_code == 201
        assert "token" in res.get_json()

    def test_register_duplicate_email(self, client):
        payload = {"name": "User", "email": "dup@example.com", "password": "pass123"}
        client.post("/api/auth/register", json=payload)
        res = client.post("/api/auth/register", json=payload)
        assert res.status_code == 409

    def test_login_success(self, client):
        client.post("/api/auth/register", json={
            "name": "User", "email": "login@example.com", "password": "pass123"
        })
        res = client.post("/api/auth/login", json={
            "email": "login@example.com", "password": "pass123"
        })
        assert res.status_code == 200
        assert "token" in res.get_json()

    def test_login_wrong_password(self, client):
        client.post("/api/auth/register", json={
            "name": "User", "email": "u@example.com", "password": "correct"
        })
        res = client.post("/api/auth/login", json={
            "email": "u@example.com", "password": "wrong"
        })
        assert res.status_code == 401


# ── Transaction Tests ──────────────────────────────────────────────────────────

class TestTransactions:
    def test_create_transaction(self, client, auth_headers):
        res = client.post("/api/transactions/", json={
            "type": "expense", "description": "Groceries",
            "amount": 5000, "date": "2025-05-01", "category": "Food & Dining"
        }, headers=auth_headers)
        assert res.status_code == 201
        data = res.get_json()
        assert data["description"] == "Groceries"

    def test_list_transactions(self, client, auth_headers):
        client.post("/api/transactions/", json={
            "type": "income", "description": "Salary",
            "amount": 200000, "date": "2025-05-01", "category": "Salary"
        }, headers=auth_headers)
        res = client.get("/api/transactions/", headers=auth_headers)
        assert res.status_code == 200
        assert len(res.get_json()) >= 1

    def test_delete_transaction(self, client, auth_headers):
        create_res = client.post("/api/transactions/", json={
            "type": "expense", "description": "Test",
            "amount": 1000, "date": "2025-05-01", "category": "Other"
        }, headers=auth_headers)
        tx_id = create_res.get_json()["id"]

        del_res = client.delete(f"/api/transactions/{tx_id}", headers=auth_headers)
        assert del_res.status_code == 200


# ── Budget Tests ───────────────────────────────────────────────────────────────

class TestBudgets:
    def test_create_budget(self, client, auth_headers):
        res = client.post("/api/budgets/", json={
            "category": "Food & Dining", "limit": 50000, "month": "2025-05"
        }, headers=auth_headers)
        assert res.status_code == 201

    def test_list_budgets(self, client, auth_headers):
        client.post("/api/budgets/", json={
            "category": "Shopping", "limit": 30000, "month": "2025-05"
        }, headers=auth_headers)
        res = client.get("/api/budgets/", headers=auth_headers)
        assert res.status_code == 200
        assert len(res.get_json()) >= 1
