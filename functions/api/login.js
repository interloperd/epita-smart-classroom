// POST /api/login — compte administrateur (variables Cloudflare) ou compte créé (table users, PBKDF2)
import { json, fail, credentials, safeEqual, makeSession, sessionCookie, hashPassword } from '../../lib/api.js';

export async function onRequestPost({ request, env }) {
  let body; try { body = await request.json(); } catch { return fail(400, 'Corps JSON invalide.'); }
  const user = String(body.user || '').trim(), password = String(body.password || '');
  const c = credentials(env);
  let ok = safeEqual(user, c.user) & safeEqual(password, c.password), who = c.user;
  if (!ok && env.DB) {
    try {
      const row = await env.DB.prepare('SELECT username, salt, hash FROM users WHERE username = ?').bind(user.toLowerCase()).first();
      if (row) { const h = await hashPassword(password, row.salt); if (safeEqual(h.hash, row.hash)) { ok = true; who = row.username; } }
    } catch { /* table absente : seul le compte admin est disponible */ }
  }
  if (!ok) { await new Promise((r) => setTimeout(r, 600)); return fail(401, 'Identifiant ou mot de passe incorrect.'); } // ralentit la force brute
  const res = json({ ok: true, user: who });
  res.headers.append('set-cookie', sessionCookie(await makeSession(env, who)));
  return res;
}
