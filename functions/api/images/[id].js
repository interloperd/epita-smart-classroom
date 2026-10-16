// GET /api/images/:id — renvoie l'image d'un audit (R2 ou D1)
import { fail, needDb } from '../../../lib/api.js';

export async function onRequestGet({ env, params }) {
  const no = needDb(env); if (no) return no;
  const row = await env.DB.prepare('SELECT image_key FROM audits WHERE id = ?').bind(params.id).first();
  if (!row || !row.image_key) return fail(404, 'Aucune image pour cet audit.');
  const headers = { 'cache-control': 'private, max-age=300' };
  if (row.image_key.startsWith('r2:')) {
    if (!env.IMAGES) return fail(503, 'Stockage R2 non lié.');
    const obj = await env.IMAGES.get(row.image_key.slice(3));
    if (!obj) return fail(404, 'Image introuvable.');
    return new Response(obj.body, { headers: { ...headers, 'content-type': obj.httpMetadata?.contentType || 'image/jpeg' } });
  }
  const img = await env.DB.prepare('SELECT mime, data FROM images WHERE audit_id = ?').bind(params.id).first();
  if (!img) return fail(404, 'Image introuvable.');
  const bin = atob(img.data); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, { headers: { ...headers, 'content-type': img.mime } });
}
