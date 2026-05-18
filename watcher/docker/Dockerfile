FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg ca-certificates curl \
    xvfb x11vnc websockify novnc \
    fonts-liberation libatk-bridge2.0-0 libatk1.0-0 libcups2 \
    libdbus-1-3 libgdk-pixbuf2.0-0 libnspr4 libnss3 libx11-xcb1 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxss1 libxtst6 \
    && wget -q -O /tmp/chrome.deb \
       https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y /tmp/chrome.deb \
    && rm /tmp/chrome.deb \
    && rm -rf /var/lib/apt/lists/*

COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 6080

CMD ["/start.sh"]
