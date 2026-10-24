# Architecture

## Current implementation

```text
React + Vite
  ├── Browser-local practice workspace
  └── API workspace and shared credentialed client
             │ /api/v1 + HttpOnly cookie
             ▼
Express + TypeScript
  ├── Auth, request validation, and owner checks
  ├── Training, ordered steps, sessions, attempts, reports
  ├── Local media storage abstraction
  └── Prisma ── PostgreSQL
```

The schema is in `backend/prisma/schema.prisma`; implemented API contracts are in `backend/openapi.yaml`.

## Data model

- `User` owns training projects, media, and learner sessions.
- `AuthSession` stores a hash of a random opaque cookie token and its expiry.
- `TrainingProject` stores title, description, category, level, duration, objectives, materials, status, and optional demonstration metadata.
- `TrainingStep` stores ordered instructions, expected result, self-check, safety note, optional image URL, and retry tip. `(projectId, position)` is unique.
- `MediaAsset` stores a server-generated key and validated metadata; bytes are outside PostgreSQL.
- `TrainingSession` links learner and project with current position/status.
- `StepAttempt` stores evidence links, verification status, feedback, method, simulation provenance, and attempt number.
- `AssessmentReport` is recalculated from persisted attempt records; it does not invent evidence or scores.

## Authorization

- Users can access their own drafts and projects. Signed-in users can read published guides.
- Only the project owner can edit, publish, archive, delete, or review attempts.
- Sessions are visible to their learner and the project owner. Learner writes require session ownership.
- Evidence is visible to its uploader, the project owner, or the owning learner. Published reference assets may be read by signed-in users; learner attempt evidence remains private.
- Mutating browser requests require an exact configured Origin.

## Attempt state and reports

An evidence-backed submission enters `NEEDS_REVIEW`; a submission without evidence enters `UNABLE_TO_VERIFY`. Only the owner review endpoint can transition a pending attempt to `PASSED`, `NEEDS_IMPROVEMENT`, or `UNABLE_TO_VERIFY`. Session completion requires a latest `PASSED` attempt for every current step. Reports derive percentages from those reviewed records.

No endpoint performs computer vision. The sample generator returns a deterministic paper-bridge template marked `simulated: true`, `provenance: demo-template`, and `humanReviewRequired: true`; it does not inspect uploads.

## Media

Uploads use a MIME allowlist, 250 MiB limit, detected-content check, random UUID storage key, and private local filesystem path. Authorization runs before receiving the upload. Files are not served from a public directory. Local storage lacks malware scanning and is unsuitable for ephemeral production hosts; use a private durable object-store adapter before deployment.

## Transactional rules

- Reordering validates an exact set of step IDs, moves positions to a temporary non-overlapping range, then assigns final positions in one serializable transaction.
- Deleting a step compacts positions using the same temporary-range approach.
- Replacing a procedure is atomic and blocked once sessions exist.
- Evidence attachment and attempt creation share a serializable transaction.

## Planned integration boundaries

The sample step generator implements a small `StepGenerator` interface. Add genuine model providers separately, validate structured output, preserve provenance, and require human review. Add a distinct verification provider only after a tested dataset and explicit criteria exist. Do not conflate generation with verification.