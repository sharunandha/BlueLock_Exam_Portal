<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# BlueLock Exam Portal

A lightweight exam platform with a React/Vite frontend and an Express + SQLite backend. Features include live admin dashboard, anti-cheat checks, and Excel report generation.

---

## Quick start

**Prerequisites:** Node.js (18+), npm

1. Install dependencies

   npm ci

2. Run in development (Vite + backend can be run separately)

   - Frontend dev: npm run dev
   - Backend server (API + reports): npm start

3. Build and serve production

   npm run build
   npm run serve # builds and starts server (serves /dist)

4. Type checking

   npx tsc --noEmit

---

## Project layout

- `tests/` — unit and integration tests (Vitest + custom API smoke tests)

## Testing

Run tests locally:

npm test

Vitest runs component tests (JSDOM) and integration API tests (spawns local server).

---

## Linting & Formatting

This project uses ESLint and Prettier with Husky pre-commit hooks to keep code consistent.

- Run lint: `npm run lint`
- Run formatter: `npm run format`
- Husky hooks are activated by `npm run prepare` (or automatically during `npm ci`), and a pre-commit hook will run `lint-staged` to format and lint staged changes.

If you want to enable hooks locally after cloning, run:

npm ci
npm run prepare

---

- **Server** listens on port `3000` by default (http://localhost:3000)
- If the frontend is not built, the server falls back to serving project root for development
- To regenerate a report file, trigger a submission via the student flow or use the admin export

---

## Setup (Environment)

- No required secrets for local runs, but you can configure environment variables to customize behavior:

  ```env
  # server port (default 3000)
  PORT=3000

  # production / development
  NODE_ENV=production

  # path where Excel reports will be written
  REPORT_DIR=reports/BlueLock_Exam_Reports

  # sqlite DB file (relative to project root)
  SQLITE_FILE=database/exam.db
  ```

- Create `.env` or pass env vars in your service manager (systemd, Docker, etc.).

---

## Production run (simple)

1. Build frontend

   ```bash
   npm run build
   ```

2. Start the server (serves the `dist/` static files automatically when present)

   ```bash
   NODE_ENV=production PORT=3000 npm run start
   ```

For a managed production process use a process manager like `pm2` or run the app inside a container (recommended for portability).

---

## Docker (recommended for production)

Docker is a convenient way to deploy this app. Important: mount the `database/` and `reports/` directories as volumes so data persists across container restarts.

Example `Dockerfile` (multi-stage, optimized for build/run):

```dockerfile
# Build stage: install all deps and build frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run stage: only production deps and built assets
FROM node:20-alpine AS run
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/reports ./reports
COPY --from=build /app/database ./database
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
```

Example `docker-compose.yml` (with persistent volumes):

```yaml
version: '3.8'
services:
  bluelock:
    build: .
    image: bluelock-portal:latest
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - PORT=3000
      - REPORT_DIR=reports/BlueLock_Exam_Reports
    volumes:
      - ./database:/app/database
      - ./reports:/app/reports
    restart: unless-stopped
```

Quick commands:

```bash
# Build the Docker image locally (multi-stage builds the frontend)
docker build -t bluelock-portal:local .

# Run a container bound to local volumes
docker run --rm -p 3000:3000 -e PORT=3000 -v $(pwd)/database:/app/database -v $(pwd)/reports:/app/reports bluelock-portal:local

# Or use docker-compose (recommended during development & controlled restarts)
docker-compose up -d --build
```

Notes:

- SQLite uses a single file; ensure the `database/` volume is mounted so data is not lost.
- Excel report generation writes to the `reports/BlueLock_Exam_Reports` directory—ensure write permissions.

---

## CI & Deployment ideas

- This repo already includes a basic GitHub Actions workflow that runs `npm ci`, `npx tsc --noEmit`, `npm run build` and `npm test` on push/PR.

(Trivial change to test pre-commit hooks)

- To deploy from CI you can add a job to build and push a Docker image to a registry (GitHub Packages / Docker Hub) and then trigger a rollout in your host environment.

Example deploy step (high level):

- Build image with `docker build -t ghcr.io/<org>/<repo>:${{ github.sha }} .`
- Push image to registry with auth set via secrets
- Deploy to your host (SSH + docker-compose pull && docker-compose up -d) or update your orchestrator (K8s, etc.).

---

## Database & backups

- SQLite DB path: `database/exam.db` (created on first run).
- To backup: copy the DB file when the server is stopped or use `sqlite3` to safely dump.
- For high-concurrency or large scale, consider migrating to Postgres or MySQL.

---

## Troubleshooting

- "Port already in use": ensure no other process is listening on `3000` or change `PORT`.
- "Built frontend not found" warning: run `npm run build` before `npm start` (or run `npm run dev` during development).
- Excel generation permission errors: verify `reports/` directory exists and is writable by the process user.
- CI failures: check the GitHub Actions logs for failing steps; local reproduction command: `npm ci && npx tsc --noEmit && npm run build && npm test`.

---

## Security & best practices

- Run behind a reverse proxy (Nginx) and enable HTTPS (Let's Encrypt).
- Consider using a real DB for production and restrict direct public access to `/reports` if files are sensitive.
- Limit CORS origins in production and provide authentication/authorization for admin endpoints.

---

I added a `Dockerfile`, `docker-compose.yml`, and `.dockerignore` to the repo for easy local testing and production packaging. To build and run locally:

- Build image: `docker build -t bluelock-portal .`
- Run with Compose: `docker-compose up --build`

If you'd like, I can also add a GitHub Actions job to build and push Docker images to your registry and prepare a deployment workflow for DigitalOcean, AWS ECS, Kubernetes, or another target.
