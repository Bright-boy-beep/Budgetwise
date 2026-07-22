# Deploying BudgetWise to Render (free, public link)

This gives you a real link like `https://budgetwise-xxxx.onrender.com` that you can
open on a phone or any device, anywhere. Flask serves both the API and the
frontend, so it is a single web service plus a free PostgreSQL database.

Everything is already configured in `render.yaml`. You just need to push the code
and click through Render.

---

## Step 1 — Put the latest code on GitHub

Render deploys from a GitHub repo, so the code (including the new `render.yaml`,
the admin account, and the hosting changes) must be pushed to GitHub.

In the project folder, commit and push:

```
git add .
git commit -m "Add admin dashboard and Render deployment config"
git push
```

(If you have not connected the repo to GitHub yet, create a new repository on
github.com and follow its "push an existing repository" instructions, or use your
`push_to_github.bat`.)

---

## Step 2 — Create a Render account

1. Go to <https://render.com> and sign up (the free plan is fine).
2. When asked, connect your **GitHub** account so Render can see your repository.

---

## Step 3 — Deploy with the Blueprint

1. In the Render dashboard click **New +** → **Blueprint**.
2. Select your **BudgetWise repository**. Render automatically reads `render.yaml`
   and shows one web service (`budgetwise`) and one database (`budgetwise-db`).
3. Render will prompt you for the value of **`ADMIN_PASSWORD`** (it is kept secret,
   not stored in the code). Enter:

   ```
   Brightboy123
   ```

   (The admin email `ezomonbright9@gmail.com` is already set for you.)
4. Click **Apply** / **Create**. Render now:
   - creates the free PostgreSQL database,
   - installs the requirements and starts the app with gunicorn,
   - and, on first start, automatically creates your administrator account.

The first build takes about 3–5 minutes.

---

## Step 4 — Open your link

When the service shows **Live**, its URL appears at the top of the service page,
for example:

```
https://budgetwise-xxxx.onrender.com
```

Open that on your phone or any device and log in:

- **Email:** ezomonbright9@gmail.com
- **Password:** Brightboy123

The **Admin** menu will be in the sidebar. Share the link with anyone; new users
can register their own accounts.

---

## Good to know

- **First load after a quiet period is slow (~50 seconds).** On the free plan the
  service sleeps after ~15 minutes of no traffic and takes a moment to wake up.
  This is normal; it is fast once awake.
- **Your data persists** in the PostgreSQL database across restarts. (Render's free
  database has a limited lifetime on the current free plan; you can upgrade later if
  you need it long-term.)
- **Email/password sign-in works out of the box.** Google Sign-In will only work if
  you add your new Render domain to a Google OAuth client in the Google Cloud
  Console — not required for the demo.
- **The machine-learning model trains itself on first run**, so ML Insights work
  immediately.
- **To change the admin password**, log in and go to Settings. The auto-bootstrap
  never overwrites the password of an account that already exists.

---

## Manual alternative (without the Blueprint)

If you prefer to set it up by hand:

1. **New +** → **PostgreSQL** → create a free database → copy its **Internal
   Connection String**.
2. **New +** → **Web Service** → pick the repo, then set:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn run:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
3. Add these **Environment Variables**:
   - `DATABASE_URL` = the connection string from step 1
   - `SECRET_KEY` = any long random string
   - `JWT_SECRET_KEY` = any long random string
   - `ADMIN_EMAIL` = `ezomonbright9@gmail.com`
   - `ADMIN_PASSWORD` = `Brightboy123`
   - `PYTHON_VERSION` = `3.11.9`
4. **Create Web Service** and wait for it to go Live.
