@echo off
title BudgetWise — App Launcher
color 0A
echo.
echo  ==========================================
echo   BudgetWise — Starting everything...
echo  ==========================================
echo.

:: Launch the backend server in a NEW terminal window that stays open
echo  [1/2] Starting backend server...
start "BudgetWise Backend" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && python run.py"

:: Wait a moment for Flask to boot
echo  [INFO] Waiting for backend to start...
timeout /t 3 /nobreak >nul

:: Open the frontend in the default browser
echo  [2/2] Opening app in browser...
start "" "%~dp0frontend\index.html"

echo.
echo  Done! The backend server is running in a separate window.
echo  Close that window to stop the server.
echo.
pause
