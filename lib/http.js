export class HttpError extends Error { constructor(status, message, code = 'request_error') { super(message); this.status = status; this.code = code; } }
export function sendJson(res, status, body) { res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').json(body); }
export function sendError(res, error) { const status = error.status || 500; sendJson(res, status, { error: { code: status === 500 ? 'internal_error' : error.code, message: status === 500 ? 'Internal server error' : error.message } }); }
export function assertMethod(req, method) { if (req.method !== method) throw new HttpError(405, 'Method not allowed', 'method_not_allowed'); }
export function assertSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) throw new HttpError(403, 'Origin required', 'invalid_origin');
  const proto = req.headers['x-forwarded-proto'] || (req.headers.host?.startsWith('localhost') ? 'http' : 'https');
  if (origin !== `${proto}://${req.headers.host}`) throw new HttpError(403, 'Invalid origin', 'invalid_origin');
}
export function query(req) { return req.query || Object.fromEntries(new URL(req.url, 'http://localhost').searchParams); }
