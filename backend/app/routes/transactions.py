"""
routes/transactions.py — Transaction CRUD + recurring engine.

GET    /api/transactions/                  — list all transactions
POST   /api/transactions/                  — create a transaction
GET    /api/transactions/<id>              — get single transaction
PUT    /api/transactions/<id>              — update transaction
DELETE /api/transactions/<id>             — delete transaction
POST   /api/transactions/process-recurring — generate due recurring copies
DELETE /api/transactions/<id>/recurrence  — stop a recurring schedule
GET    /api/transactions/summary          — monthly summary
"""

import calendar
import logging
from datetime import date, timedelta
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from .. import db
from ..models.transaction import Transaction

logger          = logging.getLogger(__name__)
transactions_bp = Blueprint("transactions", __name__)

VALID_RECURRENCES = {"daily", "weekly", "monthly", "yearly"}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _advance_date(date_str: str, interval: str) -> str:
    """Return the next due date string after advancing by one interval."""
    d = date.fromisoformat(date_str)
    if interval == "daily":
        d += timedelta(days=1)
    elif interval == "weekly":
        d += timedelta(weeks=1)
    elif interval == "monthly":
        month = d.month + 1
        year  = d.year
        if month > 12:
            month = 1
            year += 1
        max_day = calendar.monthrange(year, month)[1]
        d = date(year, month, min(d.day, max_day))
    elif interval == "yearly":
        year    = d.year + 1
        max_day = calendar.monthrange(year, d.month)[1]
        d = date(year, d.month, min(d.day, max_day))
    return d.isoformat()


def _compute_next_due(from_date: str, interval: str) -> str:
    """First next_due = one interval after the transaction date."""
    return _advance_date(from_date, interval)


def _process_recurring_for_user(user_id: int) -> list:
    """
    Check all active recurring transactions for this user.
    For each one whose next_due is today or earlier, generate a new
    transaction copy and advance next_due. Returns list of new tx dicts.
    """
    today   = date.today().isoformat()
    sources = Transaction.query.filter(
        Transaction.user_id    == user_id,
        Transaction.recurrence != None,
        Transaction.next_due   != None,
        Transaction.next_due   <= today,
    ).all()

    generated = []
    for src in sources:
        # Stop if past end date
        if src.recurrence_end and src.next_due > src.recurrence_end:
            src.recurrence = None
            src.next_due   = None
            continue

        # Guard: don't create duplicates (same source + same date)
        exists = Transaction.query.filter_by(
            user_id     = user_id,
            description = src.description,
            amount      = src.amount,
            date        = date.fromisoformat(src.next_due),
            category    = src.category,
        ).first()

        if not exists:
            copy = Transaction(
                user_id     = user_id,
                type        = src.type,
                description = src.description,
                amount      = src.amount,
                date        = date.fromisoformat(src.next_due),
                category    = src.category,
                note        = src.note or "",
                recurrence  = None,   # copies are NOT recurring themselves
                next_due    = None,
            )
            db.session.add(copy)
            generated.append(copy)

        # Advance next_due (may need multiple jumps if app was offline a while)
        while src.next_due <= today:
            src.next_due = _advance_date(src.next_due, src.recurrence)
            if src.recurrence_end and src.next_due > src.recurrence_end:
                src.recurrence = None
                src.next_due   = None
                break

    if generated or sources:
        db.session.commit()

    return [t.to_dict() for t in generated]


# ─── Routes ───────────────────────────────────────────────────────────────────

@transactions_bp.get("/")
@jwt_required()
def list_transactions():
    user_id  = int(get_jwt_identity())
    tx_type  = request.args.get("type")
    category = request.args.get("category")
    month    = request.args.get("month")

    query = Transaction.query.filter_by(user_id=user_id)
    if tx_type:  query = query.filter_by(type=tx_type)
    if category: query = query.filter_by(category=category)
    if month:    query = query.filter(Transaction.date.like(f"{month}%"))

    txs = query.order_by(Transaction.date.desc()).all()
    return jsonify([t.to_dict() for t in txs]), 200


