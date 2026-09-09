# Contributing

Thank you for improving CustDev Recorder.

## Before starting

- Search existing issues and open an issue for substantial behavior, API, privacy, or architecture changes.
- Never post real interview data, access tokens, cookies, client secrets, API keys, or populated environment files.
- Security reports belong in the private channel described in [SECURITY.md](SECURITY.md), not a public issue.

## Development workflow

1. Fork and create a focused branch from the current default branch.
2. Install Node.js 22.x and run `npm ci`.
3. Copy `.env.example` to `.env.local` only when provider-backed manual testing is needed. Use dedicated test credentials and data; `.env.local` is ignored by Git.
4. Follow test-driven development: add a failing `node:test` case, make the smallest implementation change, then refactor while green.
5. Run the complete checks in [TESTING.md](TESTING.md).
6. Update README/privacy/security documentation whenever data flow, permissions, configuration, API behavior, or limits change.

Keep pull requests small. Explain the user problem, implementation, privacy/security impact, tests, and manual verification. Screenshots are welcome for UI changes, but redact accounts and interview content. Do not commit generated dependencies, local Vercel state, recordings, or credentials.

## Style

- Use the existing dependency-light ES module architecture and Node built-ins where practical.
- Preserve clear browser/server trust boundaries. User Gemini keys must remain session-only and OAuth client secrets server-only.
- Validate methods, origin, authentication, input size/type, provider responses, filenames, and identifiers.
- Treat documents, audio, transcripts, model output, and provider errors as untrusted.
- Return stable JSON errors and avoid leaking credentials or upstream response bodies.
- Add tests at the nearest boundary; mock Google/Gemini network calls in automated tests.

By contributing, you agree that your contribution is licensed under the repository's MIT License.