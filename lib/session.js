import { parseCookies } from './cookies.js';
import { openSession } from './security.js';
import { HttpError } from './http.js';
export function requireSession(req, secret) {
  const value = parseCookies(req.headers.cookie || '').session;
  if (!value) throw new HttpError(401, 'Authentication required', 'unauthenticated');
  try { const session = openSession(value, secret); if (!session.refreshToken || !session.email) throw new Error(); return session; }
  catch { throw new HttpError(401, 'Authentication required', 'unauthenticated'); }
}
