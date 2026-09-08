# CustDev Recorder

Browser recorder that transcribes interviews and saves the original audio plus Markdown notes directly to a user-selected Google Drive folder.

## Configuration

Copy `.env.example` and configure these deployment environment variables:

- `SESSION_SECRET` — random value of at least 32 characters.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` — OAuth web-client settings.
- `GEMINI_API_KEY` — **server-only** key used by questionnaire parsing, transcription, and segmentation. Never expose this key to browser code.
- `GOOGLE_PICKER_API_KEY` — a separate browser-restricted key for Google Picker. Restrict it by HTTP referrer and API.
- `GOOGLE_CLOUD_PROJECT_NUMBER` — numeric project number used as the Picker app ID.

`GOOGLE_PICKER_API_KEY` must not be the Gemini server key. `/api/config` only returns Picker values and has no fallback to `GEMINI_API_KEY`.

## Development

```sh
npm test
npm run check
npx vercel dev
```
