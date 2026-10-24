# Security Policy

## Project status

SkillMirror AI is a prototype. Do not assume that its authentication, upload handling, authorization, encryption, retention, or AI-provider integrations are production-ready unless the current implementation and tests demonstrate that they are.

## Reporting a vulnerability

Please do not report exploitable security vulnerabilities in public issues.

Instead, contact the maintainers through the private security/contact channel listed in the repository or organization profile. Include:

- Affected component and version/commit, if known.
- A concise description of the issue and its impact.
- Reproduction steps or a proof of concept that does not access other people's data.
- Any suggested mitigation.

Do not include real API keys, private videos, personal records, or third-party data in the report. If no private reporting channel is configured, ask a maintainer for one before sharing technical details publicly.

## Security priorities

The project should treat these as security-sensitive areas:

- Uploaded videos, images, extracted frames, and generated reports.
- File size/type validation and media processing libraries.
- Authentication, task ownership, and access control for media and reports.
- AI-provider API keys and server-side secrets.
- Prompt injection or malicious instructions embedded in uploaded content.
- Cross-origin settings, rate limits, and abuse of expensive inference endpoints.
- Logs that may accidentally store sensitive media, extracted text, or identifiers.

## Minimum safeguards before real-user use

- Keep private API keys on the server; never expose them through `VITE_*` variables.
- Use explicit authorization checks for every private task and media resource.
- Apply upload size limits, content validation, and safe file storage practices.
- Configure allowed origins explicitly; do not use permissive CORS in production.
- Provide clear consent, retention, and deletion behavior for recordings.
- Redact sensitive data from logs and error reports.
- Pin and update dependencies; scan for known vulnerabilities.
- Avoid deploying the prototype for safety-critical training or certification.

## Supported versions

No formal supported-version policy has been established yet. When releases are introduced, list supported versions here.
