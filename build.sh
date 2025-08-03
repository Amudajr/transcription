#!/bin/bash

# Create directory
mkdir -p .render/bin

# Download yt-dlp into .render/bin/
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o .render/bin/yt-dlp

# Make it executable
chmod +x .render/bin/yt-dlp
