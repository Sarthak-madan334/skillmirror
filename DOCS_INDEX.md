# Documentation Index

- [README.md](README.md) — product status, local setup, and limitations
- [Backend setup](backend/README.md) — environment, migrations, seed, tests, and backend limitations
- [OpenAPI contract](backend/openapi.yaml) — implemented `/api/v1` endpoints
- [Architecture](docs/ARCHITECTURE.md) — data model, authorization, and service boundaries
- [API notes](docs/API.md) — authentication, response, upload, and assessment semantics
- [Development guide](docs/DEVELOPMENT.md) — commands and local workflow
- [Testing strategy](docs/TESTING.md) — backend/frontend test scope and remaining integration gates
- [Deployment checklist](docs/DEPLOYMENT.md) — current deployment prerequisites and production gaps
- [Roadmap](docs/ROADMAP.md) — completed prototype work and future capabilities

## Remaining

- Add CI for frontend, backend, and Prisma schema checks.
- Run the full create/publish/session/upload/review/report and user-isolation integration checks against PostgreSQL (the initial migration and health/readiness checks pass in the local Docker setup).
- Add private durable object storage and malware scanning before production uploads.
- Add real AI/verification providers only with validated schemas, provenance, and evaluated datasets.
- Choose a project license before external distribution.

For a Vercel frontend and Render API deployment, see [Deployment checklist](docs/DEPLOYMENT.md), including the same-site custom-domain requirement for the current session cookie and the free-tier storage/database limitations.
