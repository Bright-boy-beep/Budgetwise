"""
app/config.py — Application configuration.
Reads sensitive values from environment variables (.env file).
"""

import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    # Security
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-this-in-production")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "change-jwt-secret-in-production")

    # Database
    _db_url = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(BASE_DIR, '..', 'budgetwise.db')}"
    )
    # Managed hosts (Render, Heroku) hand out "postgres://"; SQLAlchemy 2.x needs "postgresql://"
    if _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql://", 1)
    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT settings
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)

    # Google OAuth — set GOOGLE_CLIENT_ID in your .env file
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

    # Email (Flask-Mail) — for password reset emails
    # Leave MAIL_USERNAME empty to disable email and log reset links to the console instead
    MAIL_SERVER   = os.environ.get("MAIL_SERVER",   "smtp.gmail.com")
    MAIL_PORT     = int(os.environ.get("MAIL_PORT",  "587"))
    MAIL_USE_TLS  = os.environ.get("MAIL_USE_TLS",  "true").lower() == "true"
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME",  "")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD",  "")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", "BudgetWise <noreply@budgetwise.app>")

    # Public URL used in reset links (change for production)
    APP_BASE_URL  = os.environ.get("APP_BASE_URL", "http://localhost:5000")

    # ML model paths
    ML_MODELS_DIR = os.path.join(BASE_DIR, "..", "..", "ml", "saved_models")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
