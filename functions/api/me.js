// GET /api/me — session en cours (pour l'écran de connexion)
import { json, fail, readSession } from '../../lib/api.js';
export async function onRequestGet({ request, env }) {
  const s = await readSession(env, request);
  return s ? json({ ok: true, user: s.u, exp: s.exp }) : fail(401, 'Non connecté.');
}
