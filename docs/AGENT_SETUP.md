# Agent setup checklist

The YAML block is the machine-readable installation contract. `value` fields are intentionally absent; agents must never request or print secret values.

```yaml
schema_version: 1
deployment_model: independent-self-host
callback:
  derivation: "${PUBLIC_ORIGIN}/api/auth/callback"
  exact_path: /api/auth/callback
  production_https_required: true
required_environment:
  - {name: SESSION_SECRET, visibility: server, required: true, minimum_length: 32}
  - {name: GOOGLE_CLIENT_ID, visibility: public-config, required: true}
  - {name: GOOGLE_CLIENT_SECRET, visibility: server, required: true}
  - {name: GOOGLE_REDIRECT_URI, visibility: server, required: true, exact_path: /api/auth/callback}
  - {name: GEMINI_API_KEY, visibility: server, required: true, distinct_from: GOOGLE_PICKER_API_KEY}
  - {name: GOOGLE_PICKER_API_KEY, visibility: browser, required: true, distinct_from: GEMINI_API_KEY}
  - {name: GOOGLE_CLOUD_PROJECT_NUMBER, visibility: public-config, required: true, format: digits}
checklist:
  - {id: source-reviewed, command: "git status --short", manual: false}
  - {id: dependencies-installed, command: "npm ci", manual: false}
  - {id: google-apis-enabled, manual: true}
  - {id: oauth-consent-configured, manual: true}
  - {id: exact-callback-authorized, manual: true}
  - {id: picker-key-restricted, manual: true}
  - {id: gemini-key-separated, manual: true}
  - {id: environment-validated, command: "npm run preflight", manual: false}
  - {id: tests-passed, command: "npm test && npm run check && npm audit --omit=dev", manual: false}
  - {id: deployment-verified, command: "npm run verify:deployment -- https://YOUR_DOMAIN", manual: false}
  - {id: live-provider-smoke-test, manual: true}
```

For local development, callback is `http://localhost:3000/api/auth/callback`. For Vercel it is `https://YOUR_STABLE_VERCEL_OR_CUSTOM_DOMAIN/api/auth/callback`. For VPS/Docker it is `https://YOUR_DOMAIN/api/auth/callback`. The configured Google authorized URI and `GOOGLE_REDIRECT_URI` must be byte-for-byte identical.

Runbook and safety requirements: [`../AGENTS.md`](../AGENTS.md).