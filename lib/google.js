import { HttpError } from './http.js';
export async function refreshAccessToken(refreshToken, env, fetchImpl = fetch) {
  const body = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token' });
  const response = await fetchImpl('https://oauth2.googleapis.com/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:body.toString() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) throw new HttpError(502, 'Unable to refresh Google access', 'google_token_error');
  return { accessToken:data.access_token, expiresIn:data.expires_in };
}
