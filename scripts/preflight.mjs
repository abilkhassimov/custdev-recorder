#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

export const REQUIRED_ENV = ['SESSION_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GEMINI_API_KEY', 'GOOGLE_PICKER_API_KEY', 'GOOGLE_CLOUD_PROJECT_NUMBER'];

export function validateEnvironment(env, { production = env.NODE_ENV === 'production' } = {}) {
  const errors = [];
  for (const name of REQUIRED_ENV) if (!env[name]?.trim()) errors.push(`${name}: missing required variable`);
  if (env.SESSION_SECRET && env.SESSION_SECRET.length < 32) errors.push('SESSION_SECRET: must be at least 32 characters');
  if (env.GOOGLE_CLIENT_ID && !/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(env.GOOGLE_CLIENT_ID)) errors.push('GOOGLE_CLIENT_ID: invalid web client ID format');
  if (env.GOOGLE_CLIENT_SECRET && !/^GOCSPX-[A-Za-z0-9_-]+$/.test(env.GOOGLE_CLIENT_SECRET)) errors.push('GOOGLE_CLIENT_SECRET: invalid client secret format');
  if (env.GOOGLE_CLOUD_PROJECT_NUMBER && !/^\d+$/.test(env.GOOGLE_CLOUD_PROJECT_NUMBER)) errors.push('GOOGLE_CLOUD_PROJECT_NUMBER: must contain digits only');
  for (const name of ['GEMINI_API_KEY', 'GOOGLE_PICKER_API_KEY']) if (env[name] && !/^AIza[A-Za-z0-9_-]{20,}$/.test(env[name])) errors.push(`${name}: invalid API key format`);
  if (env.GEMINI_API_KEY && env.GEMINI_API_KEY === env.GOOGLE_PICKER_API_KEY) errors.push('GEMINI_API_KEY and GOOGLE_PICKER_API_KEY must be different keys');
  if (env.SESSION_SECRET && [env.GOOGLE_CLIENT_SECRET, env.GEMINI_API_KEY, env.GOOGLE_PICKER_API_KEY].includes(env.SESSION_SECRET)) errors.push('SESSION_SECRET must be different from provider credentials');
  if (env.GOOGLE_REDIRECT_URI) {
    try {
      const uri = new URL(env.GOOGLE_REDIRECT_URI);
      if (uri.pathname !== '/api/auth/callback' || uri.search || uri.hash) errors.push('GOOGLE_REDIRECT_URI: path must be exactly /api/auth/callback with no query or fragment');
      if (production && uri.protocol !== 'https:') errors.push('GOOGLE_REDIRECT_URI: production callback must use HTTPS');
      if (!production && uri.protocol !== 'https:' && !(uri.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(uri.hostname))) errors.push('GOOGLE_REDIRECT_URI: HTTP is allowed only for local development');
    } catch { errors.push('GOOGLE_REDIRECT_URI: must be a valid absolute URL'); }
  }
  return errors;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = validateEnvironment(process.env);
  if (errors.length) { console.error(`Preflight failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):\n- ${errors.join('\n- ')}`); process.exitCode = 1; }
  else console.log('Preflight passed: all required variable names, formats, separation, and callback rules are valid.');
}