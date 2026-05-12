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
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(BASE_DIR, '..', 'budgetwise.db')}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT settings
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)

    # ML model paths
    ML_MODELS_DIR = os.path.join(BASE_DIR, "..", "..", "ml", "saved_models")


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
