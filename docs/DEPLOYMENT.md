# Deployment Guide

This is a deployment checklist, not a statement that SkillMirror is deployed or production-ready. The current backend is a local development implementation.

## Deployment shape

- Static host for the Vite frontend.
- Node.js 20+ host for the Express API.
- Managed PostgreSQL for Prisma data.
- Private durable object storage before handling production media.
- Server-side secret management for database credentials.

## Render API + Vercel frontend

This repository can use Vercel for the Vite frontend and Render for the Express API and managed PostgreSQL. The frontend is a static build; the API is a long-running Node.js web service. Deploy each from the repository root.

### Vercel frontend

1. Import the repository into Vercel and use the repository root as the project root.
2. Set the framework preset to **Vite**, build command to `npm run build:frontend`, and output directory to `dist` (or keep Vercel's detected Vite defaults).
3. Add `VITE_API_BASE_URL` with the public HTTPS URL of the Render API, for example `https://api.example.com`.
4. Deploy and confirm the generated site loads. The app uses hash-based routes, so client-side paths do not need a special rewrite.

`VITE_API_BASE_URL` is embedded in the public frontend bundle. Never put credentials or secrets in a `VITE_*` variable. See [Vercel's Vite guide](https://vercel.com/docs/frameworks/frontend/vite) and [environment-variable guide](https://vercel.com/docs/environment-variables).

### Render API and database

1. Create a managed Render PostgreSQL database and a Node.js web service connected to this repository.
2. Use the repository root as the service root. For a free web service, set the build command to `npm ci --include=dev && npm run db:generate && npm run db:deploy && npm run build:backend` and the start command to `npm run start:backend`. This applies database migrations using the service's `DATABASE_URL` before the new build starts.
3. Configure server-side environment variables: `DATABASE_URL` for the intended PostgreSQL database and branch, `NODE_ENV=production`, and `FRONTEND_ORIGIN` set to the exact public frontend origin. Render supplies `PORT`; do not hard-code it.
4. On a paid service with a pre-deploy command, use `npm run db:deploy` there and remove it from the build command. Configure the migration in one place only; avoid running migrations concurrently from multiple service instances.
5. Set the Render health-check path to `/api/v1/health`; check `/api/v1/ready` after deployment to confirm database connectivity and that every required migration has completed.

### Cookie and domain requirement

The current API sets its session cookie as `HttpOnly`, `Secure` in production, and `SameSite=Lax`. Vercel's default `*.vercel.app` domain and Render's `*.onrender.com` domain are cross-site, so browsers may not send this cookie on API requests. For the current cookie behavior, use custom domains under the same registrable domain, such as `app.example.com` for Vercel and `api.example.com` for Render. Keep `VITE_API_BASE_URL` and `FRONTEND_ORIGIN` set to those exact HTTPS origins. If using unrelated domains, the cookie policy and browser third-party-cookie behavior must be addressed and verified before relying on login.

The API enables credentialed CORS only for the exact `FRONTEND_ORIGIN`. Browser API calls already include credentials; do not replace the origin with `*`.

### Free-tier caveats

Free plans can be useful for a demo, but are not a durable production setup. Render free web services spin down when idle and use ephemeral filesystems; free Render Postgres databases have limited lifetime and no backups. Therefore uploads stored by the current local media adapter can disappear, and database contents need a durable paid/managed database with backups for real use. Prefer private object storage for uploads. Check the current [Render free-instance limits](https://render.com/docs/free), [web-service setup](https://render.com/docs/web-services), and [persistent-disk behavior](https://render.com/docs/disks) before choosing a plan.

## Frontend

1. Set `VITE_API_BASE_URL` to the public HTTPS API base URL. Vite embeds it in the client bundle; it must not contain secrets.
2. Build with `npm run build:frontend` and serve `dist/`.
3. Verify SPA refresh/deep-link behavior and the API workspace against the deployed API.

## Backend

1. Configure `DATABASE_URL`, `PORT`, `NODE_ENV`, `FRONTEND_ORIGIN`, and `MEDIA_STORAGE_DIR` using the host's server-side environment/secret manager. To enable AI features, also configure `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default `gpt-5.4-mini`). Keep the key on the API service only; never add it to Vercel or any `VITE_*` variable. See `backend/.env.example`.
2. Run `npm run db:generate` and `npm run db:deploy` as a release migration step. The current required migrations are `20261024140000_initial`, `20261024160000_factory_workforce`, and `20261024180000_ai_assessment_provenance`.
3. Start with `npm run build:backend` followed by `npm run start:backend`.
4. Use HTTPS so production cookies can be `Secure`; set `FRONTEND_ORIGIN` to the exact frontend origin.
5. Monitor `/api/v1/health` for liveness and `/api/v1/ready` for database readiness.

## Production gaps

- Local media storage is not durable on ephemeral hosts, has no malware scanner, and has no retention/deletion scheduler. Implement a private object-storage adapter and cleanup policy before accepting production uploads.
- Registration and login have in-process rate limits; production should use shared rate limiting behind the trusted proxy and abuse monitoring.
- AI generation and image/video-frame suggestions require an OpenAI API key, usage budget, and current provider data-policy review. Suggestions remain human-reviewed. Representative evaluation data and model accuracy measurements remain unimplemented.
- Add database backups, restore drills, TLS, metrics, alerting, and operational incident procedures.
- Review privacy/consent, retention, account deletion, and safety requirements with qualified stakeholders.
- The Vercel/Render split deployment needs same-site custom domains for the current `SameSite=Lax` session cookie; verify login, logout, and authenticated API calls in the target browsers.

Do not describe local execution as deployment or human review as AI verification.
