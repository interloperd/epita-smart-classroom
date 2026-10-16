// GET  /api/audits  — liste des audits archivés (sans les images)
// POST /api/audits  — enregistre un audit, ses anomalies et, si fourni, l'image (R2, sinon D1)
import { json, fail, uid, clip, num, needDb, decodeDataUrl, SEVERITIES } from '../../../lib/api.js';

const MAX_IMAGE_BYTES = 1_500_000;

export async function onRequestGet({ env }) {
  const no = needDb(env); if (no) return no;
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.created_at, a.room, a.source, a.model, a.threshold, a.total, a.gaps, a.verifiable,
            a.global_status, a.quality, a.duration_s, a.detection_rate, a.counts_json, a.image_key,
            (SELECT COUNT(*) FROM anomalies n WHERE n.audit_id = a.id AND n.status IN ('Ouverte','En cours')) AS open_anomalies
       FROM audits a ORDER BY a.created_at DESC LIMIT 100`
  ).all();
  return json({ ok: true, audits: results.map((r) => ({ ...r, has_image: !!r.image_key, image_key: undefined })) });
}

export async function onRequestPost({ request, env }) {
  const no = needDb(env); if (no) return no;
  let body;
  try { body = await request.json(); } catch { return fail(400, 'Corps JSON invalide.'); }
  const a = body.audit || {};
  const id = uid();
  const now = new Date().toISOString();

  // Image facultative : uniquement si l'utilisateur l'a explicitement incluse
  let imageKey = null;
  if (body.image) {
    const img = decodeDataUrl(body.image);
    if (!img) return fail(400, 'Image invalide (JPEG, PNG ou WebP attendu).');
    if (img.bytes.length > MAX_IMAGE_BYTES) return fail(413, 'Image trop lourde (1,5 Mo maximum).');
    if (env.IMAGES) {
      const key = `audits/${id}.jpg`;
      await env.IMAGES.put(key, img.bytes, { httpMetadata: { contentType: img.mime } });
      imageKey = `r2:${key}`;
    } else {
      await env.DB.prepare('INSERT INTO images (audit_id, mime, data) VALUES (?, ?, ?)').bind(id, img.mime, img.b64).run();
      imageKey = `d1:${id}`;
    }
  }

  const stmts = [env.DB.prepare(
    `INSERT INTO audits (id, created_at, room, source, model, threshold, total, gaps, verifiable, global_status,
                         quality, duration_s, inference_ms, detection_rate, counts_json, rows_json, image_key)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, now, clip(a.room, 80), clip(a.source, 40), clip(a.model, 40), num(a.threshold), num(a.total), num(a.gaps),
    num(a.verifiable), clip(a.global_status, 80), clip(a.quality, 30), num(a.duration_s), num(a.inference_ms),
    num(a.detection_rate), clip(JSON.stringify(a.counts || {}), 4000), clip(JSON.stringify(a.rows || []), 8000), imageKey)];

  (Array.isArray(body.anomalies) ? body.anomalies.slice(0, 50) : []).forEach((n) => {
    stmts.push(env.DB.prepare(
      `INSERT INTO anomalies (id, audit_id, created_at, updated_at, type, category, severity, title, action, status, comment)
       VALUES (?,?,?,?,?,?,?,?,?, 'Ouverte', '')`
    ).bind(uid(), id, now, now, clip(n.type, 30), clip(n.category, 60), SEVERITIES.includes(n.severity) ? n.severity : 'Mineure',
      clip(n.title, 200), clip(n.action, 400)));
  });
  await env.DB.batch(stmts);
  return json({ ok: true, id, image: imageKey ? imageKey.split(':')[0] : null }, 201);
}
