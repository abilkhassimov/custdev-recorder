# CustDev Recorder

CustDev Recorder is a small, browser-based field recorder for customer-development interviews. It displays an editable questionnaire while recording, uses Google Gemini to transcribe and map answers to questions, then saves the original audio and a Markdown report to a folder selected in the user's own Google Drive.

> **Release status:** the automated test suite covers the local application and mocked provider boundaries. Google OAuth verification and a live Google/Gemini end-to-end test have **not** been completed. Keep an OAuth app in Testing mode until you have configured and validated your own deployment.

The current interface is in Russian. The source and public documentation are in English.

## Features

- Google sign-in with Authorization Code + PKCE and the narrow `drive.file` scope.
- Google Picker folder selection.
- Questionnaire import from PDF, DOCX, TXT, Markdown, or pasted text; manual creation and editing are also supported.
- In-browser microphone capture with questionnaire blocks visible during the interview.
- Mandatory bring-your-own-key (BYOK) Gemini parsing, chunked transcription with retries, and answer-to-question segmentation.
- Direct, resumable browser-to-Drive audio upload and server-side Markdown upload.
- Local JSON export of folder/questionnaire settings; no application database.
- Defensive upload validation, same-origin checks, encrypted session cookies, output normalization, and prompt-injection boundaries.

## Architecture and data flow

This is a static HTML/CSS/JavaScript frontend plus Vercel Node.js functions:

```text
Browser (MediaRecorder, editor, localStorage + session-only Gemini key)
  |-- OAuth redirects --------------------------> Google OAuth
  |-- folder picker + short-lived access token -> Google Picker / Drive
  |-- questionnaire text/file --> /api/questionnaire/parse --> Gemini
  |-- audio chunks ------------> /api/transcribe -----------> Gemini
  |-- transcript + questions -> /api/segment ---------------> Gemini
  |-- complete audio ----------> Drive resumable upload URL -> user's Drive
  `-- generated Markdown -----> /api/drive/save-text --------> user's Drive

Vercel functions hold no database state. The encrypted HttpOnly session cookie
contains the Google refresh token and email; SESSION_SECRET protects that cookie.
```

The browser records one conversation, sends audio batches (base64 JSON) to the transcription endpoint, joins the transcript, asks the segmentation endpoint to map answers, obtains a Drive resumable upload URL, uploads the complete audio directly to Google, verifies its parent folder, builds Markdown locally, and asks the backend to save that Markdown.

## Privacy model

This is **not** an offline or local-only recorder:

- Uploaded/pasted questionnaire content is sent through the deployment backend to Google Gemini for parsing (with a local fallback if that call fails).
- Recorded audio is sent in chunks through the backend to Google Gemini for transcription.
- The resulting transcript and questionnaire are sent to Gemini for segmentation.
- Original audio is uploaded to the user's selected Google Drive folder. The transcript and structured answers are saved there as a Markdown file.
- The app has no database. Folder ID/name and questionnaire are stored in that browser's `localStorage`; the Google refresh token and account email are held in an encrypted, HttpOnly session cookie.
- Every user supplies a Gemini API key. It is kept only in the current tab's `sessionStorage`, sent in `X-Gemini-API-Key` to same-origin endpoints, used only for that request, and forwarded only to Google Gemini. It is never included in localStorage, IndexedDB, cookies, exports, Markdown, Drive files, or application logs.

Obtain informed consent before recording. See [PRIVACY.md](PRIVACY.md) for retention and deletion details.

## Requirements

- Node.js **22.x** (as declared in `package.json`)
- npm
- A Google Cloud project with OAuth, Drive, Picker, and Gemini access configured
- Vercel CLI for local serverless development (`npx vercel dev` is sufficient)
- A modern browser supporting `MediaRecorder`, `getUserMedia`, `Blob`, and ES modules

Microphone access requires a secure context in production; `http://localhost` is accepted by browsers for local development.

## Google Cloud setup

Use one Google Cloud project for the OAuth client, Picker project number, and APIs. Console labels occasionally change, but the required resources are:

1. **Create/select a project.** Record its numeric **Project number** (not project ID) from project settings for `GOOGLE_CLOUD_PROJECT_NUMBER`.
2. **Enable APIs** under **APIs & Services → Library**:
   - Google Drive API
   - Google Picker API
   - Generative Language API (for Gemini), if your project/key workflow requires it
3. **Configure OAuth consent** under **Google Auth Platform / OAuth consent screen**:
   - Choose Internal only if every user belongs to your Google Workspace organization; otherwise choose External.
   - Supply app name, support email, developer contact, authorized domain, homepage, privacy-policy URL, and terms URL as appropriate.
   - Declare `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/drive.file`.
   - In **Testing**, add every intended account as a test user. External Testing apps are limited by Google's test-user and refresh-token policies and users may see an unverified-app warning.
   - Moving to Production does not itself prove verification. Complete Google's verification process when Google requires it; this repository does not claim that verification has occurred.
