@echo off
title Cleanup old files
cd /d "%~dp0"
echo Removing old js/ folder...
if exist "js" (
    rmdir /s /q "js"
    echo Done. Old js/ folder deleted.
) else (
    echo Already clean - js/ folder not found.
)
echo.
pause
