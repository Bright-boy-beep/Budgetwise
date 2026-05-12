"""
models/transaction.py — Transaction database model.
"""

from datetime import datetime
from .. import db


class Transaction(db.Model):
    __tablename__ = "transactions"

    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    type        = db.Column(db.String(10), nullable=False)       # "income" | "expense"
    description = db.Column(db.String(255), nullable=False)
    amount      = db.Column(db.Float, nullable=False)
    date        = db.Column(db.Date, nullable=False)
    category    = db.Column(db.String(80), nullable=False)
    note        = db.Column(db.Text, default="")

    # ML-generated fields
    predicted_category  = db.Column(db.String(80), nullable=True)
    is_anomaly          = db.Column(db.Boolean, default=False)

    # Recurring transaction fields
    recurrence      = db.Column(db.String(10), nullable=True)   # daily/weekly/monthly/yearly
    next_due        = db.Column(db.String(10), nullable=True)   # YYYY-MM-DD
    recurrence_end  = db.Column(db.String(10), nullable=True)   # YYYY-MM-DD (optional)

    created_at  = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at  = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id":                 self.id,
            "user_id":            self.user_id,
            "type":               self.type,
            "description":        self.description,
            "amount":             self.amount,
            "date":               self.date.isoformat(),
            "category":           self.category,
            "note":               self.note,
            "predicted_category": self.predicted_category,
            "is_anomaly":         self.is_anomaly,
            "recurrence":         self.recurrence,
            "next_due":           self.next_due,
            "recurrence_end":     self.recurrence_end,
            "created_at":         self.created_at.isoformat(),
        }

    def __repr__(self):
        return f"<Transaction {self.type} ₦{self.amount} on {self.date}>"
