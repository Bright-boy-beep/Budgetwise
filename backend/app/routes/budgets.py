"""
routes/budgets.py — Budget CRUD endpoints.

GET    /api/budgets/         — list budgets (optionally filter by month)
POST   /api/budgets/         — create or update a budget for a category/month
DELETE /api/budgets/<id>     — delete a budget
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from .. import db
from ..models.budget import Budget

budgets_bp = Blueprint("budgets", __name__)


@budgets_bp.get("/")
@jwt_required()
def list_budgets():
    user_id = int(get_jwt_identity())
    month   = request.args.get("month")

    query = Budget.query.filter_by(user_id=user_id)
    if month:
        query = query.filter_by(month=month)

    budgets = query.order_by(Budget.month.desc()).all()
    return jsonify([b.to_dict() for b in budgets]), 200


@budgets_bp.post("/")
@jwt_required()
def create_or_update_budget():
    user_id = int(get_jwt_identity())
    data    = request.get_json(force=True, silent=True) or {}

    category = (data.get("category") or "").strip()
    limit    = data.get("limit")
    month    = (data.get("month") or "").strip()

    if not category or not limit or not month:
        return jsonify({"error": "category, limit, and month are required."}), 400

    existing = Budget.query.filter_by(
        user_id=user_id, category=category, month=month
    ).first()

    if existing:
        existing.limit = float(limit)
        db.session.commit()
        return jsonify(existing.to_dict()), 200

    budget = Budget(user_id=user_id, category=category, limit=float(limit), month=month)
    db.session.add(budget)
    db.session.commit()
    return jsonify(budget.to_dict()), 201


@budgets_bp.delete("/<int:budget_id>")
@jwt_required()
def delete_budget(budget_id):
    user_id = int(get_jwt_identity())
    budget  = Budget.query.filter_by(id=budget_id, user_id=user_id).first_or_404()
    db.session.delete(budget)
    db.session.commit()
    return jsonify({"message": "Budget deleted."}), 200
