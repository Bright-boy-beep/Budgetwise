"""
models/goal.py — Savings Goal database model.
"""

from datetime import datetime
from .. import db


class Goal(db.Model):
    __tablename__ = "goals"

    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    name          = db.Column(db.String(120), nullable=False)
    category      = db.Column(db.String(40), nullable=False, default="Other")
    target_amount = db.Column(db.Float, nullable=False)
    saved_amount  = db.Column(db.Float, nullable=False, default=0.0)
    deadline      = db.Column(db.String(10), nullable=True)   # "YYYY-MM-DD" or null
    color         = db.Column(db.String(20), nullable=False, default="#7B5CF5")
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        pct = round((self.saved_amount / self.target_amount) * 100, 1) if self.target_amount else 0
        return {
            "id":            self.id,
            "user_id":       self.user_id,
            "name":          self.name,
            "category":      self.category,
            "target_amount": self.target_amount,
            "saved_amount":  self.saved_amount,
            "deadline":      self.deadline,
            "color":         self.color,
            "percent":       min(pct, 100),
            "completed":     self.saved_amount >= self.target_amount,
            "created_at":    self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Goal {self.name} {self.saved_amount}/{self.target_amount}>"
