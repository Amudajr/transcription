#!/bin/bash

# Install system dependencies
apt-get update && apt-get install -y ffmpeg curl

# Create a local bin directory in your project (if not exists)
mkdir -p ./bin

# Download yt-dlp into the local bin directory
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./bin/yt-dlp

# Make yt-dlp executable
chmod +x ./bin/yt-dlp

# Install Node.js dependencies
npm install
