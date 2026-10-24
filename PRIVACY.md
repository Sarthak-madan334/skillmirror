# Privacy and Data Handling

## Purpose

SkillMirror AI may process task videos, images, extracted frames, procedure drafts, learner submissions, and progress results. These materials may reveal faces, workplaces, proprietary processes, or other sensitive information. Privacy must be designed into the product from the start.

This document describes recommended handling rules for the prototype; it is not a statement that every safeguard is already implemented.

## Data minimization

- Collect only the media and fields needed to create or assess a specific training task.
- Avoid collecting names, contact details, location, or biometric identifiers unless a documented requirement exists.
- Prefer synthetic, staged, or consented demonstration footage for hackathon demos.
- Do not use uploaded recordings to train models unless users have been separately informed and have given appropriate permission.

## Notice and consent

Before recording or uploading video, explain what will be processed, why it is needed, which services may receive it, who can view it, and how to request deletion. Obtain permission from people who appear in a recording and permission to use any workplace or proprietary material.

## Storage, access, and deletion

- Keep uploads private by default.
- Apply access control to each task, video, extracted frame, and report.
- Define retention periods and implement deletion for originals, derived frames, and generated outputs.
- Avoid embedding direct public media URLs in logs or reports.
- If an external AI provider processes media, disclose this and review its data-handling terms before real-user use.
- Backups and provider-side copies must be considered in the deletion policy.

## Data in development and demos

- Use synthetic or staged sample data.
- Never commit videos, extracted frames, local databases containing user data, or `.env` files.
- Redact tokens and personal information from screenshots, logs, and bug reports.

## Security and model limitations

Uploaded files must be treated as untrusted input. Content in a video, frame, caption, or document must not be allowed to override system instructions or authorization policies. AI outputs should be validated and treated as suggestions until approved by an instructor.

## Questions

For privacy questions, contact the maintainers through the contact method provided in the repository. Do not publish private recordings or personal records in an issue.
