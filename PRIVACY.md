# Privacy Notice

This notice describes the open-source CustDev Recorder code. Each deployment is operated independently. Its operator must identify themselves, provide any legally required notice/contact, configure Google/Vercel accounts, and update this document for their jurisdiction and practices.

## Data processed

When you use the app:

- your Google account email and OAuth credentials are processed to connect Google Drive;
- the selected Drive folder ID/name and questionnaire are stored in your browser;
- questionnaire files or pasted questionnaire text are sent to the deployment backend and then to **Google Gemini** for conversion into structured questions;
- microphone audio is held in the open browser tab and sent in chunks to the deployment backend and then to **Google Gemini** for transcription;
- the resulting transcript and questionnaire are sent to **Google Gemini** to map interview answers to questions;
- the original audio is uploaded to your selected **Google Drive** folder, and the transcript plus structured answers are saved there in a Markdown file;
- normal hosting/provider metadata may be processed, such as IP address, timestamps, user agent, request logs, errors, usage, and security events, according to the deployment operator's and providers' settings.

Do not record anyone without informed consent. Interviews can contain personal, confidential, or sensitive information. The app is not represented as suitable for regulated data.

## Cookies and local storage

The app uses first-party, strictly functional cookies:

- `oauth_state`: an HttpOnly, SameSite=Lax OAuth state/PKCE cookie lasting up to five minutes;
- `session`: an encrypted and authenticated HttpOnly, SameSite=Lax cookie containing the Google refresh token and account email, lasting up to 30 days. It is marked Secure in production.

The browser stores `custdev-recorder-settings` in `localStorage`. It contains the selected folder ID/name and questionnaire. It does **not** contain Google tokens. The app does not include advertising or analytics cookies.

## Storage, retention, and deletion

CustDev Recorder has no application database. Backend functions process request data transiently and the source code does not intentionally persist questionnaire content, audio, transcripts, or tokens to an application datastore. However, deployment and external providers may retain request data or logs under their own configurations and terms.

- Local settings remain until you use **Settings → Reset**, clear site data, or remove them through browser controls. Exported settings JSON remains wherever you saved it.
- The session cookie remains for up to 30 days unless you sign out or clear cookies. Signing out clears the local cookie; it does not necessarily revoke Google's grant. Revoke access from your Google Account's third-party connections to invalidate authorization.
- An unfinished recording exists only in memory in the open tab and is lost when the tab reloads/closes. On success, the audio and Markdown persist in your Google Drive according to your Drive retention rules.
- Delete saved audio/Markdown through Google Drive (and empty Trash if immediate permanent deletion is required). The app does not remotely delete those files when you reset settings or sign out.
- Contact the deployment operator for deletion of any hosting logs they control. Google and Vercel process and retain data under the operator's account settings and their own terms/privacy policies.

## Data sharing and transfers

Data is disclosed to Google services (OAuth, Picker, Drive, and Gemini/Generative Language API) and to the deployment hosting provider (typically Vercel) as needed to provide the service. Their infrastructure may process data in other countries. The open-source project does not sell data and contains no ad or analytics integration.

## Security and user choices

The app uses a restricted OAuth scope, encrypted session cookies, same-origin checks, input limits, and validation, but no system is risk-free. You can avoid processing by not using the app, use non-identifying interviewee codes, minimize questionnaire/interview data, stop before recording, sign out, reset local settings, revoke Google access, and delete Drive files.

For a specific hosted instance, direct privacy requests to that deployment's operator. For security vulnerabilities in the source, follow [SECURITY.md](SECURITY.md).