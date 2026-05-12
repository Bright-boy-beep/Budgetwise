@echo off
cd /d "%~dp0"
echo Resetting database...
if exist instance\budgetwise.db del /f instance\budgetwise.db
if exist budgetwise.db del /f budgetwise.db
echo Done. Start the server now to recreate the database fresh.
pause
