"""
routes/predictions.py — ML prediction endpoints.

GET  /api/ml/insights           — all ML data in one call (preferred)
GET  /api/ml/forecast           — predicted expenses for next month
GET  /api/ml/anomalies          — anomalous transactions for current user
POST /api/ml/classify           — auto-classify a transaction description
GET  /api/ml/budget-suggestions — ML-recommended budget limits per category
"""

import logging
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..ml.expense_predictor   import ExpensePredictor
from ..ml.anomaly_detector    import AnomalyDetector
from ..ml.category_classifier import CategoryClassifier
from ..models.transaction     import Transaction

logger = logging.getLogger(__name__)

predictions_bp = Blueprint("predictions", __name__)

# ─── Lazy-load singletons ────────────────────────────────────────────────────
_predictor  = None
_detector   = None
_classifier = None


def _get_predictor():
    global _predictor
    if _predictor is None:
        _predictor = ExpensePredictor()
    return _predictor


def _get_detector():
    global _detector
    if _detector is None:
        _detector = AnomalyDetector()
    return _detector


def _get_classifier():
    global _classifier
    if _classifier is None:
        _classifier = CategoryClassifier()
    return _classifier


# ─── Helper ──────────────────────────────────────────────────────────────────

def _user_transactions(user_id: int):
    """Return all Transaction rows for this user."""
    return Transaction.query.filter_by(user_id=user_id).all()


# ─── Routes ──────────────────────────────────────────────────────────────────

@predictions_bp.get("/insights")
@jwt_required()
def insights():
    """
    Return all ML data in a single call.  The frontend loads this once when
    the ML Insights page is opened.
    """
    user_id = int(get_jwt_identity())
    txs     = _user_transactions(user_id)

    # ── Forecast + budget suggestions ─────────────────────────────────────────
    try:
        forecast     = _get_predictor().predict_next_month(txs)
        suggestions  = _get_predictor().suggest_budgets(txs)
        trend        = _get_predictor().spending_trend(txs)
    except Exception as e:
        logger.error(f"Predictor error: {e}")
        forecast    = {"month": "", "predictions": []}
        suggestions = []
        trend       = []

    # ── Anomalies ─────────────────────────────────────────────────────────────
    try:
        anomalies = _get_detector().detect(txs)
        cat_stats = _get_detector().category_stats(txs)
    except Exception as e:
        logger.error(f"Detector error: {e}")
        anomalies = []
        cat_stats = {}

    return jsonify({
        "forecast":          forecast,
        "budget_suggestions": suggestions,
        "trend":             trend,
        "anomalies":         anomalies,
        "category_stats":    cat_stats,
    }), 200


@predictions_bp.get("/forecast")
@jwt_required()
def forecast():
    """Return predicted category-level expenses for next month."""
    user_id = int(get_jwt_identity())
    txs     = _user_transactions(user_id)
    try:
        result = _get_predictor().predict_next_month(txs)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Forecast error: {e}")
        return jsonify({"error": str(e)}), 500


@predictions_bp.get("/anomalies")
@jwt_required()
def anomalies():
    """Return transactions flagged as anomalous for the current user."""
    user_id = int(get_jwt_identity())
    txs     = _user_transactions(user_id)
    try:
        flagged = _get_detector().detect(txs)
        return jsonify(flagged), 200
    except Exception as e:
        logger.error(f"Anomaly detection error: {e}")
        return jsonify({"error": str(e)}), 500


@predictions_bp.post("/classify")
@jwt_required()
def classify():
    """Predict the category for a given transaction description."""
    data        = request.get_json(force=True, silent=True) or {}
    description = (data.get("description") or "").strip()
    if not description:
        return jsonify({"error": "description is required."}), 400

    try:
        category    = _get_classifier().predict(description)
        suggestions = _get_classifier().top_suggestions(description, n=3)
        return jsonify({
            "predicted_category": category,
            "suggestions":        suggestions,
        }), 200
    except Exception as e:
        logger.error(f"Classifier error: {e}")
        return jsonify({"error": str(e)}), 500


@predictions_bp.get("/budget-suggestions")
@jwt_required()
def budget_suggestions():
    """Return ML-recommended monthly budget limits per spending category."""
    user_id = int(get_jwt_identity())
    txs     = _user_transactions(user_id)
    try:
        suggestions = _get_predictor().suggest_budgets(txs)
        return jsonify(suggestions), 200
    except Exception as e:
        logger.error(f"Budget suggestions error: {e}")
        return jsonify({"error": str(e)}), 500
