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
    password   = db.Column(db.String(255), nullable=False)       # bcrypt hash
    currency        = db.Column(db.String(10),  default="₦")
    theme           = db.Column(db.String(10),  default="light")
    opening_balance = db.Column(db.Float,       default=0.0)
    created_at      = db.Column(db.DateTime,    default=datetime.utcnow)

    # Relationships
    transactions = db.relationship("Transaction", backref="owner", lazy=True, cascade="all, delete-orphan")
    budgets      = db.relationship("Budget",      backref="owner", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id":              self.id,
            "name":            self.name,
            "email":           self.email,
            "currency":        self.currency,
            "theme":           self.theme,
            "opening_balance": self.opening_balance or 0.0,
            "created_at":      self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<User {self.email}>"
