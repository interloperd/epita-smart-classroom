// Contrôle d'accès de l'API : session valide (connexion admin) OU code d'accès ACCESS_CODE (si défini).
// Routes publiques : health, login, logout, me, register, reviews (lecture et dépôt d'avis). La suppression d'un avis exige une session.
import { fail, readSession, safeEqual } from '../../lib/api.js';

const PUBLIC = new Set(['/api/health', '/api/login', '/api/logout', '/api/me', '/api/register', '/api/reviews']);

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 2_000_000) return fail(413, 'Requête trop volumineuse.'); // limite la taille des requêtes (2 Mo)
  if (!PUBLIC.has(url.pathname)) {
    const session = await readSession(env, request);
    const code = request.headers.get('x-access-code') || '';
    const byCode = env.ACCESS_CODE && safeEqual(code, env.ACCESS_CODE);
    if (!session && !byCode) return fail(401, 'Authentification requise : connectez-vous.');
  }
  try {
    return await next();
  } catch (err) {
    return fail(500, `Erreur serveur : ${err.message || err}`);
  }
}
