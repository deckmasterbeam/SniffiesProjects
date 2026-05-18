#!/bin/bash
set -e

export DISPLAY=:99

Xvfb :99 -screen 0 1280x900x24 -ac &
sleep 1

x11vnc -display :99 -forever -nopw -quiet -rfbport 5900 &

websockify --web=/usr/share/novnc/ 6080 localhost:5900 &

echo ""
echo "  Open http://localhost:6080/vnc.html in your browser"
echo ""

exec google-chrome \
    --no-sandbox \
    --disable-dev-shm-usage \
    --disable-gpu \
    --load-extension=/extension \
    --user-data-dir=/chrome-profile \
    --new-window \
    https://sniffies.com
