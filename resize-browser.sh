#!/bin/bash
# Resize Chrome browser for 1080p screenshots

osascript -e 'tell application "Google Chrome" to set bounds of front window to {0, 0, 1920, 1150}'

echo "✓ Chrome window resized to 1920×1150 (1080p content area)"
echo "Ready for screenshots!"

