"""
services/auth_service.py — Authentication helpers.
"""

import bcrypt
from ..models.user import User
from .. import db


class AuthService:

    @staticmethod
    def hash_password(plain: str) -> str:
        return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

    @staticmethod
    def check_password(plain: str, hashed: str) -> bool:
        return bcrypt.checkpw(plain.encode(), hashed.encode())

    @staticmethod
    def create_user(name: str, email: str, password: str) -> User | None:
        if User.query.filter_by(email=email.lower()).first():
            return None   # email already registered
        hashed = AuthService.hash_password(password)
        user = User(name=name.strip(), email=email.lower(), password=hashed)
        db.session.add(user)
        db.session.commit()
        return user

    @staticmethod
    def authenticate(email: str, password: str) -> User | None:
        user = User.query.filter_by(email=email.lower()).first()
        if user and user.password and AuthService.check_password(password, user.password):
            return user
        return None

    @staticmethod
    def get_or_create_google_user(google_id: str, email: str, name: str, avatar_url: str | None) -> User:
        """
        Find an existing user by google_id or email, link their Google account
        if not already linked, and return the user. Creates a new account on
        first Google sign-in.
        """
        email = email.lower()

        # 1. Already has a linked Google account
        user = User.query.filter_by(google_id=google_id).first()
        if user:
            # Refresh avatar in case it changed
            if avatar_url and user.avatar_url != avatar_url:
                user.avatar_url = avatar_url
                db.session.commit()
            return user

        # 2. Email already registered (password account) — link Google to it
        user = User.query.filter_by(email=email).first()
        if user:
            user.google_id  = google_id
            user.avatar_url = avatar_url or user.avatar_url
            db.session.commit()
            return user

        # 3. Brand-new user — create account, no password needed
        user = User(
            name=name.strip(),
            email=email,
            password=None,
            google_id=google_id,
            avatar_url=avatar_url,
        )
        db.session.add(user)
        db.session.commit()
        return user
