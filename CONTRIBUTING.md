# Contributing to MoroccoAPI

Thank you for helping make Moroccan public open data easier to use responsibly.

## Before contributing

Please read:

- `docs/RFC-0001.md`
- `docs/DATASET_POLICY.md`
- `GOVERNANCE.md`
- `CODE_OF_CONDUCT.md`

## Ways to contribute

- Research an authoritative data source and its license.
- Improve schemas, validation, or transformation pipelines.
- Write API or integration tests.
- Improve Arabic, French, and English documentation.
- Report data-quality problems with reproducible evidence.
- Help maintain community discussions and contributor onboarding.

## Proposing a dataset

Use the **Propose a dataset** issue template. A proposal must include:

- Producer and source URL.
- Dataset page and direct resource URL, if different.
- Exact license and attribution requirements.
- File format, approximate size, and update frequency.
- Presence or absence of personal or sensitive data.
- Proposed endpoints and user value.
- Known quality limitations.

Do not submit scraped data without documented permission for automated access and redistribution.

## Pull requests

- Keep each pull request focused.
- Link the relevant issue or RFC.
- Add or update tests.
- Preserve existing API contracts.
- Document source and license changes.
- Do not commit secrets, personal data, or unapproved raw datasets.

Breaking API changes require a new version or an approved migration RFC.

## Commit style

Use Conventional Commits where practical:

```text
feat(geo): add region schema
fix(pipeline): reject missing source license
docs(rfc): clarify attribution requirements
```

## Local development

Use Node.js 22 or newer:

```bash
npm install
npm run dev
```

Run every local check before opening a pull request:

```bash
npm run check
```

This command checks TypeScript, runs the test suite, builds the production output, and audits dependencies. Interactive API documentation is available at `http://127.0.0.1:3000/docs` while the development server is running.
