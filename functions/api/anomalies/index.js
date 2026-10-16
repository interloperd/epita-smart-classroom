// GET /api/anomalies — registre des anomalies (filtre facultatif ?status=Ouverte)
import { json, needDb, STATUSES } from '../../../lib/api.js';

export async function onRequestGet({ env, request }) {
  const no = needDb(env); if (no) return no;
  const status = new URL(request.url).searchParams.get('status');
  const where = STATUSES.includes(status) ? 'WHERE n.status = ?' : '';
  const stmt = env.DB.prepare(
    `SELECT n.*, a.room, a.source FROM anomalies n LEFT JOIN audits a ON a.id = n.audit_id ${where}
      ORDER BY CASE n.severity WHEN 'Critique' THEN 0 WHEN 'Majeure' THEN 1 ELSE 2 END, n.created_at DESC LIMIT 300`
  );
  const { results } = await (where ? stmt.bind(status) : stmt).all();
  return json({ ok: true, anomalies: results });
}
