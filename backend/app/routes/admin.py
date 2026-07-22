"""
routes/admin.py — Administrator endpoints (admin-only).

GET    /api/admin/stats               — system-wide totals
GET    /api/admin/users               — list all users with their data counts
PUT    /api/admin/users/<id>/status   — activate / deactivate a user account
DELETE /api/admin/users/<id>          — delete a user and all their data

Every endpoint is protected by @admin_required, which checks that the
authenticated user has is_admin = True.
"""

from functools import wraps
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from .. import db
from ..models.user import User
from ..models.transaction import Transaction
from ..models.budget import Budget
from ..models.goal import Goal

admin_bp = Blueprint("admin", __name__)


def admin_required(fn):
    """Allow the request only if the current user is an administrator."""
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = User.query.get(int(get_jwt_identity()))
        if not user or not user.is_admin:
            return jsonify({"error": "Administrator access required."}), 403
        return fn(*args, **kwargs)
    return wrapper


@admin_bp.get("/stats")
@admin_required
def stats():
    return jsonify({
        "users":         User.query.count(),
        "active_users":  User.query.filter_by(is_active=True).count(),
        "admins":        User.query.filter_by(is_admin=True).count(),
        "transactions":  Transaction.query.count(),
        "budgets":       Budget.query.count(),
        "goals":         Goal.query.count(),
    }), 200


@admin_bp.get("/users")
@admin_required
def list_users():
    out = []
    for u in User.query.order_by(User.created_at.desc()).all():
        d = u.to_dict()
        d["transactions"] = Transaction.query.filter_by(user_id=u.id).count()
        d["budgets"]      = Budget.query.filter_by(user_id=u.id).count()
        d["goals"]        = Goal.query.filter_by(user_id=u.id).count()
        out.append(d)
    return jsonify(out), 200


@admin_bp.put("/users/<int:uid>/status")
@admin_required
def set_status(uid):
    data   = request.get_json(force=True, silent=True) or {}
    active = bool(data.get("active", True))
    if uid == int(get_jwt_identity()):
        return jsonify({"error": "You cannot change your own account status."}), 400
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "User not found."}), 404
    user.is_active = active
    db.session.commit()
    return jsonify({"message": "Account updated.", "user": user.to_dict()}), 200


@admin_bp.delete("/users/<int:uid>")
@admin_required
def delete_user(uid):
    if uid == int(get_jwt_identity()):
        return jsonify({"error": "You cannot delete your own account here."}), 400
    user = User.query.get(uid)
    if not user:
        return jsonify({"error": "User not found."}), 404
    if user.is_admin:
        return jsonify({"error": "You cannot delete another administrator."}), 400
    db.session.delete(user)          # cascades to the user's transactions, budgets and goals
    db.session.commit()
    return jsonify({"message": "User deleted."}), 200
