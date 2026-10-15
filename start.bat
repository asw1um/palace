@echo off

echo Starting backend...
start "palace backend" cmd /k "cd backend && python -m uvicorn main:app --host 127.0.0.1 --port 5000"

echo Building frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo Frontend build failed.
    pause
    exit /b 1
)

echo Starting frontend...
call npm run start
