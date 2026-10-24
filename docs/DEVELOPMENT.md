# Development Guide

The repository has a root-level React/Vite frontend and an Express/TypeScript backend using Prisma and PostgreSQL.

## Requirements

- Node.js 20+ and npm
- PostgreSQL 14+ for API-backed workflows

## Frontend

From the repository root:

```bash
npm install
npm run dev
```

The local-only dashboard uses browser `localStorage`. The separate API workspace calls `VITE_API_BASE_URL`, defaulting to `http://localhost:8000`. Copy `.env.example` to `.env` to override it. Every `VITE_*` variable is public.

## Backend

Create backend configuration:

```powershell
Copy-Item backend/.env.example backend/.env
```

Set `DATABASE_URL` to a PostgreSQL database and `FRONTEND_ORIGIN` to the exact browser origin. The backend loads `backend/.env` when run from the repository root.

```bash
npm run db:generate
npm run db:migrate
npm run dev:backend
```

The API binds to `PORT` (default 8000). `/api/v1/health` reports liveness without requiring the database; `/api/v1/ready` performs a database query.

For fictional development seed data, set `DEV_SEED_EMAIL` and a unique `DEV_SEED_PASSWORD` (at least 12 characters) in the shell or secret manager, then run `npm run db:seed`. Never use the seed account in production.

## Checks

```bash
npm test
npm run build:backend
npm run build:frontend
```

Backend HTTP tests use a mocked Prisma boundary; run migrations and verify against a real PostgreSQL instance before deployment.

## Implemented boundaries

- Passwords are bcrypt-hashed; opaque session tokens are stored as SHA-256 hashes and sent in HttpOnly cookies.
- Drafts are owner-only; published guides are readable by authenticated users. Session data is visible to the learner and guide owner.
- Procedure edits are blocked after a learner session starts to preserve history.
- Uploads are stored under `MEDIA_STORAGE_DIR` with server-generated keys and content sniffing. Local disk is not durable on ephemeral hosts and has no malware scanner.
- Step generation returns only a labelled sample paper-bridge template. Attempt submissions never auto-pass; owner review is required.
- No external AI or computer-vision provider is configured.