4. **Create a Web application OAuth client** under **APIs & Services → Credentials**:
   - Add `http://localhost:3000` as an authorized JavaScript origin for local development.
   - Add the exact redirect URI `http://localhost:3000/api/auth/callback`.
   - For production, add `https://YOUR_DOMAIN` as an origin and `https://YOUR_DOMAIN/api/auth/callback` as a redirect URI.
   - Copy the client ID and client secret. Redirect URIs must match `GOOGLE_REDIRECT_URI` exactly, including scheme, host, path, and port.
5. **Create a dedicated Picker browser key**:
   - Create an API key separate from the Gemini key.
   - Application restriction: **Websites (HTTP referrers)**.
   - Allow `http://localhost:3000/*` and each production origin, for example `https://YOUR_DOMAIN/*`. Add intentional Vercel preview patterns only if you plan to use them.
   - API restriction: restrict the key to **Google Picker API**.
   - Store it as `GOOGLE_PICKER_API_KEY`. It is intentionally returned to the browser by `/api/config`; referrer/API restrictions are its protection.
6. **Each user creates their own Gemini key** using Google AI Studio or their Google Cloud credential flow:
   - Restrict it to the Generative Language API where supported, monitor quota, and rotate it after suspected exposure.
   - Enter it during onboarding. It is held only for the current browser-tab session and can be replaced or cleared in Settings.
   - Never put it in deployment environment variables or reuse the Picker key. The backend deliberately has no owner-funded key fallback.

The backend requests offline access with `prompt=consent`, so Google is expected to return a refresh token. If it does not, revoke the app's access in the Google Account and reconnect.

## Environment variables

Copy the committed template; never commit the populated file:

```sh
cp .env.example .env.local
```

| Variable | Visibility | Purpose |
|---|---|---|
| `SESSION_SECRET` | Server only | At least 32 characters; derives the AES-256-GCM session key. Generate one with `openssl rand -base64 48`. Rotating it signs everyone out. |
| `GOOGLE_CLIENT_ID` | Server and `/api/config` | Web OAuth client ID; Picker also needs it. |
| `GOOGLE_CLIENT_SECRET` | Server only | Web OAuth client secret. |
| `GOOGLE_REDIRECT_URI` | Server only | Exact callback URL, locally `http://localhost:3000/api/auth/callback`. |
| `GOOGLE_PICKER_API_KEY` | Browser-visible | Dedicated referrer- and API-restricted Picker key. Never use the Gemini key. |
| `GOOGLE_CLOUD_PROJECT_NUMBER` | Browser-visible | Numeric Cloud project number used as Picker's app ID. |

## Local development

```sh
git clone YOUR_REPOSITORY_URL
cd custdev-recorder
npm ci
cp .env.example .env.local
# Edit .env.local with your own credentials.
npm test
npm run check
npx vercel dev --listen 3000
```

Open <http://localhost:3000>. `vercel dev` is required rather than a static file server because the `/api` functions perform OAuth, Gemini, and Drive operations. If prompted, link/create a Vercel project; do not pull production secrets into a shared workstation.

## User workflow

1. Sign in with Google and grant the requested Drive access.
2. Select a Drive folder with Google Picker.
3. Enter your Google Gemini API key for this tab. Closing the tab/browser session clears it; Settings can replace or clear it sooner.
4. Upload/paste a questionnaire or create one manually; review and edit every question.
5. Enter the project and interviewee name, obtain recording consent, and grant microphone access.
6. Move through questionnaire blocks while recording, then finish.
7. Keep the tab open while audio is transcribed, segmented, and uploaded.
8. Find the original audio and a `.md` report in the selected Drive folder.

On processing failure, the recording remains only in that open tab's memory for retry. Closing/reloading the tab loses it.

### No-database portability limitation

There is no account-backed application database. The selected folder metadata and questionnaire live under `custdev-recorder-settings` in that browser's `localStorage`. They do not automatically follow a user to another browser, device, browser profile, or cleared site storage. Use **Settings → Export JSON** for a backup; the current UI exports but does not import that JSON automatically. Drive files remain portable through Google Drive.

## API overview

All mutation endpoints enforce the request method and same-origin checks; authenticated endpoints require the encrypted session cookie. The three Gemini endpoints additionally require a conservatively validated `X-Gemini-API-Key` header. The key is read per request and never sourced from server environment configuration.

| Endpoint | Method | Purpose |
|---|---:|---|
| `/api/auth/google` | GET | Begin Google OAuth with state and PKCE. |
| `/api/auth/callback` | GET | Exchange code, fetch verified email, and set session cookie. |
| `/api/auth/session` | GET | Return authentication status and email. |
| `/api/auth/logout` | POST | Clear the local session cookie. |
| `/api/config` | GET | Return only Picker key, project number, and OAuth client ID. |
| `/api/google/access-token` | GET | Refresh and return a short-lived Google access token for Picker. |
| `/api/questionnaire/parse` | POST | Extract/parse a questionnaire from supported multipart file or JSON text. |
| `/api/transcribe` | POST | Transcribe one base64-encoded audio batch with Gemini. |
| `/api/segment` | POST | Map transcript content to questionnaire IDs. |
| `/api/upload-session` | POST | Create a Drive resumable audio upload URL. |
| `/api/verify-upload` | POST | Confirm the uploaded file is in the requested folder. |
| `/api/drive/save-text` | POST | Save generated Markdown to Drive. |

