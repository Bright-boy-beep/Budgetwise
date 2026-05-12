"""
ml/anomaly_detector.py — Spending anomaly detection module.

Strategy: per-user, per-category Z-score computed live from the user's own
transaction history.  No pre-saved model file is required — detection works
as soon as the user has at least MIN_SAMPLES expenses in a category.

Z-score threshold: |z| >= 2.0  →  flag as anomaly.
Minimum samples per category required before we start flagging: 4
"""

import numpy as np
from collections import defaultdict

Z_SCORE_THRESHOLD = 2.0   # flag if |z| >= this value
MIN_SAMPLES       = 4     # must have at least this many expenses per category


class AnomalyDetector:
    """
    Stateless Z-score anomaly detector.
    Call detect(transactions) with the user's expense Transaction objects.
    """

    # ──────────────────────────────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────────────────────────────

    def detect(self, transactions: list) -> list:
        """
        Detect anomalous transactions using per-category Z-score.

        Args:
            transactions: List of Transaction model objects (already filtered to
                          the current user's expenses by the calling route).

        Returns:
            List of dicts describing anomalous transactions, sorted by
            |z_score| descending.
        """
        # ── 1. Bucket amounts by category ─────────────────────────────────────
        buckets = defaultdict(list)
        for tx in transactions:
            if tx.type == "expense":
                buckets[tx.category].append(tx.amount)

        # ── 2. Compute per-category baseline ──────────────────────────────────
        stats = {}
        for cat, amounts in buckets.items():
            if len(amounts) >= MIN_SAMPLES:
                arr  = np.array(amounts, dtype=float)
                mean = float(arr.mean())
                std  = float(arr.std())
                if std > 0:
                    stats[cat] = {"mean": mean, "std": std}

        if not stats:
            return []   # not enough data yet

        # ── 3. Score every expense transaction ────────────────────────────────
        anomalies = []
        for tx in transactions:
            if tx.type != "expense":
                continue
            cat_stats = stats.get(tx.category)
            if cat_stats is None:
                continue   # category has too few samples

            mean, std = cat_stats["mean"], cat_stats["std"]
            z = (tx.amount - mean) / std

            if abs(z) >= Z_SCORE_THRESHOLD:
                direction = "above" if z > 0 else "below"
                anomalies.append({
                    "transaction_id": tx.id,
                    "description":    tx.description,
                    "amount":         tx.amount,
                    "category":       tx.category,
                    "date":           tx.date.isoformat(),
                    "z_score":        round(z, 2),
                    "category_mean":  round(mean, 2),
                    "reason": (
                        f"₦{tx.amount:,.0f} is {abs(z):.1f}× your usual {tx.category} spend "
                        f"(avg ₦{mean:,.0f})."
                    ),
                })

        return sorted(anomalies, key=lambda a: abs(a["z_score"]), reverse=True)

    # ──────────────────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────────────────

    def category_stats(self, transactions: list) -> dict:
        """
        Return per-category stats (mean, std, count) for all expense
        transactions.  Useful for the /insights endpoint.
        """
        buckets = defaultdict(list)
        for tx in transactions:
            if tx.type == "expense":
                buckets[tx.category].append(tx.amount)

        result = {}
        for cat, amounts in buckets.items():
            arr = np.array(amounts, dtype=float)
            result[cat] = {
                "mean":  round(float(arr.mean()), 2),
                "std":   round(float(arr.std()),  2),
                "count": len(amounts),
                "total": round(float(arr.sum()),  2),
            }
        return result
