export function getEnv(source = process.env) {
  const names = ['SESSION_SECRET','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_REDIRECT_URI'];
  const env = Object.fromEntries(names.map(n => [n, source[n]]));
  env.GOOGLE_API_KEY = source.GOOGLE_API_KEY;
  for (const name of names) if (!env[name]) throw new Error(`Missing required environment variable: ${name}`);
  if (env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  try { const u = new URL(env.GOOGLE_REDIRECT_URI); if (!/^https?:$/.test(u.protocol)) throw new Error(); } catch { throw new Error('GOOGLE_REDIRECT_URI must be a valid URL'); }
  return env;
}
