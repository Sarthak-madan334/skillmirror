# Architecture Decision Log

This log records important design choices. Add a new dated entry when a decision materially changes; do not silently rewrite a decision that has already shaped implementation.

## ADR-001: Instructor approval is required

**Status:** Accepted for MVP

**Decision:** An AI-generated procedure is a draft until a qualified instructor edits or approves it.

**Reason:** Video interpretation can omit steps or infer the wrong intent. Human review provides a defined checkpoint before learners follow the instructions.

**Consequences:** The procedure data model needs draft/review/approved states and version history. The UI must make the current approval state visible.

## ADR-002: Insufficient evidence is a first-class result

**Status:** Accepted for MVP

**Decision:** Checkpoint results include `unable_to_verify` in addition to `pass` and `retry`.

**Reason:** Image quality, occlusion, angle, and task ambiguity can prevent reliable assessment. A forced binary decision would overstate certainty.

**Consequences:** Evaluators and UI components must support requests for clearer evidence and instructor review.

## ADR-003: Begin with one low-risk task

**Status:** Accepted for MVP

**Decision:** The first end-to-end prototype focuses on one simple, non-hazardous task with observable criteria.

**Reason:** Reliable evaluation on a narrow task is more useful than a broad demo with mostly simulated functionality.

**Consequences:** General-purpose claims and high-risk task categories remain out of scope until separately validated.

## ADR-004: Keep AI-provider integration behind an interface

**Status:** Proposed

**Decision:** Procedure generation and visual interpretation should be invoked through backend service abstractions.

**Reason:** This allows model providers to be changed, tested with fixtures, or disabled without rewriting API routes and UI code.

**Consequences:** Define explicit request/response schemas and distinguish provider errors from evaluation outcomes.
