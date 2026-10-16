// Utilitaires partagés par les Pages Functions (API /api/*)
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export const fail = (status, message) => json({ ok: false, error: message }, status);

export const uid = () => crypto.randomUUID();

export const clip = (v, n = 500) => (v === null || v === undefined ? null : String(v).slice(0, n));

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

export const STATUSES = ['Ouverte', 'En cours', 'Résolue', 'Faux positif'];
export const SEVERITIES = ['Critique', 'Majeure', 'Mineure'];

/** Vérifie que la base D1 est liée au projet. */
export function needDb(env) {
  if (!env.DB) return fail(503, "Base D1 non liée : ajoutez la liaison « DB » dans Settings → Bindings du projet Pages.");
  return null;
}

/** Décode une data URL JPEG/PNG en octets. */
export function decodeDataUrl(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime: m[1], bytes, b64: m[2] };
}

// ---------------------------------------------------------------- Authentification (session signée HMAC-SHA256)
const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));
export const credentials = (env) => ({ user: env.ADMIN_USER || 'admin', password: env.ADMIN_PASSWORD || 'admin' });
const secretOf = (env) => env.SESSION_SECRET || `esc-${credentials(env).password}-session`;
async function hmac(env, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secretOf(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
/** Comparaison à temps constant de deux chaînes. */
export function safeEqual(x, y) {
  const a = enc.encode(String(x)), b = enc.encode(String(y)); let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a[i] || 0) ^ (b[i] || 0);
  return d === 0;
}
export const SESSION_TTL = 8 * 3600; // 8 heures
export async function makeSession(env, user) {
  const payload = b64url(enc.encode(JSON.stringify({ u: user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL })));
  return `${payload}.${await hmac(env, payload)}`;
}
export async function readSession(env, request) {
  const m = /(?:^|;\s*)esc_session=([^;]+)/.exec(request.headers.get('cookie') || '');
  if (!m) return null;
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig || !safeEqual(sig, await hmac(env, payload))) return null;
  try { const p = JSON.parse(fromB64url(payload)); return p.exp > Date.now() / 1000 ? p : null; } catch { return null; }
}
export const sessionCookie = (token, maxAge = SESSION_TTL) => `esc_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

// ---------------------------------------------------------------- Mots de passe (PBKDF2-SHA256, 100 000 itérations, sel 16 octets)
export async function hashPassword(password, saltB64) {
  const salt = saltB64 ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0)) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return { salt: btoa(String.fromCharCode(...salt)), hash: btoa(String.fromCharCode(...new Uint8Array(bits))) };
}
