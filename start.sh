#!/bin/bash
set -e

echo "Building frontend..."
cd frontend
npm run build

echo "Starting backend..."
cd ../backend
python app.py