## Limits and operational constraints

- Questionnaire uploads/pasted input: 4 MiB; PDF, DOCX, TXT, and Markdown only. Extracted text is normalized to 200,000 characters.
- Parsed questionnaire: up to 20 blocks and 50 questions per block; title/text/hint lengths are normalized in `lib/ai.js`.
- One transcription request: 4 MiB of decoded audio and one of `audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`, or `audio/wav`.
- Joined transcript accepted by segmentation: 500,000 characters. Each mapped answer is capped at 2,000 characters.
- Markdown Drive upload: under 5,000,000 bytes.
- Vercel functions are configured with a 30-second maximum duration. The browser uses longer request timeouts, but host/provider limits still apply.
- Recordings are memory-backed; long interviews can consume substantial browser memory. Audio is not durably saved until the final Drive upload succeeds.
- Gemini quotas, pricing, model availability, and provider retention terms belong to the user who supplies the key; Drive terms belong to the connected account/project.

## Vercel deployment

1. Import/fork the repository into Vercel (Framework Preset: **Other** is sufficient) or run `npx vercel` from the repository.
2. Add all six variables from `.env.example` in **Project Settings → Environment Variables**. Do not configure a Gemini server key; users provide keys in the UI. Use the production callback URL for Production; preview deployments need their own exact redirect URI/configuration if used.
3. In Google Cloud, add the final Vercel/custom-domain origin and exact `/api/auth/callback` redirect, and add its `/*` referrer to the Picker key.
4. Deploy, then verify `/api/config`, sign-in, folder selection, a short consented test recording, and both Drive files using non-sensitive test data.
5. Keep OAuth in Testing with explicit test users until your consent screen, domains, policies, and verification status are ready. This project has not established public OAuth verification or live Google E2E completion.

Do not deploy `.env.local`, do not expose server variables as client-prefixed values, and do not broadly allow wildcard referrers for the Picker key.

## Troubleshooting

- **`redirect_uri_mismatch`:** make `GOOGLE_REDIRECT_URI` and the OAuth client's authorized redirect URI byte-for-byte identical; restart local dev after changing env.
- **Access blocked / app unavailable:** add the account under OAuth test users, check Internal-vs-External audience, or complete Google's required production/verification steps.
- **Authorization fails after consent:** Google may not return a refresh token. Revoke prior app access, reconnect, and ensure the app requests offline access; also check client ID/secret and callback URL.
- **Picker does not open / `/api/config` returns 503:** enable Picker API and set a numeric project number, OAuth client ID, and dedicated Picker key. Check browser console for referrer/API-key restriction errors.
- **Drive folder or upload denied:** enable Drive API, reconnect to grant `drive.file`, and select the folder through this app. The scope is intentionally not broad read/write access to all Drive files.
- **Gemini unavailable, key rejected, or parsing falls back:** enter a current Google Gemini key in Settings and verify its Generative Language API access, restrictions, billing/quota, and model availability. Do not paste keys into logs or support reports. Questionnaire parsing has a basic fallback; transcription does not.
- **413 / unsupported type:** respect the per-request limits and MIME types above. A filename extension alone is not sufficient for questionnaire files.
- **Microphone denied / empty recording:** use HTTPS or localhost, grant browser/OS microphone permission, keep the device connected, and retry with a supported browser.
- **Works locally but not on Vercel:** compare environment scopes (Development/Preview/Production), callback domain, Picker referrers, and function logs. Environment changes require a redeploy.

## Security

- Never commit credentials or real interview data. Users must keep their Gemini key private and apply least-privilege restrictions; operators must not configure or log an owner key.
- Sessions are AES-256-GCM sealed, HttpOnly, SameSite=Lax cookies (`Secure` in production), with a 30-day expiry. OAuth state expires after five minutes and uses HMAC plus PKCE.
- There is no server-side session revocation store. Logout clears this browser's cookie; revoke the app in the Google Account to invalidate Google authorization, and rotate OAuth credentials/`SESSION_SECRET` after compromise.
- `drive.file` limits the app to files it creates or that users explicitly open/select with it; access tokens are still sensitive and briefly exposed to browser code for Picker/direct upload.
- Prompt hardening and validation reduce risk but do not make AI output infallible. Review generated questions and reports.
- Apply platform-level rate limiting, monitoring, spending alerts, and abuse controls before opening a deployment publicly; the code does not implement per-user rate limits.

Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Do not include secrets, tokens, or sensitive interview recordings in reports.

## Development and license

See [CONTRIBUTING.md](CONTRIBUTING.md) and [TESTING.md](TESTING.md). Licensed under the [MIT License](LICENSE).