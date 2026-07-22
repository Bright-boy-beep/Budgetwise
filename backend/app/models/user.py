"""
models/user.py — User database model.
"""

from datetime import datetime
from .. import db


class User(db.Model):
    __tablename__ = "users"

    id         = db.Column(db.Integer, primary_key=True)
    name       = db.Column(db.String(120), nullable=False)
    email      = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password   = db.Column(db.String(255), nullable=True)        # bcrypt hash; NULL for Google-only accounts
    google_id  = db.Column(db.String(255), unique=True, nullable=True, index=True)  # Google sub claim
    avatar_url = db.Column(db.String(512), nullable=True)        # Google profile picture
    currency        = db.Column(db.String(10),  default="₦")
    theme           = db.Column(db.String(10),  default="light")
    opening_balance = db.Column(db.Float,       default=0.0)
    created_at      = db.Column(db.DateTime,    default=datetime.utcnow)
    reset_token        = db.Column(db.String(128), nullable=True, index=True)
    reset_token_expiry = db.Column(db.DateTime,    nullable=True)
    is_admin           = db.Column(db.Boolean, default=False, nullable=False)
    is_active          = db.Column(db.Boolean, default=True,  nullable=False)

    # Relationships
    transactions = db.relationship("Transaction", backref="owner", lazy=True, cascade="all, delete-orphan")
    budgets      = db.relationship("Budget",      backref="owner", lazy=True, cascade="all, delete-orphan")
    goals        = db.relationship("Goal",        backref="owner", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":              self.id,
            "name":            self.name,
            "email":           self.email,
            "avatar_url":      self.avatar_url,
            "has_password":    self.password is not None,   # lets frontend know if password exists
            "currency":        self.currency,
            "theme":           self.theme,
            "opening_balance": self.opening_balance or 0.0,
            "is_admin":        bool(self.is_admin),
            "is_active":       bool(self.is_active if self.is_active is not None else True),
            "created_at":      self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<User {self.email}>"
