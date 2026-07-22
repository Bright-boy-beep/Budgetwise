"""
app/__init__.py — Application factory.
Creates and configures the Flask app instance.
Flask also serves the frontend folder so the whole app
runs from a single URL: http://localhost:5000
"""

import os
from flask import Flask, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_mail import Mail

from .config import Config

db  = SQLAlchemy()
jwt = JWTManager()
mail = Mail()

# Absolute path to the frontend folder (one level up from backend/app/)
FRONTEND_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'frontend')
)


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialise extensions
    db.init_app(app)
    jwt.init_app(app)
    mail.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Register blueprints
    from .routes.auth import auth_bp
    from .routes.transactions import transactions_bp
    from .routes.budgets import budgets_bp
    from .routes.predictions import predictions_bp
    from .routes.goals import goals_bp
    from .routes.admin import admin_bp

    app.register_blueprint(auth_bp,         url_prefix="/api/auth")
    app.register_blueprint(transactions_bp, url_prefix="/api/transactions")
    app.register_blueprint(budgets_bp,      url_prefix="/api/budgets")
    app.register_blueprint(predictions_bp,  url_prefix="/api/ml")
    app.register_blueprint(goals_bp,        url_prefix="/api/goals")
    app.register_blueprint(admin_bp,        url_prefix="/api/admin")

    # Serve the frontend — explicit routes so /api/* is never touched
    @app.route('/')
    @app.route('/index.html')
    def serve_index():
        return send_from_directory(FRONTEND_DIR, 'index.html')

    @app.route('/sw.js')
    def serve_sw():
        resp = send_from_directory(FRONTEND_DIR, 'sw.js')
        resp.headers['Service-Worker-Allowed'] = '/'
        resp.headers['Cache-Control'] = 'no-cache'
        return resp

    @app.route('/manifest.json')
    def serve_manifest():
        resp = send_from_directory(FRONTEND_DIR, 'manifest.json')
        resp.headers['Content-Type'] = 'application/manifest+json'
        return resp

    @app.route('/assets/<path:filename>')
    def serve_assets(filename):
        return send_from_directory(os.path.join(FRONTEND_DIR, 'assets'), filename)

    # Return JSON for all errors so the frontend can display them clearly
    import traceback
    from flask import jsonify as _jsonify

    @app.errorhandler(Exception)
    def handle_exception(e):
        tb = traceback.format_exc()
        print("FLASK ERROR:\n", tb)           # visible in the terminal
        code = getattr(e, 'code', 500)
        if isinstance(code, int) and code < 500:
            return _jsonify({"error": str(e)}), code
        return _jsonify({"error": f"Server error: {str(e)}"}), 500

    # Create all database tables on first run, then patch any missing columns
    with app.app_context():
        db.create_all()
        _migrate_db(db)
        _bootstrap_admin(db)

    return app


def _bootstrap_admin(db):
    """
    Create or promote an administrator account from environment variables
    (ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME). Runs on every startup so the
    admin always exists on a freshly-provisioned production database. It never
    overwrites the password of an account that already exists.
    """
    import os, bcrypt
    from .models.user import User
    email = (os.environ.get("ADMIN_EMAIL", "") or "").strip().lower()
    pw    =  os.environ.get("ADMIN_PASSWORD", "") or ""
    if not email or not pw:
        return
    user = User.query.filter_by(email=email).first()
    if user:
        if not user.is_admin:
            user.is_admin = True
            user.is_active = True
            db.session.commit()
            print(f"[bootstrap] Promoted {email} to administrator")
    else:
        hashed = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()
        db.session.add(User(name=os.environ.get("ADMIN_NAME", "Administrator"),
                            email=email, password=hashed, is_admin=True, is_active=True))
        db.session.commit()
        print(f"[bootstrap] Created administrator account {email}")


def _migrate_db(db):
    """
    Lightweight migration: add any columns that exist in the model but are
    missing from the live SQLite database. Safe to run on every startup.
    (Skipped on non-SQLite databases, where create_all already builds the
    full schema.)
    """
    if db.engine.dialect.name != "sqlite":
        return
    migrations = [
        ("users", "google_id",           "VARCHAR(255)"),
        ("users", "avatar_url",          "VARCHAR(512)"),
        ("users", "reset_token",         "VARCHAR(128)"),
        ("users", "reset_token_expiry",  "DATETIME"),
        ("users", "is_admin",            "BOOLEAN DEFAULT 0"),
        ("users", "is_active",           "BOOLEAN DEFAULT 1"),
    ]
    with db.engine.connect() as conn:
        from sqlalchemy import text, inspect
        inspector = inspect(db.engine)
        for table, column, col_type in migrations:
            existing = [c["name"] for c in inspector.get_columns(table)]
            if column not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
                conn.commit()
                print(f"[migrate] Added column {table}.{column}")
