// Contrôle d'accès optionnel : si la variable ACCESS_CODE est définie dans Cloudflare,
// toutes les routes /api (sauf /api/health) exigent l'en-tête X-Access-Code.
import { fail } from '../../lib/api.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (url.pathname === '/api/health') return next();
  if (env.ACCESS_CODE) {
    const code = request.headers.get('x-access-code') || '';
    // comparaison à temps constant (évite de deviner le code caractère par caractère)
    const a = new TextEncoder().encode(code), b = new TextEncoder().encode(env.ACCESS_CODE);
    let diff = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] || 0) ^ (b[i] || 0);
    if (diff !== 0) return fail(401, "Code d'accès manquant ou incorrect.");
  }
  // limite la taille des requêtes d'écriture (2 Mo)
  const len = Number(request.headers.get('content-length') || 0);
  if (len > 2_000_000) return fail(413, 'Requête trop volumineuse.');
  try {
    return await next();
  } catch (err) {
    return fail(500, `Erreur serveur : ${err.message || err}`);
  }
}
