// GET    /api/audits/:id — détail d'un audit et de ses anomalies
// DELETE /api/audits/:id — droit à l'effacement : supprime l'audit, ses anomalies et son image
import { json, fail, needDb } from '../../../lib/api.js';

export async function onRequestGet({ env, params }) {
  const no = needDb(env); if (no) return no;
  const audit = await env.DB.prepare('SELECT * FROM audits WHERE id = ?').bind(params.id).first();
  if (!audit) return fail(404, 'Audit introuvable.');
  const { results } = await env.DB.prepare('SELECT * FROM anomalies WHERE audit_id = ? ORDER BY created_at').bind(params.id).all();
  audit.has_image = !!audit.image_key; delete audit.image_key;
  return json({ ok: true, audit, anomalies: results });
}

export async function onRequestDelete({ env, params }) {
  const no = needDb(env); if (no) return no;
  const audit = await env.DB.prepare('SELECT image_key FROM audits WHERE id = ?').bind(params.id).first();
  if (!audit) return fail(404, 'Audit introuvable.');
  if (audit.image_key && audit.image_key.startsWith('r2:') && env.IMAGES) await env.IMAGES.delete(audit.image_key.slice(3));
  await env.DB.batch([
    env.DB.prepare('DELETE FROM images WHERE audit_id = ?').bind(params.id),
    env.DB.prepare('DELETE FROM anomalies WHERE audit_id = ?').bind(params.id),
    env.DB.prepare('DELETE FROM audits WHERE id = ?').bind(params.id),
  ]);
  return json({ ok: true });
}
