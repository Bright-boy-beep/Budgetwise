"""
services/transaction_service.py — Business logic for transactions.
Keeps route handlers thin and logic reusable.
"""

from .. import db
from ..models.transaction import Transaction


class TransactionService:

    @staticmethod
    def get_user_transactions(user_id: int, tx_type=None, category=None, month=None):
        query = Transaction.query.filter_by(user_id=user_id)
        if tx_type:  query = query.filter_by(type=tx_type)
        if category: query = query.filter_by(category=category)
        if month:    query = query.filter(Transaction.date.like(f"{month}%"))
        return query.order_by(Transaction.date.desc()).all()

    @staticmethod
    def get_monthly_summary(user_id: int, month: str) -> dict:
        txs = Transaction.query.filter(
            Transaction.user_id == user_id,
            Transaction.date.like(f"{month}%")
        ).all()
        income  = sum(t.amount for t in txs if t.type == "income")
        expense = sum(t.amount for t in txs if t.type == "expense")
        return {"month": month, "income": income, "expense": expense, "balance": income - expense}

    @staticmethod
    def classify_category_async(transaction_id: int):
        """
        Placeholder for background ML classification.
        In production, dispatch this to a Celery task or a thread pool.
        """
        # TODO: implement async classification
        pass
