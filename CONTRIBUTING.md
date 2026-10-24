# Contributing to SkillMirror AI

Thanks for your interest in improving SkillMirror AI. Contributions can include code, bug reports, documentation, accessibility improvements, test cases, and feedback from real training workflows.

> **Project status:** SkillMirror AI is a hackathon-stage concept/prototype. Check the current repository before assuming a feature, endpoint, or development command exists.

## Before you start

1. Read the [README](README.md) and [development guide](docs/DEVELOPMENT.md).
2. Search existing issues and pull requests to avoid duplicating work.
3. For substantial changes, open an issue first to discuss scope and approach.
4. Never include private training videos, personal data, credentials, or proprietary workplace material in issues or test fixtures.

## Good first contributions

- Improve keyboard navigation, mobile layout, and accessible labels.
- Add representative tests for task steps and checkpoint outcomes.
- Improve the instructor review flow or the `Unable to verify` state.
- Add sample low-risk task fixtures using synthetic images/data.
- Clarify documentation where it implies an unimplemented feature is available.

## Development workflow

1. Create a focused branch from the repository's default branch.
2. Make the smallest coherent change.
3. Add or update tests and documentation.
4. Run the checks that apply to your changes; record any checks you could not run.
5. Open a pull request describing the user problem, implementation, verification, and limitations.

Suggested branch names: `feat/task-editor`, `fix/checkpoint-state`, `docs/setup-guide`, `test/procedure-validation`.

## Code and product principles

- Keep AI-generated procedures editable and subject to instructor approval.
- Never report a visual checkpoint as passed when evidence is insufficient; use `Unable to verify`.
- Separate model-generated suggestions from deterministic validation results.
- Link feedback to specific visible evidence or a rule where possible.
- Keep provider-specific AI code behind a service interface.
- Validate uploads, restrict file types and sizes, and avoid exposing uploaded media publicly.
- Do not introduce safety-critical task certification into the MVP.
- Do not commit `.env` files, API keys, private videos, user records, or generated media containing personal information.

## Pull request checklist

- [ ] The change has a clear purpose and bounded scope.
- [ ] Tests were added or updated where appropriate.
- [ ] Relevant checks pass, or limitations are explained.
- [ ] User-facing behavior and documentation are updated.
- [ ] No secrets or private media are included.
- [ ] Uncertain computer-vision results are not presented as confirmed facts.
- [ ] UI changes have been checked at a narrow/mobile viewport and with keyboard navigation where relevant.

By contributing, you agree to follow the project's [Code of Conduct](CODE_OF_CONDUCT.md).
