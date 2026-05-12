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
        if user and AuthService.check_password(password, user.password):
            return user
        return None
