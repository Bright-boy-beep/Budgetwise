@echo off
echo ============================================
echo  BudgetWise Backend — First-Time Setup
echo ============================================
echo.

:: Create virtual environment
python -m venv venv
echo [1/3] Virtual environment created.

:: Activate and install packages
call venv\Scripts\activate
pip install -r requirements.txt
echo [2/3] Packages installed.

:: Create .env if it doesn't exist
if not exist .env (
    copy .env.example .env
    echo [3/3] .env file created from template. Edit it to set your secret keys.
) else (
    echo [3/3] .env already exists — skipping.
)

echo.
echo ============================================
echo  Setup complete! To start the server run:
echo    call venv\Scripts\activate
echo    python run.py
echo ============================================
pause
