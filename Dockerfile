# Multi-stage build for BlueLock Portal

# Build stage: install all deps and build frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# Run stage: only production deps and built assets
FROM node:20-alpine AS run
WORKDIR /app
COPY package.json package-lock.json ./
# Install build tools temporarily to compile native modules (sqlite3) and then remove them
RUN apk add --no-cache build-base python3 \
  && npm ci --omit=dev --legacy-peer-deps --ignore-scripts \
  && npm rebuild sqlite3 \
  && apk del build-base python3
# Copy built frontend and server files
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
# Persisted directories (recommend mounting at runtime with volumes)
# If you want to bundle default reports/database, copy them here; otherwise mount via docker-compose.

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
