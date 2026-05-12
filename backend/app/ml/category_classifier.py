"""
ml/category_classifier.py — Transaction auto-categorisation module.

Uses TF-IDF + Logistic Regression trained on Nigerian transaction descriptions.
The model is trained automatically on first import (or when the saved file is
missing) so it works from day one with no separate notebook run needed.

Saved to: ml/saved_models/category_classifier.joblib
"""

import os
import re
import joblib
import logging

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "ml", "saved_models", "category_classifier.joblib"
)

# ─── Expense categories ────────────────────────────────────────────────────────
EXPENSE_CATEGORIES = [
    "Food & Dining", "Transportation", "Housing", "Entertainment",
    "Healthcare", "Shopping", "Education", "Utilities",
    "Travel", "Personal Care", "Savings", "Other",
]

# ─── Income categories ─────────────────────────────────────────────────────────
INCOME_CATEGORIES = [
    "Salary", "Freelance", "Business", "Investment", "Gift", "Rental", "Other Income",
]

CATEGORIES = EXPENSE_CATEGORIES + INCOME_CATEGORIES


# ─── Training corpus ──────────────────────────────────────────────────────────
# Each entry is (description, category). Rich Nigerian context included.
_TRAINING_DATA = [
    # ── Food & Dining ──────────────────────────────────────────────────────────
    ("shoprite grocery shopping", "Food & Dining"),
    ("shoprite supermarket", "Food & Dining"),
    ("spar supermarket groceries", "Food & Dining"),
    ("kfc chicken meal", "Food & Dining"),
    ("mr biggs fast food", "Food & Dining"),
    ("chicken republic lunch", "Food & Dining"),
    ("dominos pizza order", "Food & Dining"),
    ("pizza hut dinner", "Food & Dining"),
    ("tantalizers snacks", "Food & Dining"),
    ("tastee fried chicken", "Food & Dining"),
    ("cold stone creamery ice cream", "Food & Dining"),
    ("everyday restaurant lunch", "Food & Dining"),
    ("local restaurant dinner", "Food & Dining"),
    ("restaurant meal", "Food & Dining"),
    ("food delivery jumia food", "Food & Dining"),
    ("glovo food delivery", "Food & Dining"),
    ("foodcourt delivery", "Food & Dining"),
    ("market foodstuff purchase", "Food & Dining"),
    ("market groceries", "Food & Dining"),
    ("sunday market food items", "Food & Dining"),
    ("buka lunch", "Food & Dining"),
    ("mama put food", "Food & Dining"),
    ("bukateria pepper soup", "Food & Dining"),
    ("suya purchase", "Food & Dining"),
    ("pounded yam egusi soup", "Food & Dining"),
    ("jollof rice beans", "Food & Dining"),
    ("amala ewedu soup", "Food & Dining"),
    ("eba ogbono soup", "Food & Dining"),
    ("noodles indomie groceries", "Food & Dining"),
    ("bread butter eggs breakfast", "Food & Dining"),
    ("breakfast cereals milk", "Food & Dining"),
    ("coffee shawarma snack", "Food & Dining"),
    ("okin biscuits chinchin snacks", "Food & Dining"),
    ("drinks juice soft drinks", "Food & Dining"),
    ("water sachet pure water", "Food & Dining"),
    ("wine beer drinks", "Food & Dining"),
    ("rice tomatoes cooking ingredients", "Food & Dining"),
    ("palm oil seasoning foodstuff", "Food & Dining"),
    ("chinese restaurant", "Food & Dining"),
    ("sushi dinner", "Food & Dining"),
    ("cake pastry bakery", "Food & Dining"),
    ("sandwich lunch meal", "Food & Dining"),
    ("vegetable tomatoes pepper", "Food & Dining"),
    ("lunch food office", "Food & Dining"),
    ("party jollof catering food", "Food & Dining"),
    ("shawarma sharwarma wrap", "Food & Dining"),

    # ── Transportation ─────────────────────────────────────────────────────────
    ("uber ride trip", "Transportation"),
    ("bolt ride", "Transportation"),
    ("taxi cab fare", "Transportation"),
    ("danfo bus fare", "Transportation"),
    ("brt bus rapid transit", "Transportation"),
    ("molue fare", "Transportation"),
    ("okada motorcycle taxi", "Transportation"),
    ("keke napep tricycle", "Transportation"),
    ("minibus fare", "Transportation"),
    ("public transport fare", "Transportation"),
    ("petrol fuel filling", "Transportation"),
    ("fuel station diesel", "Transportation"),
    ("car maintenance service", "Transportation"),
    ("mechanic repair", "Transportation"),
    ("tyre change puncture", "Transportation"),
    ("engine oil change service", "Transportation"),
    ("car wash clean", "Transportation"),
    ("vehicle registration", "Transportation"),
    ("drivers license renewal", "Transportation"),
    ("vehicle insurance", "Transportation"),
    ("parking fee", "Transportation"),
    ("airport taxi", "Transportation"),
    ("ride hailing service", "Transportation"),
    ("innoson vehicle", "Transportation"),
    ("interstate bus fare", "Transportation"),
    ("agofure transport bus", "Transportation"),
    ("abc transport ticket", "Transportation"),
    ("g igwe transport", "Transportation"),
    ("overhead commercial bus", "Transportation"),
    ("fuel pump filling station", "Transportation"),
    ("car service dealership", "Transportation"),

    # ── Housing ────────────────────────────────────────────────────────────────
    ("monthly rent payment", "Housing"),
    ("rent landlord", "Housing"),
    ("house rent", "Housing"),
    ("apartment rent", "Housing"),
    ("estate service charge", "Housing"),
    ("estate levy", "Housing"),
    ("electricity bill nepa", "Housing"),
    ("nepa phcn electricity", "Housing"),
    ("water corporation bill", "Housing"),
    ("water rate", "Housing"),
    ("generator fuel diesel", "Housing"),
    ("generator maintenance service", "Housing"),
    ("house repairs plumbing", "Housing"),
    ("plumber service fee", "Housing"),
    ("electrician repair", "Housing"),
    ("building materials", "Housing"),
    ("painting house", "Housing"),
    ("security guard house", "Housing"),
    ("estate association dues", "Housing"),
    ("property caretaker", "Housing"),
    ("gate man salary", "Housing"),
    ("furniture apartment", "Housing"),
    ("home appliances purchase", "Housing"),
    ("security system installation", "Housing"),
    ("AC repair air conditioning", "Housing"),
    ("roofing repair", "Housing"),
    ("tiles floor renovation", "Housing"),
    ("hostel accommodation", "Housing"),
    ("student hostel fee", "Housing"),
    ("apartment deposit", "Housing"),

    # ── Entertainment ──────────────────────────────────────────────────────────
    ("netflix subscription", "Entertainment"),
    ("amazon prime video", "Entertainment"),
    ("showmax subscription", "Entertainment"),
    ("disney plus subscription", "Entertainment"),
    ("spotify music subscription", "Entertainment"),
    ("apple music subscription", "Entertainment"),
    ("youtube premium", "Entertainment"),
    ("boomplay music", "Entertainment"),
    ("cinema ticket", "Entertainment"),
    ("silverbird cinema", "Entertainment"),
    ("genesis cinema ticket", "Entertainment"),
    ("ozone cinema", "Entertainment"),
    ("movie night", "Entertainment"),
    ("concert ticket", "Entertainment"),
    ("afrobeats concert", "Entertainment"),
    ("live show ticket", "Entertainment"),
    ("bar night out", "Entertainment"),
    ("club entrance fee", "Entertainment"),
    ("lounge drinks outing", "Entertainment"),
    ("hangout friends drinks", "Entertainment"),
    ("video game purchase", "Entertainment"),
    ("gaming playstation xbox", "Entertainment"),
    ("mobile game subscription", "Entertainment"),
    ("bowling game fun", "Entertainment"),
    ("amusement park ticket", "Entertainment"),
    ("zuma rock park entrance", "Entertainment"),
    ("funfair carnival", "Entertainment"),
    ("book novel fiction", "Entertainment"),
    ("party entry fee", "Entertainment"),
    ("owambe party", "Entertainment"),
    ("karaoke outing", "Entertainment"),

    # ── Healthcare ─────────────────────────────────────────────────────────────
    ("hospital consultation fee", "Healthcare"),
    ("doctor visit fee", "Healthcare"),
    ("clinic outpatient", "Healthcare"),
    ("lab test result", "Healthcare"),
    ("blood test lab", "Healthcare"),
    ("pharmacy drugs", "Healthcare"),
    ("medication prescription", "Healthcare"),
    ("chemist drugs purchase", "Healthcare"),
    ("malaria drugs treatment", "Healthcare"),
    ("paracetamol drugs", "Healthcare"),
    ("vitamins supplements", "Healthcare"),
    ("health insurance premium", "Healthcare"),
    ("nhis contribution", "Healthcare"),
    ("hygeia health insurance", "Healthcare"),
    ("surgery operation fee", "Healthcare"),
    ("dental check up", "Healthcare"),
    ("eye test glasses", "Healthcare"),
    ("physiotherapy session", "Healthcare"),
    ("specialist consultation", "Healthcare"),
    ("xray scan imaging", "Healthcare"),
    ("ultrasound scan", "Healthcare"),
    ("antenatal care clinic", "Healthcare"),
    ("immunisation vaccine", "Healthcare"),
    ("mental health therapy", "Healthcare"),
    ("hospital bills admission", "Healthcare"),
    ("emergency room fee", "Healthcare"),
    ("ambulance service", "Healthcare"),

    # ── Shopping ───────────────────────────────────────────────────────────────
    ("clothes purchase fashion", "Shopping"),
    ("shirt trouser dress", "Shopping"),
    ("shoes footwear", "Shopping"),
    ("bag handbag purse", "Shopping"),
    ("jumia online shopping", "Shopping"),
    ("konga online order", "Shopping"),
    ("amazon shopping order", "Shopping"),
    ("slot electronics gadgets", "Shopping"),
    ("phone mobile purchase", "Shopping"),
    ("laptop computer purchase", "Shopping"),
    ("television electronics", "Shopping"),
    ("household items", "Shopping"),
    ("kitchen utensils", "Shopping"),
    ("bedding duvet pillow", "Shopping"),
    ("gift items purchase", "Shopping"),
    ("christmas shopping", "Shopping"),
    ("ankara fabric cloth", "Shopping"),
    ("aso oke fabric", "Shopping"),
    ("accessories jewellery", "Shopping"),
    ("perfume fragrance", "Shopping"),
    ("watch purchase", "Shopping"),
    ("sunglasses fashion", "Shopping"),
    ("online shopping delivery", "Shopping"),
    ("supermarket non-food items", "Shopping"),
    ("trade fair shopping", "Shopping"),
    ("computer accessories peripherals", "Shopping"),
    ("power bank charger", "Shopping"),
    ("headphones earphones", "Shopping"),

    # ── Education ──────────────────────────────────────────────────────────────
    ("school fees tuition", "Education"),
    ("university tuition payment", "Education"),
    ("college school fees", "Education"),
    ("secondary school fees", "Education"),
    ("primary school fees", "Education"),
    ("tutorial private lesson", "Education"),
    ("lesson teacher fee", "Education"),
    ("waec neco exam fee", "Education"),
    ("jamb form exam", "Education"),
    ("postgraduate school fees", "Education"),
    ("textbooks school books", "Education"),
    ("stationery pen notebook", "Education"),
    ("udemy online course", "Education"),
    ("coursera certification", "Education"),
    ("linkedin learning course", "Education"),
    ("professional training", "Education"),
    ("coding bootcamp fee", "Education"),
    ("student handbook materials", "Education"),
    ("exam preparation", "Education"),
    ("library fee", "Education"),
    ("computer training class", "Education"),
    ("language course", "Education"),
    ("skill acquisition training", "Education"),
    ("nysc orientation fee", "Education"),

    # ── Utilities ──────────────────────────────────────────────────────────────
    ("mtn airtime recharge", "Utilities"),
    ("airtel airtime top up", "Utilities"),
    ("glo airtime credit", "Utilities"),
    ("9mobile airtime", "Utilities"),
    ("mtn data bundle purchase", "Utilities"),
    ("airtel data subscription", "Utilities"),
    ("glo data plan", "Utilities"),
    ("internet subscription broadband", "Utilities"),
    ("spectranet internet", "Utilities"),
    ("smile internet subscription", "Utilities"),
    ("swift networks internet", "Utilities"),
    ("dstv subscription monthly", "Utilities"),
    ("gotv subscription cable", "Utilities"),
    ("startimes cable tv", "Utilities"),
    ("showmax gotv dstv", "Utilities"),
    ("phcn electricity token", "Utilities"),
    ("electricity token prepaid", "Utilities"),
    ("gas cylinder refill", "Utilities"),
    ("cooking gas", "Utilities"),
    ("waste disposal bin fee", "Utilities"),
    ("postpaid bill payment", "Utilities"),
    ("phone bill", "Utilities"),

    # ── Travel ─────────────────────────────────────────────────────────────────
    ("flight ticket booking", "Travel"),
    ("air ticket lagos abuja", "Travel"),
    ("dana air ticket", "Travel"),
    ("air peace flight", "Travel"),
    ("arik air ticket", "Travel"),
    ("hotel accommodation booking", "Travel"),
    ("airbnb short let stay", "Travel"),
    ("shortlet apartment booking", "Travel"),
    ("holiday vacation trip", "Travel"),
    ("dubai visa application", "Travel"),
    ("uk visa fee", "Travel"),
    ("international travel expenses", "Travel"),
    ("passport renewal", "Travel"),
    ("travel insurance", "Travel"),
    ("london trip expenses", "Travel"),
    ("abuja trip", "Travel"),
    ("port harcourt journey", "Travel"),
    ("ibadan enugu trip", "Travel"),
    ("tourism sightseeing", "Travel"),
    ("car hire rental trip", "Travel"),
    ("boat ferry trip", "Travel"),
    ("lagos island ferry", "Travel"),

    # ── Personal Care ──────────────────────────────────────────────────────────
    ("barbing salon haircut", "Personal Care"),
    ("barber shop", "Personal Care"),
    ("hair salon treatment", "Personal Care"),
    ("locs weave hair extension", "Personal Care"),
    ("makeup foundation cosmetics", "Personal Care"),
    ("skincare lotion cream", "Personal Care"),
    ("spa treatment massage", "Personal Care"),
    ("manicure pedicure", "Personal Care"),
    ("nail salon", "Personal Care"),
    ("gym membership fitness", "Personal Care"),
    ("fitness workout", "Personal Care"),
    ("deodorant toiletries soap", "Personal Care"),
    ("toothpaste toothbrush hygiene", "Personal Care"),
    ("shampoo conditioner hair", "Personal Care"),
    ("cologne perfume body spray", "Personal Care"),
    ("beard care grooming", "Personal Care"),
    ("facial treatment beauty", "Personal Care"),
    ("laundry dry cleaning", "Personal Care"),

    # ── Savings ────────────────────────────────────────────────────────────────
    ("monthly savings contribution", "Savings"),
    ("piggybank savings", "Savings"),
    ("cowrywise savings plan", "Savings"),
    ("risevest investment savings", "Savings"),
    ("bamboo investment", "Savings"),
    ("emergency fund savings", "Savings"),
    ("fixed deposit savings", "Savings"),
    ("savings account transfer", "Savings"),
    ("target savings", "Savings"),
    ("retirement savings pension", "Savings"),
    ("pension contribution", "Savings"),
    ("mutual fund investment", "Savings"),

    # ── Salary ─────────────────────────────────────────────────────────────────
    ("monthly salary credit", "Salary"),
    ("salary payment received", "Salary"),
    ("wages monthly pay", "Salary"),
    ("staff salary", "Salary"),
    ("payroll credit", "Salary"),
    ("employment income", "Salary"),
    ("net salary after tax", "Salary"),
    ("allowance stipend", "Salary"),
    ("government salary", "Salary"),
    ("company salary deposit", "Salary"),

    # ── Freelance ──────────────────────────────────────────────────────────────
    ("freelance payment received", "Freelance"),
    ("contract job payment", "Freelance"),
    ("web design project fee", "Freelance"),
    ("graphic design client payment", "Freelance"),
    ("upwork payment", "Freelance"),
    ("fiverr earnings", "Freelance"),
    ("client project fee", "Freelance"),
    ("consulting fee received", "Freelance"),
    ("logo design payment", "Freelance"),
    ("content writing payment", "Freelance"),
    ("video editing fee", "Freelance"),
    ("photography payment", "Freelance"),
    ("software development fee", "Freelance"),
    ("digital marketing payment", "Freelance"),

    # ── Business ───────────────────────────────────────────────────────────────
    ("business sales revenue", "Business"),
    ("product sales income", "Business"),
    ("customer payment received", "Business"),
    ("shop sales daily revenue", "Business"),
    ("market stall income", "Business"),
    ("business profit income", "Business"),
    ("trade income", "Business"),
    ("reselling profit", "Business"),
    ("ecommerce sales", "Business"),
    ("vendor payment received", "Business"),
    ("service income business", "Business"),
    ("commission earnings", "Business"),
    ("hair business income", "Business"),
    ("food business proceeds", "Business"),

    # ── Investment ─────────────────────────────────────────────────────────────
    ("stock dividend received", "Investment"),
    ("investment return profit", "Investment"),
    ("shares dividend income", "Investment"),
    ("nse stocks profit", "Investment"),
    ("crypto profit withdrawal", "Investment"),
    ("bitcoin profit", "Investment"),
    ("fixed deposit interest", "Investment"),
    ("treasury bill return", "Investment"),
    ("eurobond interest payment", "Investment"),
    ("real estate investment return", "Investment"),
    ("risevest returns", "Investment"),
    ("bamboo stock earnings", "Investment"),

    # ── Gift ───────────────────────────────────────────────────────────────────
    ("birthday gift money received", "Gift"),
    ("cash gift from family", "Gift"),
    ("aso-ebi collection", "Gift"),
    ("wedding gift received", "Gift"),
    ("christmas hamper cash", "Gift"),
    ("appreciation gift received", "Gift"),
    ("money gift", "Gift"),
    ("bonus gift from employer", "Gift"),
    ("naija celebration gift", "Gift"),
    ("settlement payment received", "Gift"),

    # ── Rental ─────────────────────────────────────────────────────────────────
    ("property rental income", "Rental"),
    ("tenant rent collected", "Rental"),
    ("house rent received", "Rental"),
    ("shop rent collected", "Rental"),
    ("land lease income", "Rental"),
    ("apartment sublease payment", "Rental"),
    ("car hire income", "Rental"),
    ("equipment rental income", "Rental"),
    ("office space rental income", "Rental"),

    # ── Other Income ───────────────────────────────────────────────────────────
    ("miscellaneous income received", "Other Income"),
    ("refund received", "Other Income"),
    ("cashback reward", "Other Income"),
    ("prize money winning", "Other Income"),
    ("lottery win", "Other Income"),
    ("insurance claim payout", "Other Income"),
    ("tax refund", "Other Income"),
    ("bursary scholarship", "Other Income"),

    # ── Other (expense) ────────────────────────────────────────────────────────
    ("miscellaneous expense", "Other"),
    ("bank charges fee", "Other"),
    ("atm withdrawal fee", "Other"),
    ("transfer fee charge", "Other"),
    ("pos service charge", "Other"),
    ("lawyer legal fee", "Other"),
    ("court filing fee", "Other"),
    ("stamp duty", "Other"),
    ("government fee levy", "Other"),
    ("donation charity", "Other"),
    ("church tithe offering", "Other"),
    ("mosque zakat", "Other"),
    ("ajo contribution", "Other"),
    ("cooperative contribution", "Other"),
    ("esusu contribution", "Other"),
]


