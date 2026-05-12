"""
routes/auth.py — Authentication endpoints.

POST /api/auth/register         — create a new user account
POST /api/auth/login            — authenticate and return a JWT
GET  /api/auth/me               — return the current user's profile (protected)
PUT  /api/auth/me               — update profile/preferences (protected)
PUT  /api/auth/change-password  — change account password (protected)
"""

import bcrypt
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity

from .. import db
from ..models.user import User

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/register")
def register():
    # force=True accepts the body even if Content-Type header is missing
    # silent=True returns None instead of raising an error on bad JSON
    data = request.get_json(force=True, silent=True) or {}

    name     = (data.get("name",     "") or "").strip()
    email    = (data.get("email",    "") or "").strip().lower()
    password =  data.get("password", "") or ""

    if not name or not email or not password:
        return jsonify({"error": "All fields are required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 409

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user   = User(name=name, email=email, password=hashed)
    db.session.add(user)
    db.session.commit()

    # Identity must be a string for Flask-JWT-Extended 4.x
    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "user": user.to_dict()}), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(force=True, silent=True) or {}

    email    = (data.get("email",    "") or "").strip().lower()
    password =  data.get("password", "") or ""

    if not email or not password:
        return jsonify({"error": "All fields are required."}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.checkpw(password.encode(), user.password.encode()):
        return jsonify({"error": "Incorrect email or password."}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "user": user.to_dict()}), 200


@auth_bp.get("/me")
@jwt_required()
def get_me():
    user_id = int(get_jwt_identity())
    user    = User.query.get_or_404(user_id)
    return jsonify(user.to_dict()), 200


@auth_bp.put("/me")
@jwt_required()
def update_me():
    user_id = int(get_jwt_identity())
    user    = User.query.get_or_404(user_id)
    data    = request.get_json(force=True, silent=True) or {}

    if "name"            in data: user.name            = data["name"].strip()
    if "currency"        in data: user.currency        = data["currency"]
    if "theme"           in data: user.theme           = data["theme"]
    if "opening_balance" in data: user.opening_balance = float(data["opening_balance"] or 0)

    db.session.commit()
    return jsonify(user.to_dict()), 200


@auth_bp.put("/change-password")
@jwt_required()
def change_password():
    user_id = int(get_jwt_identity())
    user    = User.query.get_or_404(user_id)
    data    = request.get_json(force=True, silent=True) or {}

    current_password = data.get("current_password", "") or ""
    new_password     = data.get("new_password",     "") or ""

    if not current_password or not new_password:
        return jsonify({"error": "Both current and new password are required."}), 400
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters."}), 400
    if not bcrypt.checkpw(current_password.encode(), user.password.encode()):
        return jsonify({"error": "Current password is incorrect."}), 401

    user.password = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
    db.session.commit()
    return jsonify({"message": "Password updated successfully."}), 200