@transactions_bp.post("/process-recurring")
@jwt_required()
def process_recurring():
    """Called on app load to generate any due recurring transactions."""
    user_id   = int(get_jwt_identity())
    generated = _process_recurring_for_user(user_id)
    return jsonify({"generated": len(generated), "transactions": generated}), 200


@transactions_bp.post("/")
@jwt_required()
def create_transaction():
    user_id = int(get_jwt_identity())
    data    = request.get_json(force=True, silent=True) or {}

    required = ("type", "description", "amount", "date", "category")
    missing  = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400

    recurrence = data.get("recurrence") or None
    if recurrence and recurrence not in VALID_RECURRENCES:
        return jsonify({"error": f"Invalid recurrence. Use: {', '.join(VALID_RECURRENCES)}"}), 400

    next_due       = _compute_next_due(data["date"], recurrence) if recurrence else None
    recurrence_end = data.get("recurrence_end") or None

    tx = Transaction(
        user_id        = user_id,
        type           = data["type"],
        description    = data["description"].strip(),
        amount         = float(data["amount"]),
        date           = date.fromisoformat(data["date"]),
        category       = data["category"],
        note           = data.get("note", ""),
        recurrence     = recurrence,
        next_due       = next_due,
        recurrence_end = recurrence_end,
    )
    db.session.add(tx)
    db.session.commit()
    return jsonify(tx.to_dict()), 201


@transactions_bp.get("/summary")
@jwt_required()
def summary():
    user_id = int(get_jwt_identity())
    month   = request.args.get("month") or date.today().strftime("%Y-%m")

    txs = Transaction.query.filter(
        Transaction.user_id == user_id,
        Transaction.date.like(f"{month}%")
    ).all()

    income  = sum(t.amount for t in txs if t.type == "income")
    expense = sum(t.amount for t in txs if t.type == "expense")
    return jsonify({"month": month, "income": income, "expense": expense, "balance": income - expense}), 200


@transactions_bp.get("/<int:tx_id>")
@jwt_required()
def get_transaction(tx_id):
    user_id = int(get_jwt_identity())
    tx = Transaction.query.filter_by(id=tx_id, user_id=user_id).first_or_404()
    return jsonify(tx.to_dict()), 200


@transactions_bp.put("/<int:tx_id>")
@jwt_required()
def update_transaction(tx_id):
    user_id = int(get_jwt_identity())
    tx      = Transaction.query.filter_by(id=tx_id, user_id=user_id).first_or_404()
    data    = request.get_json(force=True, silent=True) or {}

    if "description"    in data: tx.description = data["description"].strip()
    if "amount"         in data: tx.amount       = float(data["amount"])
    if "date"           in data: tx.date         = date.fromisoformat(data["date"])
    if "category"       in data: tx.category     = data["category"]
    if "note"           in data: tx.note         = data.get("note", "")
    if "recurrence_end" in data: tx.recurrence_end = data.get("recurrence_end") or None

    # Recurrence change: recompute next_due
    if "recurrence" in data:
        recurrence = data["recurrence"] or None
        if recurrence and recurrence not in VALID_RECURRENCES:
            return jsonify({"error": "Invalid recurrence value."}), 400
        tx.recurrence = recurrence
        tx.next_due   = _compute_next_due(tx.date.isoformat(), recurrence) if recurrence else None

    db.session.commit()
    return jsonify(tx.to_dict()), 200


@transactions_bp.delete("/<int:tx_id>/recurrence")
@jwt_required()
def stop_recurrence(tx_id):
    """Stop a recurring schedule without deleting the transaction."""
    user_id = int(get_jwt_identity())
    tx = Transaction.query.filter_by(id=tx_id, user_id=user_id).first_or_404()
    tx.recurrence     = None
    tx.next_due       = None
    tx.recurrence_end = None
    db.session.commit()
    return jsonify(tx.to_dict()), 200


@transactions_bp.delete("/<int:tx_id>")
@jwt_required()
def delete_transaction(tx_id):
    user_id = int(get_jwt_identity())
    tx = Transaction.query.filter_by(id=tx_id, user_id=user_id).first_or_404()
    db.session.delete(tx)
    db.session.commit()
    return jsonify({"message": "Transaction deleted."}), 200
