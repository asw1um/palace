#!/bin/bash
set -e

echo "Starting backend..."
cd backend
uvicorn main:app --host 127.0.0.1 --port 5000 &
BACKEND_PID=$!
trap "kill $BACKEND_PID" EXIT

echo "Building frontend..."
cd ../frontend
npm run build
npm run start
