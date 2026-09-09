# Security Policy

## Self-host responsibility

There is no owner-operated deployment or shared credential/quota. Each operator is responsible for TLS, host patching, access controls, rate limits, spending alerts, OAuth consent, key restrictions, logs, backups, and incident response. Never send secrets or sensitive recordings in a vulnerability report. Use separate Gemini and browser-restricted Picker keys and keep `GEMINI_API_KEY`, `GOOGLE_CLIENT_SECRET`, and `SESSION_SECRET` server-only.

## Supported version

Until versioned releases are published, only the latest commit on the default branch is supported with security fixes. Older commits, forks, and third-party deployments are not supported by this policy.

## Private reporting

Please **do not open a public issue** for a suspected vulnerability.

Use this repository's **GitHub Security Advisories** page and select **Report a vulnerability** to start a private discussion with the maintainers. This is the project's private-reporting contact placeholder; repository owners should enable private vulnerability reporting in **Settings → Security → Code security and analysis** before public launch. If that button is unavailable, do not publish exploit details—contact the repository owner through their GitHub profile and ask for a private reporting channel.

Include:

- affected commit and deployment context;
- impact and reproducible steps using non-sensitive test data;
- suggested remediation, if known.

Do not send OAuth credentials, API keys, session cookies, personal data, or interview recordings. Allow a reasonable period for triage and remediation before disclosure. Receipt and fix timelines are not guaranteed for this volunteer project.

## Deployment responsibility

Operators control their Google Cloud project, Vercel environment, credentials, privacy disclosures, access controls, logs, quotas, and legal compliance. A vulnerability in a particular deployment may need to be reported to that operator as well as upstream.