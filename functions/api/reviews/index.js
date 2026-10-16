// GET /api/reviews — avis publics (30 derniers + moyenne) · POST /api/reviews — dépôt d'un avis (public, validé)
import { json, fail, uid, clip, needDb } from '../../../lib/api.js';

export async function onRequestGet({ env }) {
  const no = needDb(env); if (no) return no;
  try {
    const { results } = await env.DB.prepare('SELECT id, created_at, name, role, rating, comment FROM reviews ORDER BY created_at DESC LIMIT 30').all();
    const agg = await env.DB.prepare('SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews').first();
    return json({ ok: true, reviews: results, count: agg.n, average: agg.avg ? Math.round(agg.avg * 10) / 10 : null });
  } catch (e) { if (/no such table/i.test(e.message)) return json({ ok: true, reviews: [], count: 0, average: null, setup: 'schema' }); throw e; }
}

export async function onRequestPost({ request, env }) {
  const no = needDb(env); if (no) return no;
  let b; try { b = await request.json(); } catch { return fail(400, 'Corps JSON invalide.'); }
  if (b.website) return json({ ok: true }); // piège à robots (champ caché)
  const name = String(b.name || '').trim(), comment = String(b.comment || '').trim(), rating = Number(b.rating);
  if (name.length < 2 || name.length > 40) return fail(400, 'Nom : 2 à 40 caractères.');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail(400, 'Note entre 1 et 5.');
  if (comment.length < 10 || comment.length > 500) return fail(400, 'Avis : 10 à 500 caractères.');
  await env.DB.prepare('INSERT INTO reviews (id, created_at, name, role, rating, comment) VALUES (?,?,?,?,?,?)')
    .bind(uid(), new Date().toISOString(), clip(name, 40), clip(String(b.role || '').trim(), 60), rating, clip(comment, 500)).run();
  return json({ ok: true }, 201);
}
