// GET /api/health — état des liaisons Cloudflare (sans donnée sensible)
import { json } from '../../lib/api.js';

export async function onRequestGet({ env }) {
  let tables = false;
  if (env.DB) {
    try { await env.DB.prepare('SELECT 1 FROM audits LIMIT 1').all(); tables = true; } catch { tables = false; }
  }
  return json({ ok: true, d1: !!env.DB, tables, r2: !!env.IMAGES, protected: !!env.ACCESS_CODE });
}
