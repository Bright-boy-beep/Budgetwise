"""
utils/helpers.py — Shared utility functions.
"""

from datetime import date
from calendar import monthrange


def current_month_str() -> str:
    """Return today's month as 'YYYY-MM'."""
    return date.today().strftime("%Y-%m")


def month_date_range(month_str: str) -> tuple[date, date]:
    """
    Return (first_day, last_day) for a 'YYYY-MM' string.

    Example:
        month_date_range("2025-03") → (date(2025, 3, 1), date(2025, 3, 31))
    """
    year, month = int(month_str[:4]), int(month_str[5:7])
    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def success_response(data, status=200):
    """Wrap data in a standard success envelope."""
    from flask import jsonify
    return jsonify({"status": "success", "data": data}), status


def error_response(message: str, status=400):
    """Wrap an error message in a standard error envelope."""
    from flask import jsonify
    return jsonify({"status": "error", "message": message}), status
