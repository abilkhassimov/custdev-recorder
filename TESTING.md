# Testing

## Self-host installation gates

```sh
npm ci
npm test
npm run check
npm audit --omit=dev
# In a protected environment containing all seven variables; output never includes values:
npm run preflight
# After deployment; sends no cookies, authorization, request bodies, or secrets:
npm run verify:deployment -- https://YOUR_DOMAIN
```

`preflight` validates required names, credential shapes/separation, the exact `/api/auth/callback` path, and HTTPS in production. `verify:deployment` checks page/static/config behavior, OAuth redirect, baseline security headers, method rejection, and controlled unknown-route errors. It does not complete OAuth or call Gemini/Drive: manually test those with non-sensitive data and the operator's own accounts.

Server and script changes require strict TDD. Keep route/static traversal tests in the full suite. A Vercel build smoke test is `npm run vercel-build`; test the container with `docker build -t custdev-recorder:test .` when Docker is available.

The automated suite uses Node's built-in test runner and mocked Google/Gemini boundaries. It does not require secrets or network access.

## Verified commands

From a clean checkout with Node.js 22.x:

```sh
npm ci
npm test
npm run check
```

- `npm test` runs every `test/*.test.js` file through `node --test`.
- `npm run check` applies `node --check` to the frontend, API handlers, and libraries listed in `package.json`.

These commands are the required local gate. They verify unit/integration behavior with mocks and JavaScript syntax; they do not prove browser compatibility, a deployed OAuth flow, Google verification, or live Google/Gemini behavior.

## Test-driven development

Use a RED–GREEN–REFACTOR loop:

1. **RED:** add the smallest failing test demonstrating the desired behavior or regression. Prefer deterministic fixtures and injected `fetch`/environment dependencies.
2. **GREEN:** implement only enough production code to pass that test, then run `npm test`.
3. **REFACTOR:** simplify without changing behavior, run both commands above, and review the diff for privacy/security changes.

Tests belong under `test/` and use `node:test` plus `node:assert/strict`. Cover success, invalid input, provider failure, authentication, same-origin enforcement, size limits, and secret non-disclosure where relevant. Never put live keys or personal interview data in fixtures.

## Optional local browser smoke test

After configuring dedicated test credentials in `.env.local`:

```sh
npx vercel dev --listen 3000
```

At <http://localhost:3000>, use non-sensitive test data to check sign-in, folder selection, questionnaire import/editing, microphone denial and approval paths, a short recording, retry behavior, and creation of both Drive files. Delete the test files afterward.

Live testing consumes provider quota and sends questionnaire/audio/transcript data to Google. It must be performed only with consented, disposable data. **No live Google end-to-end result or OAuth verification is asserted by this repository documentation.**

## Pre-commit safety review

Before committing:

```sh
git diff --check
git status --short
git diff -- . ':!package-lock.json'
```

Also inspect tracked changes for credentials or private data. A useful local heuristic (not a substitute for a dedicated scanner) is:

```sh
git grep -nEI '(AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|client_secret[^[:alnum:]]*[:=][^[:space:]]+)' -- ':!package-lock.json'
```

Expected placeholders in documentation/templates must still be reviewed manually. Do not read, stage, or scan `.env.local` into logs; scan tracked files and the staged diff.