# Testing

## Commands

Run from the repository root:

```bash
npm run test:frontend
npm run test:backend
npm run build:backend
npm run build:frontend
```

`npm test` runs both frontend and backend tests.

## Current automated coverage

Frontend Node tests cover local-storage recovery and the credentialed API client: success envelopes, validation errors, network failures, no-content responses, URL-encoded IDs, and multipart uploads.

Backend Vitest/Supertest tests cover liveness, auth cookie/registration behavior, invalid Origin and credentials, validation envelopes, authenticated project creation, owner isolation, evidence-free `UNABLE_TO_VERIFY`, and blocking completion without a human-reviewed pass. Service tests cover the sample-only step generator, exact step-order validation, report calculation, and local storage-key traversal protection.

Backend HTTP tests use a mocked Prisma boundary. They do not prove real SQL queries, migrations, transaction behavior, database authorization, or concurrent updates.

## Database integration gate

With PostgreSQL configured:

1. Run `npm run db:generate`.
2. Apply `npm run db:migrate` against a disposable development database.
3. Run `npm run db:seed` with explicit development credentials.
4. Exercise `/api/v1/health` and `/api/v1/ready`, then test create/publish/session/upload/review/report with an authenticated user.
5. Verify rollback, migration repeatability, and User A/User B access boundaries against the real database.

Local database status (2026-10-24): PostgreSQL was started in Docker, the initial Prisma migration was applied successfully, and `/api/v1/health` plus `/api/v1/ready` returned HTTP 200. The full authenticated create/publish/session/upload/review/report flow, rollback behavior, migration repeatability, and cross-user access checks have not yet been exercised against that database. The Docker database is local development state and is not bundled with the repository.

## Media and assessment

Add isolated tests for MIME mismatch, size limit, interrupted writes, unauthorized upload before body acceptance, and unauthorized media downloads. Current service tests cover key generation and traversal rejection only.

No automated verifier exists, so there is no computer-vision evaluation dataset or accuracy claim. Evidence-backed attempts require human review; evidence-free attempts cannot pass.

## Browser and accessibility

The frontend was manually exercised at 320, 390, 768, and 1280 px. Before release, add automated browser tests for account flows, API outages, keyboard-only navigation, reduced motion, screen-reader announcements, and the full live-PostgreSQL vertical slice.
