// Contrôle d'accès optionnel : si la variable ACCESS_CODE est définie dans Cloudflare,
// toutes les routes /api (sauf /api/health) exigent l'en-tête X-Access-Code.
import { fail } from '../../lib/api.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (url.pathname === '/api/health') return next();
  if (env.ACCESS_CODE) {
    const code = request.headers.get('x-access-code') || '';
    if (code !== env.ACCESS_CODE) return fail(401, "Code d'accès manquant ou incorrect.");
  }
  try {
    return await next();
  } catch (err) {
    return fail(500, `Erreur serveur : ${err.message || err}`);
  }
}
