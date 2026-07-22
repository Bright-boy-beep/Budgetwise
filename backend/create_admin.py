"""
create_admin.py — Create or promote an administrator account for BudgetWise.

Usage (run inside the backend/ folder, with the virtual environment active):

    python create_admin.py <email> <password> [name]

If the e-mail already exists, that account is promoted to administrator
(and its password reset if one is supplied). Otherwise a new admin
account is created.
"""

import sys
import bcrypt
from app import create_app, db
from app.models.user import User


def main():
    if len(sys.argv) < 3:
        print("Usage: python create_admin.py <email> <password> [name]")
        return

    email    = sys.argv[1].strip().lower()
    password = sys.argv[2]
    name     = sys.argv[3] if len(sys.argv) > 3 else "Administrator"

    app = create_app()
    with app.app_context():
        user = User.query.filter_by(email=email).first()
        if user:
            user.is_admin  = True
            user.is_active = True
            if password:
                user.password = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            db.session.commit()
            print(f"Existing account '{email}' has been promoted to administrator.")
        else:
            hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            user = User(name=name, email=email, password=hashed, is_admin=True, is_active=True)
            db.session.add(user)
            db.session.commit()
            print(f"Administrator account '{email}' created successfully.")


if __name__ == "__main__":
    main()
