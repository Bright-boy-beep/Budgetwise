"""
routes/goals.py — Savings Goals endpoints.

GET    /api/goals/             — list all goals for current user
POST   /api/goals/             — create a new goal
PUT    /api/goals/<id>         — update goal details
DELETE /api/goals/<id>         — delete a goal
POST   /api/goals/<id>/contribute  — add funds to a goal
"""

import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from .. import db
from ..models.goal import Goal

logger    = logging.getLogger(__name__)
goals_bp  = Blueprint("goals", __name__)


# ─── List ─────────────────────────────────────────────────────────────────────

@goals_bp.get("/")
@jwt_required()
def list_goals():
    user_id = int(get_jwt_identity())
    goals   = Goal.query.filter_by(user_id=user_id).order_by(Goal.created_at.desc()).all()
    return jsonify([g.to_dict() for g in goals]), 200


# ─── Create ───────────────────────────────────────────────────────────────────

@goals_bp.post("/")
@jwt_required()
def create_goal():
    user_id = int(get_jwt_identity())
    data    = request.get_json(force=True, silent=True) or {}

    name          = (data.get("name") or "").strip()
    target_amount = data.get("target_amount")
    category      = (data.get("category") or "Other").strip()
    saved_amount  = float(data.get("saved_amount") or 0)
    deadline      = data.get("deadline") or None
    color         = (data.get("color") or "#7B5CF5").strip()

    if not name:
        return jsonify({"error": "Goal name is required."}), 400
    try:
        target_amount = float(target_amount)
        if target_amount <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "target_amount must be a positive number."}), 400

    goal = Goal(
        user_id       = user_id,
        name          = name,
        category      = category,
        target_amount = target_amount,
        saved_amount  = max(saved_amount, 0),
        deadline      = deadline,
        color         = color,
    )
    db.session.add(goal)
    db.session.commit()
    return jsonify(goal.to_dict()), 201


# ─── Update ───────────────────────────────────────────────────────────────────

@goals_bp.put("/<int:goal_id>")
@jwt_required()
def update_goal(goal_id):
    user_id = int(get_jwt_identity())
    goal    = Goal.query.filter_by(id=goal_id, user_id=user_id).first_or_404()
    data    = request.get_json(force=True, silent=True) or {}

    if "name" in data and data["name"]:
        goal.name = data["name"].strip()
    if "category" in data:
        goal.category = data["category"].strip()
    if "target_amount" in data:
        try:
            v = float(data["target_amount"])
            if v > 0:
                goal.target_amount = v
        except (TypeError, ValueError):
            pass
    if "saved_amount" in data:
        try:
            goal.saved_amount = max(float(data["saved_amount"]), 0)
        except (TypeError, ValueError):
            pass
    if "deadline" in data:
        goal.deadline = data["deadline"] or None
    if "color" in data:
        goal.color = data["color"].strip()

    db.session.commit()
    return jsonify(goal.to_dict()), 200


# ─── Delete ───────────────────────────────────────────────────────────────────

@goals_bp.delete("/<int:goal_id>")
@jwt_required()
def delete_goal(goal_id):
    user_id = int(get_jwt_identity())
    goal    = Goal.query.filter_by(id=goal_id, user_id=user_id).first_or_404()
    db.session.delete(goal)
    db.session.commit()
    return "", 204


# ─── Contribute ───────────────────────────────────────────────────────────────

@goals_bp.post("/<int:goal_id>/contribute")
@jwt_required()
def contribute(goal_id):
    user_id = int(get_jwt_identity())
    goal    = Goal.query.filter_by(id=goal_id, user_id=user_id).first_or_404()
    data    = request.get_json(force=True, silent=True) or {}

    try:
        amount = float(data.get("amount") or 0)
        if amount <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be a positive number."}), 400

    goal.saved_amount = min(goal.saved_amount + amount, goal.target_amount * 2)
    db.session.commit()
    return jsonify(goal.to_dict()), 200
