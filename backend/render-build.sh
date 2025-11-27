#!/usr/bin/env bash
# Install ffmpeg on Render
apt-get update
apt-get install -y ffmpeg

# Build the app
npm install
npx prisma generate
npm run build
