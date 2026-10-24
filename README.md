# SkillMirror AI

**Turn practical know-how into guided practice.**

SkillMirror is a hackathon prototype with a React/Vite frontend and a Node.js, TypeScript, Express, PostgreSQL, and Prisma backend.

> **Status:** A browser-only workspace and a separate API-backed workspace are available. The API implements authentication, training and steps, sessions, private local uploads, optional AI-assisted draft generation and still-image suggestions, human review, and reports. AI features require a server-side Groq API key; AI suggestions never decide or pass an assessment.

## Product

SkillMirror is designed around **Watch → Learn → Practice → Verify → Improve**. Instructors create a task guide with materials, ordered steps, expected results, self-checks, safety notes, and retry tips. Learners follow it one step at a time and receive a report based on recorded practice.

The current UI also provides a fictional paper-bridge example. The frontend-only workspace stores guides and self-checks in browser `localStorage`. Its video chooser only selects a file in the current tab; it does not upload or analyze it.

### API workspace

Open **API workspace** in the app navigation to register or sign in and use server-backed records. It supports guide creation, step editing and reordering, publishing, session resume, private evidence upload, owner-only attempt review, and reports.

Evidence submissions with attached files enter `NEEDS_REVIEW`; submissions without evidence become `UNABLE_TO_VERIFY`. Only the project owner can review an attempt. Completion requires a human-reviewed `PASSED` result for the latest attempt on every step. Submitting evidence never passes a step automatically.

Guide authors can use an optional Groq-backed draft generator or the deterministic paper-bridge sample template. AI-generated procedures are marked with provider/model provenance, remain drafts, and require instructor review. Learners may explicitly opt in to send still-image evidence or up to three browser-sampled frames from a short video to the configured Groq model for a non-decisive suggestion. The recorded attempt remains `NEEDS_REVIEW` until a human owner reviews it. The full video is not sent to the provider. These capabilities are prototypes and have not been validated for real-world assessment.

## Architecture

```text
React + Vite
  ├── Local practice workspace (browser storage)
  └── API workspace (credentialed API client)
              │ /api/v1, HttpOnly cookie
              ▼
Node.js + TypeScript + Express
  ├── Auth, ownership checks, Zod validation, optional AI provider
  ├── Training, steps, sessions, attempts, reports
  ├── Local private media adapter
  └── Prisma ── PostgreSQL
```

The API client is in [src/apiClient.js](src/apiClient.js). The implemented contract is [backend/openapi.yaml](backend/openapi.yaml); backend-specific setup and limitations are in [backend/README.md](backend/README.md).

## Run locally

Requirements: Node.js 20+, npm, and PostgreSQL 14+ for API-backed features. The browser-only workflow can run without PostgreSQL.

Install packages from the repository root:

```bash
npm install
```

Create backend configuration from the example and set `DATABASE_URL`. Set `FRONTEND_ORIGIN` to the exact browser origin. To enable AI draft generation and image suggestions, set `GROQ_API_KEY` on the backend only; optionally set `GROQ_MODEL` (defaults to `qwen/qwen3.8-27b`). Leave the key unset to disable AI features while keeping manual workflows available.

```powershell
Copy-Item backend/.env.example backend/.env
```

Generate the client, apply migrations, and start the API:

```bash
npm run db:generate
npm run db:migrate
npm run dev:backend
```

The API listens on `http://localhost:8000`. `GET /api/v1/health` is liveness; `GET /api/v1/ready` checks PostgreSQL connectivity and confirms all required database migrations are applied.

In a second terminal, optionally copy `.env.example` to `.env` and set `VITE_API_BASE_URL`; then run:

```bash
npm run dev
```

Use the API workspace for server-backed records. The ordinary dashboard remains browser-local.

For fictional development data, set `DEV_SEED_EMAIL` and a unique `DEV_SEED_PASSWORD` of at least 12 characters in the environment, then run `npm run db:seed`. The seed creates no built-in password and must not be used in production.

## Checks

```bash
npm test
npm run build:backend
npm run build:frontend
```

Backend route tests use Supertest and a mocked Prisma boundary. They do not replace applying the migration and testing against a live PostgreSQL instance.

## API overview

All endpoints are under `/api/v1`. Authentication uses a random opaque session token in an HttpOnly cookie; only the token hash is stored. Unsafe browser requests must include the configured Origin. Private project/session endpoints enforce ownership.

Implemented route groups include:

- `GET /health`, `GET /ready`
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- Training list/create/read/update/delete, procedure save, progress, sample generation, and ordered step CRUD/reorder
- Session create/read/progress/complete, evidence-backed attempts, owner review, and reports
- Private local media upload/download/delete

See [backend/openapi.yaml](backend/openapi.yaml) for request and response details.

## Security and limitations

- Passwords are bcrypt-hashed. Registration and login are rate-limited; registration responses do not reveal whether an email already exists.
- Media uses server-generated keys, an allowlist, content sniffing, and a 250 MiB limit. Local disk is not durable on ephemeral hosts, and malware scanning is not included.
- Training with session history cannot be edited or deleted; archive it or duplicate it instead.
- AI features need a `GROQ_API_KEY` on the backend. Image/video-frame suggestions are optional and human-reviewed; evaluation datasets and accuracy validation remain future work.
- This prototype is not a safety certification system. Start with low-risk tasks and obtain qualified human review for physical procedures.
- No database server is bundled. Migration application and live database integration require a PostgreSQL instance and credentials.

Do not commit `.env` files, real passwords, private media, or learner records. Vite `VITE_*` values are public client configuration; never put secrets there.

## Development docs

- [Development guide](docs/DEVELOPMENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API design and implementation notes](docs/API.md)
- [Testing strategy](docs/TESTING.md)
- [Deployment checklist](docs/DEPLOYMENT.md)
- [Roadmap](docs/ROADMAP.md)

No license has been selected. Add a `LICENSE` file only after choosing the intended license.
