# Running BudgetWise Locally

## First time only — install backend dependencies

Open a terminal **inside the `backend/` folder** and run:

```bash
# Windows (double-click setup.bat, OR run these manually)
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

---

## Every time you want to run the app

### Terminal 1 — Start the Flask API

```bash
cd backend
venv\Scripts\activate        # (on Mac/Linux: source venv/bin/activate)
python run.py
```

You should see:
```
 * Running on http://0.0.0.0:5000
 * Debug mode: on
```

### Terminal 2 — Serve the Frontend

Open `frontend/index.html` with **VS Code Live Server** (right-click → Open with Live Server).  
It will open at `http://localhost:5500/frontend/`

---

## How to use the app

1. Go to `http://localhost:5500/frontend/`
2. Click **Sign Up** and create an account (name, email, password)
3. You are automatically logged in — start adding income and expenses
4. Set budgets in the **Budgets** page
5. View analytics in the **Analytics** page
6. ML Insights will be available once the ML models are trained (next step)

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Cannot reach the server" error on login | Make sure Flask is running on port 5000 |
| `ModuleNotFoundError: No module named 'flask'` | Run `pip install -r requirements.txt` inside `venv` |
| CORS error in browser console | Check that Flask-CORS is installed and Flask is running |
| Database error on first run | Flask auto-creates `backend/budgetwise.db` on first start |
