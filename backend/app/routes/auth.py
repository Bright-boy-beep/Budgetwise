"""
routes/auth.py — Authentication endpoints.

POST /api/auth/register         — create a new user account
POST /api/auth/login            — authenticate and return a JWT
POST /api/auth/google           — sign in / register via Google ID token
POST /api/auth/forgot-password  — send a password-reset email
POST /api/auth/reset-password   — set a new password using a reset token
GET  /api/auth/me               — return the current user's profile (protected)
PUT  /api/auth/me               — update profile/preferences (protected)
PUT  /api/auth/change-password  — change account password (protected)
"""

import secrets
import bcrypt
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from flask_mail import Message

from .. import db, mail
from ..models.user import User
from ..services.auth_service import AuthService

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
    if not user or not user.password:
        # No account, or account was created via Google (no password set)
        return jsonify({"error": "Incorrect email or password."}), 401
    if not bcrypt.checkpw(password.encode(), user.password.encode()):
        return jsonify({"error": "Incorrect email or password."}), 401

    if not user.is_active:
        return jsonify({"error": "This account has been deactivated. Please contact the administrator."}), 403

    token = create_access_token(identity=str(user.id))
    return jsonify({"token": token, "user": user.to_dict()}), 200


@auth_bp.get("/google-client-id")
def google_client_id():
    """Return the Google OAuth client ID so the frontend can initialise GSI."""
    client_id = current_app.config.get("GOOGLE_CLIENT_ID", "")
    if not client_id:
        return jsonify({"error": "Google Sign-In not configured."}), 404
    return jsonify({"client_id": client_id}), 200


@auth_bp.post("/google")
def google_auth():
    """
    Verify a Google Identity Services ID token by calling Google's tokeninfo
    endpoint — no extra libraries required.
    Body: { "credential": "<google-id-token>" }
    """
    import urllib.request
    import urllib.parse
    import json as _json

    data       = request.get_json(force=True, silent=True) or {}
    credential = (data.get("credential") or "").strip()

    if not credential:
        return jsonify({"error": "Missing Google credential."}), 400

    client_id = current_app.config.get("GOOGLE_CLIENT_ID", "")
    if not client_id:
        return jsonify({"error": "Google Sign-In is not configured on this server."}), 500

    # Verify the ID token via Google's tokeninfo endpoint (no library needed)
    try:
        url      = f"https://oauth2.googleapis.com/tokeninfo?id_token={urllib.parse.quote(credential)}"
        req      = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            id_info = _json.loads(resp.read().decode())
    except Exception as e:
        return jsonify({"error": f"Could not verify Google token: {str(e)}"}), 401

    # Confirm the token was issued for our app
    if id_info.get("aud") != client_id:
        return jsonify({"error": "Token audience mismatch."}), 401

    google_id  = id_info.get("sub", "")
    email      = id_info.get("email", "")
    name       = id_info.get("name") or (email.split("@")[0] if email else "User")
    avatar_url = id_info.get("picture")

    if not google_id or not email:
        return jsonify({"error": "Incomplete profile returned by Google."}), 400

    user  = AuthService.get_or_create_google_user(google_id, email, name, avatar_url)
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


@auth_bp.delete("/me")
@jwt_required()
def delete_account():
    """
    Permanently delete the authenticated user's account and all their data.
    Requires the user to confirm by sending their email address in the body.
    Body: { "email": "<user's email>" }
    """
    user_id = int(get_jwt_identity())
    user    = User.query.get_or_404(user_id)
    data    = request.get_json(force=True, silent=True) or {}

    confirmed_email = (data.get("email") or "").strip().lower()
    if confirmed_email != user.email:
        return jsonify({"error": "Email address does not match. Account not deleted."}), 400

    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "Account deleted successfully."}), 200


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


# ── Forgot Password ───────────────────────────────────────────────────────

@auth_bp.post("/forgot-password")
def forgot_password():
    """
    Generate a one-time reset token and send it to the user's email.
    Always returns 200 so we don't leak whether an email is registered.
    """
    data  = request.get_json(force=True, silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    if not email:
        return jsonify({"error": "Email is required."}), 400

    user = User.query.filter_by(email=email).first()

    # Even when user not found, return success (don't reveal account existence)
    if user and user.password is not None:
        token  = secrets.token_urlsafe(32)
        expiry = datetime.utcnow() + timedelta(hours=1)

        user.reset_token        = token
        user.reset_token_expiry = expiry
        db.session.commit()

        base_url   = current_app.config.get("APP_BASE_URL", "http://localhost:5000")
        reset_link = f"{base_url}/?reset_token={token}"

        _send_reset_email(user, reset_link)

    return jsonify({"message": "If that email is registered, a reset link has been sent."}), 200


def _send_reset_email(user, reset_link):
    """Send the reset email, or fall back to printing the link in the console."""
    username = current_app.config.get("MAIL_USERNAME", "")

    if not username:
        # SMTP not configured — show the link in the terminal for development
        print("\n" + "="*60)
        print("  [BudgetWise] Password reset link (dev mode — no SMTP set)")
        print(f"  User : {user.email}")
        print(f"  Link : {reset_link}")
        print("="*60 + "\n")
        return

    try:
        msg = Message(
            subject="Reset your BudgetWise password",
            recipients=[user.email],
        )
        msg.html = f"""
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f9f9f9;border-radius:12px">
          <img src="https://i.imgur.com/placeholder.png" alt="BudgetWise" style="height:36px;margin-bottom:24px" onerror="this.style.display='none'"/>
          <h2 style="color:#1A1033;margin:0 0 8px">Reset your password</h2>
          <p style="color:#6B6080;margin:0 0 24px">Hi {user.name}, click the button below to set a new password.
             This link expires in <strong>1 hour</strong>.</p>
          <a href="{reset_link}"
             style="display:inline-block;padding:12px 28px;background:#7B5CF5;color:#fff;
                    border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
            Reset Password
          </a>
          <p style="color:#9E99B8;font-size:12px;margin-top:32px">
            If you didn't request this, you can safely ignore this email.<br/>
            Link: <a href="{reset_link}" style="color:#7B5CF5">{reset_link}</a>
          </p>
        </div>
        """
        mail.send(msg)
    except Exception as e:
        print(f"[BudgetWise] Failed to send reset email to {user.email}: {e}")
        print(f"[BudgetWise] Reset link (fallback): {reset_link}")


# ── Reset Password ────────────────────────────────────────────────────────

@auth_bp.post("/reset-password")
def reset_password():
    """
    Consume a reset token and set a new password.
    Body: { "token": "...", "password": "..." }
    """
    data     = request.get_json(force=True, silent=True) or {}
    token    = (data.get("token")    or "").strip()
    password = (data.get("password") or "").strip()

    if not token or not password:
        return jsonify({"error": "Token and password are required."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    user = User.query.filter_by(reset_token=token).first()

    if not user or not user.reset_token_expiry:
        return jsonify({"error": "This reset link is invalid."}), 400
    if datetime.utcnow() > user.reset_token_expiry:
        return jsonify({"error": "This reset link has expired. Please request a new one."}), 400

    # All good — update password and invalidate the token
    user.password           = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    user.reset_token        = None
    user.reset_token_expiry = None
    db.session.commit()

    return jsonify({"message": "Password updated successfully. You can now sign in."}), 200
