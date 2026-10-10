# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

# Install production deps first for better layer caching.
COPY package.json ./
RUN npm install --omit=dev

# App source.
COPY . .

# Persist WhatsApp credentials across restarts.
VOLUME ["/app/auth"]

ENV NODE_ENV=production
CMD ["node", "index.js"]
