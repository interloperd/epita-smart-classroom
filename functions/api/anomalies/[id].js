// PATCH /api/anomalies/:id — met à jour le statut et/ou le commentaire d'une anomalie
import { json, fail, clip, needDb, STATUSES } from '../../../lib/api.js';

export async function onRequestPatch({ env, params, request }) {
  const no = needDb(env); if (no) return no;
  let body;
  try { body = await request.json(); } catch { return fail(400, 'Corps JSON invalide.'); }
  if (body.status !== undefined && !STATUSES.includes(body.status)) return fail(400, 'Statut inconnu.');
  const cur = await env.DB.prepare('SELECT status, comment FROM anomalies WHERE id = ?').bind(params.id).first();
  if (!cur) return fail(404, 'Anomalie introuvable.');
  await env.DB.prepare('UPDATE anomalies SET status = ?, comment = ?, updated_at = ? WHERE id = ?')
    .bind(body.status ?? cur.status, body.comment !== undefined ? clip(body.comment, 500) : cur.comment, new Date().toISOString(), params.id).run();
  return json({ ok: true });
}
