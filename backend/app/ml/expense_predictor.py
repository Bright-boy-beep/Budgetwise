"""
ml/expense_predictor.py — Expense forecasting module.

Strategy: weighted moving average over the user's last N months of spending
per category.  More recent months receive higher weight.  Works as soon as
the user has at least 1 month of transactions.

Budget suggestions = predicted amount × BUDGET_BUFFER (default 1.10 → +10%).
"""

import numpy as np
from collections import defaultdict
from datetime import date, datetime

BUDGET_BUFFER   = 1.10   # suggest 10 % above the forecast
MAX_MONTHS_BACK = 6      # look at most 6 months of history


class ExpensePredictor:
    """
    Stateless weighted-average expense predictor.
    All methods accept a list of Transaction model objects directly.
    """

    # ──────────────────────────────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────────────────────────────

    def predict_next_month(self, transactions: list) -> dict:
        """
        Predict next month's spending per expense category.

        Args:
            transactions: All of the user's Transaction objects.

        Returns:
            {
                "month": "YYYY-MM",
                "predictions": [
                    {"category": "Food & Dining", "predicted_amount": 35000.0,
                     "months_used": 3},
                    ...
                ]
            }
        """
        today      = date.today()
        next_month = _add_months(today, 1)
        monthly    = _monthly_totals(transactions, tx_type="expense")

        if not monthly:
            return {"month": next_month.strftime("%Y-%m"), "predictions": []}

        # Determine the last MAX_MONTHS_BACK months we have data for
        all_months = sorted(monthly.keys(), reverse=True)[:MAX_MONTHS_BACK]
        all_cats   = set(
            cat for ym in all_months for cat in monthly.get(ym, {})
        )

        predictions = []
        for cat in sorted(all_cats):
            # Collect monthly amounts for this category (oldest first)
            hist = []
            for ym in reversed(all_months):
                hist.append(monthly.get(ym, {}).get(cat, 0.0))

            predicted = _weighted_average(hist)
            predictions.append({
                "category":         cat,
                "predicted_amount": round(predicted, 2),
                "months_used":      len(all_months),
            })

        # Sort by predicted amount descending
        predictions.sort(key=lambda x: x["predicted_amount"], reverse=True)

        return {
            "month":       next_month.strftime("%Y-%m"),
            "predictions": predictions,
        }

    def suggest_budgets(self, transactions: list) -> list:
        """
        Suggest monthly budget limits: forecast × BUDGET_BUFFER.

        Returns:
            [{"category": "Food & Dining", "suggested_limit": 38500.0}, ...]
        """
        forecast = self.predict_next_month(transactions)
        suggestions = []
        for p in forecast["predictions"]:
            if p["predicted_amount"] > 0:
                suggestions.append({
                    "category":       p["category"],
                    "suggested_limit": round(p["predicted_amount"] * BUDGET_BUFFER, 2),
                    "based_on":        p["predicted_amount"],
                })
        return suggestions

    def spending_trend(self, transactions: list) -> list:
        """
        Return month-by-month total expense for charting.

        Returns:
            [{"month": "2025-01", "total": 85000.0}, ...]
        """
        monthly = _monthly_totals(transactions, tx_type="expense")
        return [
            {"month": ym, "total": round(sum(cats.values()), 2)}
            for ym, cats in sorted(monthly.items())
        ]


# ─── Private helpers ─────────────────────────────────────────────────────────

def _monthly_totals(transactions: list, tx_type: str = "expense") -> dict:
    """
    Aggregate transaction amounts into {YYYY-MM: {category: total}}.
    """
    result = defaultdict(lambda: defaultdict(float))
    for tx in transactions:
        if tx.type != tx_type:
            continue
        ym = tx.date.strftime("%Y-%m") if hasattr(tx.date, "strftime") else str(tx.date)[:7]
        result[ym][tx.category] += tx.amount
    # Convert inner defaultdicts to plain dicts
    return {ym: dict(cats) for ym, cats in result.items()}


def _weighted_average(values: list) -> float:
    """
    Compute a linearly-weighted average where the last element has the
    highest weight.  e.g. weights [1,2,3] for 3 months means the most
    recent month counts 3×.
    """
    if not values:
        return 0.0
    n       = len(values)
    weights = np.arange(1, n + 1, dtype=float)
    return float(np.average(values, weights=weights))


def _add_months(d: date, months: int) -> date:
    """Return the date *months* months after *d*, clamped to valid day."""
    month = d.month - 1 + months
    year  = d.year + month // 12
    month = month % 12 + 1
    day   = min(d.day, [31,28,31,30,31,30,31,31,30,31,30,31][month - 1])
    return date(year, month, day)
