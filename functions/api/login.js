// POST /api/login — vérifie l'identifiant et le mot de passe, ouvre une session (cookie HttpOnly signé)
import { json, fail, credentials, safeEqual, makeSession, sessionCookie } from '../../lib/api.js';

export async function onRequestPost({ request, env }) {
  let body; try { body = await request.json(); } catch { return fail(400, 'Corps JSON invalide.'); }
  const c = credentials(env);
  const ok = safeEqual(body.user || '', c.user) & safeEqual(body.password || '', c.password);
  if (!ok) { await new Promise((r) => setTimeout(r, 600)); return fail(401, 'Identifiant ou mot de passe incorrect.'); } // ralentit la force brute
  const res = json({ ok: true, user: c.user });
  res.headers.append('set-cookie', sessionCookie(await makeSession(env, c.user)));
  return res;
}
