# Agent installation runbook (authoritative)

This repository is an independently self-hosted application. The installer owns the host, Google Cloud project, OAuth consent/client, API keys, Drive data, billing, and quotas. There is no project-owner service or shared account.

## Safety contract

- Never ask a user to paste secrets into chat, issues, logs, screenshots, commits, or agent context. Ask them to enter secrets directly in their host's encrypted environment-variable UI or a local ignored file.
- Never read `.env.local`, `.env`, `.vercel/`, shell history, or host secret stores. Verify presence/formats with `npm run preflight`; it never prints values.
- Never commit credentials. Picker and Gemini keys must be separate. `GEMINI_API_KEY`, OAuth secret, and session secret remain server-only.
- Do not deploy, change Google Cloud, purchase services, push, or rotate/delete credentials without explicit approval. Manual console steps belong to the user.

## 1. Discover and validate prerequisites

1. Run `git status --short`, `git remote -v`, `node --version`, `npm --version`, and `docker --version` (if Docker is planned). Require Node 22.x and a clean/understood working tree.
2. Read `README.md`, `docs/AGENT_SETUP.md`, `.env.example`, and provider policy files. Do not inspect populated env files.
3. Install reproducibly: `npm ci`.
4. Baseline: `npm test && npm run check && npm audit --omit=dev`.
5. The user must choose a final origin: local `http://localhost:3000`, Vercel `https://PROJECT.vercel.app`, or VPS `https://APP.DOMAIN`. Derive the callback as `ORIGIN + /api/auth/callback`; no other path, query, fragment, or trailing slash.

## 2. User-only Google Cloud steps

Ask the user to perform these in their own account without sharing values:

1. Create/select a project and note its numeric project number.
2. Enable Google Drive API, Google Picker API, and Generative Language API.
3. Configure OAuth consent (External or Workspace Internal), scopes `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/drive.file`; add test users while in Testing.
4. Create a Web OAuth client. Add the exact origin and exact callback derived above. Local examples are `http://localhost:3000` and `http://localhost:3000/api/auth/callback`.
5. Create a dedicated browser Picker key, restricted to Google Picker API and the exact origin referrer (`https://APP.DOMAIN/*`).
6. Create a separate Gemini key restricted to Generative Language API where available. Never reuse the Picker key.
7. Enter all seven names listed in `docs/AGENT_SETUP.md` directly in the deployment secret store.

## 3A. Vercel path

1. Fork/import the canonical repository, or click the README deploy button, into the user's Vercel account. Framework preset: Other.
2. Add all seven variables in Project Settings. Set `GOOGLE_REDIRECT_URI=https://FINAL_HOST/api/auth/callback` for each environment actually used. Stable production/custom domains are recommended; every preview hostname needs a separately authorized callback/referrer.
3. Run locally with non-secret placeholders only for smoke checks: `npm run build`. Vercel runs `npm run vercel-build`.
4. With approval, deploy. Never pull or display remote secrets. Then run `npm run verify:deployment -- https://FINAL_HOST`.

## 3B. Generic VPS/Docker path

1. Build: `docker build -t custdev-recorder .`.
2. Store the seven variables in a root-readable host env file outside the repository or a container secret manager; run `npm run preflight` in an equivalent protected environment before starting.
3. Run behind a TLS reverse proxy: `docker run --restart unless-stopped --env-file /secure/path/custdev.env -p 127.0.0.1:3000:3000 custdev-recorder`.
4. Configure Caddy/nginx/Traefik to terminate HTTPS and proxy to `127.0.0.1:3000`, preserving `Host` and `X-Forwarded-Proto: https`. Do not expose port 3000 publicly. Set callback to `https://APP.DOMAIN/api/auth/callback`.
5. Run `npm run verify:deployment -- https://APP.DOMAIN` from a separate machine.

## 4. Verification

Run `npm run preflight`, `npm test`, `npm run check`, `npm audit --omit=dev`, and `npm run verify:deployment -- ORIGIN`. The verifier sends no credentials and checks page/static/config, OAuth redirect, security headers, unknown-route errors, and method protection. Manually use a non-sensitive test account to complete OAuth, open Picker, record a few consented seconds, and confirm audio plus Markdown in that account's Drive. Inspect logs for errors only; never log tokens or content.

## 5. Troubleshooting

- `redirect_uri_mismatch`: compare the exact HTTPS origin and `/api/auth/callback` in Google, host env, and browser; redeploy after env changes.
- `/api/config` 503/Picker failure: check the numeric project number, dedicated key restrictions, API enablement, and exact referrer.
- OAuth blocked/no refresh token: add the test user; verify audience; revoke prior app access and reconnect.
- Gemini errors: verify the installer's API enablement, key restriction, model availability, billing, and quotas.
- Cookies/origin fail behind proxy: ensure public HTTPS, preserved `Host`, and `X-Forwarded-Proto: https`.
- Container unhealthy: inspect redacted logs, `docker ps`, and local `curl -I http://127.0.0.1:3000/`.

## 6. Rollback

1. Keep the prior immutable image/deployment. Roll traffic back in Vercel or restart the previous Docker tag.
2. Do not roll back environment variables unless intentionally restoring known-good credentials. Rotating `SESSION_SECRET` signs out all sessions.
3. If compromise is suspected, revoke the OAuth client/app access and affected keys first, rotate secrets in the user's provider/host, redeploy, and invalidate old containers/deployments.
4. Re-run public verification and one manual non-sensitive flow. Never delete Drive data automatically.