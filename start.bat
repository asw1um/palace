@echo off

echo Building frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo Frontend build failed.
    pause
    exit /b 1
)

echo Starting backend...
cd ..\backend
python app.py
