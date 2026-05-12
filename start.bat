@echo off
echo ==========================================
echo   Starting BudgetWise...
echo ==========================================
echo.

:: Start Flask backend in a new window
start "BudgetWise - Flask API" cmd /k "cd /d "%~dp0backend" && venv\Scripts\activate && python run.py"

:: Wait 2 seconds for Flask to boot up
timeout /t 2 /nobreak >nul

:: Start frontend server in a new window
start "BudgetWise - Frontend" cmd /k "cd /d "%~dp0frontend" && python -m http.server 5500"

:: Wait 1 second then open the browser automatically
timeout /t 1 /nobreak >nul
start http://localhost:5500

echo Both servers are running.
echo Close the two terminal windows to stop the app.
