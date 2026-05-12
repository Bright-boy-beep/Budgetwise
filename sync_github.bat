@echo off
title Syncing to GitHub...
color 0A
cd /d "%~dp0"

echo.
echo  ================================================
echo   BudgetWise — Sync changes to GitHub
echo  ================================================
echo.

git add .

for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set mydate=%%a-%%b-%%c
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set mytime=%%a:%%b

set COMMIT_MSG=Update %mydate% %mytime%

echo  Committing: %COMMIT_MSG%
git diff --cached --quiet 2>nul
if errorlevel 1 (
    git commit -m "%COMMIT_MSG%"
    echo.
    echo  Pushing to GitHub...
    git push
    echo.
    echo  Done! Changes are live on GitHub.
    echo  https://github.com/Bright-boy-beep/budgetwise
) else (
    echo.
    echo  No changes to sync — everything is already up to date.
)

echo.
pause
