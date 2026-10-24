# SkillMirror Backend

The backend is a Node.js/TypeScript Express API using PostgreSQL and Prisma. It is a local development implementation, not a deployed service.

## Requirements

- Node.js 20+
- npm
- PostgreSQL 14 or newer

## Configure and start

From the repository root:

```powershell
Copy-Item backend/.env.example backend/.env
```

Set `DATABASE_URL` in `backend/.env` to a PostgreSQL database that you control. `FRONTEND_ORIGIN` must match the browser origin exactly. `MEDIA_STORAGE_DIR` defaults to `./backend/storage`.

Then run:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev:backend
```

The API listens on `http://localhost:8000`. `GET /api/v1/health` is a liveness check; `GET /api/v1/ready` checks database connectivity.

To seed fictional development data, set `DEV_SEED_EMAIL` and a unique `DEV_SEED_PASSWORD` of at least 12 characters in the environment, then run `npm run db:seed`. The seed creates no default production account and never prints the supplied password. It is intended only for a development database.

## API and tests

OpenAPI is documented in [`openapi.yaml`](openapi.yaml). The API prefix is `/api/v1`.

```bash
npm run build:backend
npm run test:backend
npm run test:frontend
npm run build:frontend
```

Backend tests use Supertest and a mocked Prisma boundary. They do not replace running the migration and exercising the API against a real PostgreSQL instance.

## Current limitations

- Authentication is email/password with bcrypt hashes and random, database-backed, HttpOnly session cookies. Registration is open; production deployment still needs account-abuse controls and operational monitoring.
- Unsafe browser methods require an exact configured `Origin`. Use HTTPS and secure cookies in production.
- Local media uses private random filenames and content-type sniffing. It has no malware scanner and is not durable on ephemeral hosting disks. Use private object storage before production.
- The only step generator is a labelled paper-bridge template. No AI provider or computer-vision verifier is configured.
- Attempt submission with valid evidence creates `NEEDS_REVIEW`; without evidence it creates `UNABLE_TO_VERIFY`. Only the training owner can review attempts. No submission request automatically passes a step.
- Existing attempts and sessions prevent procedure edits/deletion to preserve assessment history. Duplicate a guide to create a new version.
- Live PostgreSQL migration and integration tests require a local PostgreSQL service and credentials.