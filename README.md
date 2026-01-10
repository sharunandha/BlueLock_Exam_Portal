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

- `server.js` — Express server + Socket.IO + report generation
- `components/` — React UI components (Admin, Student, Exam engine, Login)
- `database/` — SQLite database file (`exam.db` will be created on first run)
- `reports/BlueLock_Exam_Reports/` — generated Excel reports

---

## Notes & Troubleshooting

- Server listens on port 3000 by default (http://localhost:3000)
- If the frontend is not built, the server falls back to serving project root for development
- To regenerate a report file, trigger a submission via the student flow or use the admin export

---

If you'd like, I can add CI (GitHub Actions) to run the build and typecheck automatically on each push.
