"""
models/budget.py — Budget database model.
"""

from datetime import datetime
from .. import db


class Budget(db.Model):
    __tablename__ = "budgets"

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    category   = db.Column(db.String(80), nullable=False)
    limit      = db.Column(db.Float, nullable=False)
    month      = db.Column(db.String(7), nullable=False)        # format: "YYYY-MM"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # ML-generated field
    ml_suggested_limit = db.Column(db.Float, nullable=True)     # ML-recommended budget limit

    __table_args__ = (
        db.UniqueConstraint("user_id", "category", "month", name="uq_user_category_month"),
    )

    def to_dict(self):
        return {
            "id":                 self.id,
            "user_id":            self.user_id,
            "category":           self.category,
            "limit":              self.limit,
            "month":              self.month,
            "ml_suggested_limit": self.ml_suggested_limit,
            "created_at":         self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Budget {self.category} ₦{self.limit} ({self.month})>"
