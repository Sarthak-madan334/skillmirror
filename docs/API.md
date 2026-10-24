# API

The implemented REST API is versioned under `/api/v1`. The canonical endpoint, request, response, and status-code contract is [`backend/openapi.yaml`](../backend/openapi.yaml). Do not rely on the former task-oriented route proposal; those routes were not implemented.

## Conventions

- JSON responses use `{ success, data, error }`.
- Errors include a stable code/message and validation details where applicable. Stack traces, SQL errors, secrets, and filesystem paths are not returned.
- Protected endpoints use the `skillmirror_session` HttpOnly cookie. The database stores only a SHA-256 token hash; logout invalidates it.
- Mutating browser requests require an exact configured `Origin`; CORS credentials are restricted to `FRONTEND_ORIGIN`.
- Training statuses returned to the frontend are `draft`, `published`, and `archived`.

## Endpoint groups

- Health: `GET /health`, `GET /ready`
- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- Training: list/create/read/update/delete, `PUT /trainings/{id}/procedure`, `GET /trainings/{id}/progress`, sample step generation, and step CRUD/reorder
- Learning: session create/read/progress/complete, attempts, owner review, and reports
- Media: training/session multipart upload and authorized private asset read/delete

## Assessment semantics

- Evidence submission is not verification. With evidence, an attempt is `NEEDS_REVIEW`; without evidence, it is `UNABLE_TO_VERIFY`.
- Only the guide owner can review an attempt awaiting review. Review values are `PASSED`, `NEEDS_IMPROVEMENT`, and `UNABLE_TO_VERIFY`.
- Completion requires the latest attempt for every step to be `PASSED`.
- Reports count persisted latest attempts; no arbitrary score or AI-generated pass is returned.
- `POST /trainings/{id}/generate-steps` accepts only `{ "mode": "demo" }` and only the paper-bridge template. It returns explicit `simulated`, `provenance`, `humanReviewRequired`, and `approved: false` fields.

## Upload contract

Multipart field `file` accepts JPEG, PNG, WebP, MP4, MOV, and WebM up to 250 MiB. The server checks detected file content against the allowlist and creates a UUID storage key. Attempt evidence requires a `stepId`; a returned media asset ID can then be submitted in the attempt's `evidenceIds`. Files stay on private local disk in this development adapter; no cloud storage or malware scanner is configured.

For field limits, exact JSON schemas, and status codes, use the OpenAPI document rather than duplicating route assumptions in clients.