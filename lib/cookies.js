export function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('='); return [decodeURIComponent(v.slice(0, i)), decodeURIComponent(v.slice(i + 1))];
  }));
}
export function serializeCookie(name, value, options = {}) {
  const out = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
  if (options.maxAge != null) out.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.path) out.push(`Path=${options.path}`);
  if (options.httpOnly) out.push('HttpOnly');
  if (options.secure) out.push('Secure');
  if (options.sameSite) out.push(`SameSite=${options.sameSite}`);
  return out.join('; ');
}
export const cookieOptions = (production = process.env.NODE_ENV === 'production') => ({ httpOnly: true, sameSite: 'Lax', secure: production, path: '/' });
