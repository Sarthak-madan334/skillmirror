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

Before recording or uploading video, explain what will be processed, why it is needed, which services may receive it, who can view it, and how to request deletion. Obtain permission from people who appear in a recording and permission to use any workplace or proprietary material. The current API workspace asks learners to opt in before still images or up to four sampled frames from a short video are sent to the configured OpenAI model. Frame extraction happens in the browser; the full video is not sent to the model. Guide generation sends the task title and description to OpenAI when the author selects AI drafting. This UI notice is a prototype safeguard, not a complete legal consent or data-retention program.

## Storage, access, and deletion

- Keep uploads private by default.
- Apply access control to each task, video, extracted frame, and report.
- Define retention periods and implement deletion for originals, derived frames, and generated outputs.
- Avoid embedding direct public media URLs in logs or reports.
- AI calls use the OpenAI Responses API with response storage disabled, but this does not replace reviewing current provider data-handling terms or deciding whether the account's retention settings meet the project's needs.
- Backups and provider-side copies must be considered in the deletion policy.

## Data in development and demos

- Use synthetic or staged sample data.
- Never commit videos, extracted frames, local databases containing user data, or `.env` files.
- Redact tokens and personal information from screenshots, logs, and bug reports.

## Security and model limitations

Uploaded files must be treated as untrusted input. Content in an image, video, caption, or document must not be allowed to override system instructions or authorization policies. AI outputs use structured schemas but can still be incorrect; procedure drafts require instructor approval, image/frame assessments are advisory, and only a human owner can record a pass. Model accuracy evaluation is not implemented.

## Questions

For privacy questions, contact the maintainers through the contact method provided in the repository. Do not publish private recordings or personal records in an issue.
