@echo off
title BudgetWise — Backend Server
color 0A

cd /d "%~dp0"

echo.
echo  ==========================================
echo   BudgetWise Backend Server
echo  ==========================================
echo.
echo  Starting Flask on http://localhost:5000
echo  Press CTRL+C to stop the server
echo.

call venv\Scripts\activate.bat
python run.py

echo.
echo  Server stopped. Press any key to close.
pause
