# Roadmap

This roadmap distinguishes the implemented local prototype and API from future production/AI work. Prioritize reliable workflow and reviewed evidence over partially working automation.

## Phase 0 — Scope and fixtures

- [ ] Select one non-hazardous task with visible, testable steps.
- [ ] Interview at least one instructor and several learners.
- [ ] Define expected outcomes and evaluation limits.
- [ ] Prepare consented or synthetic demonstration media.

**Exit criteria:** The task can be assessed using clear observable criteria and a small labeled example set.

## Phase 1 — Functional MVP

- [x] Local frontend prototype for task library, guide creation, and editing.
- [x] Server-backed training CRUD, step editing/reorder, and owner/published access rules.
- [x] Validated local demonstration/evidence upload endpoints.
- [x] Instructor-editable procedure drafts and owner-controlled publishing.
- [ ] Versioned procedure approvals and audit history.
- [x] Learner guided-practice view with local self-checks.
- [ ] Automated checkpoint evaluator for the selected task.
- [x] Human-reviewed `PASSED`, `NEEDS_IMPROVEMENT`, and `UNABLE_TO_VERIFY` outcomes.
- [x] Local practice summary and browser-storage tests.
- [x] Prisma schema, initial PostgreSQL migration, and backend service/API tests.
- [ ] Apply migration and run integration tests against PostgreSQL.
- [x] API-backed sessions, evidence attempts, human review, and derived reports.

**Exit criteria:** A single task can be completed with human-reviewed attempts; simulated template output is never presented as real inference.

## Phase 2 — Reliable feedback

- [ ] Build a broader evaluation dataset for the chosen checkpoint.
- [ ] Measure false passes and false failures.
- [ ] Link feedback to the evidence and approved rule.
- [ ] Add retry guidance for poor camera angles or occlusion.
- [ ] Add robust upload processing and retry behavior.
- [ ] Add access controls, retention, and deletion flows.

**Exit criteria:** Known failure modes are documented and unclear evidence fails safely.

## Phase 3 — Multiple task templates

- [ ] Support more than one low-risk task type.
- [ ] Add instructor dashboard and learner progress comparison.
- [ ] Add exportable training guide and assessment summary.
- [ ] Improve mobile capture guidance and accessibility.

**Exit criteria:** The same workflow can be configured for distinct tasks without rewriting core logic.

## Phase 4 — Research and expansion

- [ ] Evaluate adaptive practice based on repeated errors.
- [ ] Test multilingual instructions with human review.
- [ ] Explore multi-view evidence and object/hand tracking.
- [ ] Run a supervised pilot with a training partner.
- [ ] Assess performance and privacy before any higher-risk domain expansion.

## Non-goals for the early prototype

- Certifying competence for hazardous work.
- Replacing qualified instructors or safety procedures.
- Claiming reliable understanding of every physical task from a single video.
- Automatically publishing AI-generated procedures without review.
- Using learner recordings for model training without informed consent.
