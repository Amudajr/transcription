#!/usr/bin/env bash
# Install ffmpeg
apt-get update && apt-get install -y ffmpeg

# Install yt-dlp
pip install yt-dlp

# Install whisper
pip install -r requirements.txt
