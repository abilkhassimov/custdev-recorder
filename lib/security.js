import crypto from 'node:crypto';

const b64 = b => Buffer.from(b).toString('base64url');
const unb64 = s => Buffer.from(s, 'base64url');
const key = secret => {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return crypto.createHash('sha256').update(secret).digest();
};

export function sealSession(data, secret, { now = Date.now() / 1000, ttl = 60 * 60 * 24 * 30 } = {}) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(secret), iv);
  const plaintext = JSON.stringify({ ...data, exp: Math.floor(now + ttl) });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return [b64(iv), b64(ciphertext), b64(cipher.getAuthTag())].join('.');
}

export function openSession(value, secret, { now = Date.now() / 1000 } = {}) {
  try {
    const [iv, ciphertext, tag, extra] = String(value).split('.');
    if (!iv || !ciphertext || !tag || extra) throw new Error();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(secret), unb64(iv));
    decipher.setAuthTag(unb64(tag));
    const payload = JSON.parse(Buffer.concat([decipher.update(unb64(ciphertext)), decipher.final()]).toString());
    if (!payload.exp || now > payload.exp) throw new Error('Session expired');
    const { exp, ...session } = payload;
    return session;
  } catch (error) {
    if (error.message === 'Session expired') throw error;
    throw new Error('Invalid session');
  }
}

export function pkceChallenge(verifier) {
  return b64(crypto.createHash('sha256').update(verifier).digest());
}

export function createOAuthState(secret, { now = Date.now() / 1000, ttl = 300 } = {}) {
  key(secret);
  const state = b64(crypto.randomBytes(24));
  const verifier = b64(crypto.randomBytes(32));
  const body = b64(JSON.stringify({ state, verifier, exp: Math.floor(now + ttl) }));
  const signature = b64(crypto.createHmac('sha256', key(secret)).update(body).digest());
  return { state, verifier, cookie: `${body}.${signature}` };
}

export function verifyOAuthState(cookie, returnedState, secret, { now = Date.now() / 1000 } = {}) {
  try {
    const [body, sig, extra] = String(cookie).split('.');
    if (!body || !sig || extra) throw new Error();
    const expected = crypto.createHmac('sha256', key(secret)).update(body).digest();
    if (!crypto.timingSafeEqual(expected, unb64(sig))) throw new Error();
    const payload = JSON.parse(unb64(body).toString());
    if (!payload.exp || now > payload.exp) throw new Error('OAuth state expired');
    const left = Buffer.from(payload.state); const right = Buffer.from(String(returnedState));
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) throw new Error('OAuth state mismatch');
    return payload;
  } catch (error) {
    if (/OAuth state/.test(error.message)) throw error;
    throw new Error('Invalid OAuth state');
  }
}
