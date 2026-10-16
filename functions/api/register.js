// POST /api/register — création de compte (stocké dans D1, mot de passe haché), connexion automatique
import { json, fail, uid, needDb, hashPassword, makeSession, sessionCookie, credentials } from '../../lib/api.js';

export async function onRequestPost({ request, env }) {
  const no = needDb(env); if (no) return no;
  let body; try { body = await request.json(); } catch { return fail(400, 'Corps JSON invalide.'); }
  const user = String(body.user || '').trim().toLowerCase(), password = String(body.password || '');
  if (!/^[a-z0-9._-]{3,30}$/.test(user)) return fail(400, 'Identifiant : 3 à 30 caractères (lettres, chiffres, point, tiret, souligné).');
  if (password.length < 8 || password.length > 128) return fail(400, 'Mot de passe : 8 caractères minimum.');
  if (user === credentials(env).user) return fail(409, 'Cet identifiant est réservé.');
  try {
    const exists = await env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(user).first();
    if (exists) return fail(409, 'Cet identifiant est déjà pris.');
    const { salt, hash } = await hashPassword(password);
    await env.DB.prepare('INSERT INTO users (id, username, salt, hash, created_at) VALUES (?,?,?,?,?)').bind(uid(), user, salt, hash, new Date().toISOString()).run();
  } catch (e) {
    if (/no such table/i.test(e.message)) return fail(503, 'Table « users » absente : exécutez schema.sql dans la console D1.');
    throw e;
  }
  const res = json({ ok: true, user }, 201);
  res.headers.append('set-cookie', sessionCookie(await makeSession(env, user)));
  return res;
}
