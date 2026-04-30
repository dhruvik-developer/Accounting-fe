#!/bin/bash

# === CONFIG ===
APP_DIR="/root/Accounting-fe"     # Change to your actual frontend directory
BUILD_DIR="$APP_DIR/dist"
PORT=3007                            # Change if you want a different port

# === Navigate to app directory ===
cd $APP_DIR || exit

# === Install dependencies if needed ===
echo "📦 Installing dependencies..."
npm install

# === Build the Vite app ===
echo "🔨 Building the app..."
npm run build

# === Start serving the build ===
echo "🚀 Starting serve on port $PORT..."
npx serve -s $BUILD_DIR -l $PORT