class CategoryClassifier:
    """TF-IDF + Logistic Regression transaction category classifier."""

    def __init__(self):
        self.pipeline = self._load_or_train()

    # ──────────────────────────────────────────────────────────────────────────
    # Initialisation
    # ──────────────────────────────────────────────────────────────────────────

    def _load_or_train(self):
        """Load a saved model; train and save one if it doesn't exist yet."""
        if os.path.exists(MODEL_PATH):
            try:
                return joblib.load(MODEL_PATH)
            except Exception as e:
                logger.warning(f"Could not load saved classifier: {e}. Retraining.")

        logger.info("Training CategoryClassifier from embedded training data…")
        pipeline = self._train()

        # Make sure the save directory exists
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        try:
            joblib.dump(pipeline, MODEL_PATH)
            logger.info(f"Classifier saved to {MODEL_PATH}")
        except Exception as e:
            logger.warning(f"Could not save classifier: {e}")

        return pipeline

    @staticmethod
    def _train():
        texts  = [CategoryClassifier._preprocess(d) for d, _ in _TRAINING_DATA]
        labels = [c for _, c in _TRAINING_DATA]

        pipeline = Pipeline([
            ("tfidf", TfidfVectorizer(
                ngram_range=(1, 2),
                min_df=1,
                max_features=5000,
                sublinear_tf=True,
            )),
            ("clf", LogisticRegression(
                C=10,
                max_iter=500,
                solver="lbfgs",
                multi_class="auto",
            )),
        ])
        pipeline.fit(texts, labels)
        return pipeline

    # ──────────────────────────────────────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────────────────────────────────────

    def predict(self, description: str) -> str:
        """Return the most likely category for *description*."""
        cleaned = self._preprocess(description)
        return self.pipeline.predict([cleaned])[0]

    def predict_proba(self, description: str) -> dict:
        """Return a probability distribution over all categories."""
        cleaned = self._preprocess(description)
        probs   = self.pipeline.predict_proba([cleaned])[0]
        classes = self.pipeline.classes_
        # Sort by probability descending
        pairs = sorted(zip(classes, probs.tolist()), key=lambda x: x[1], reverse=True)
        return {cat: round(prob, 4) for cat, prob in pairs}

    def top_suggestions(self, description: str, n: int = 3) -> list:
        """Return the top-n category suggestions with confidence percentages."""
        proba = self.predict_proba(description)
        return [
            {"category": cat, "confidence": round(prob * 100, 1)}
            for cat, prob in list(proba.items())[:n]
        ]

    # ──────────────────────────────────────────────────────────────────────────
    # Preprocessing
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _preprocess(text: str) -> str:
        text = text.lower()
        text = re.sub(r"[^a-z0-9\s]", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text
