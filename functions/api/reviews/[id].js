// DELETE /api/reviews/:id — modération (session requise, contrôlée par le middleware)
import { json, needDb } from '../../../lib/api.js';
export async function onRequestDelete({ env, params }) {
  const no = needDb(env); if (no) return no;
  await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
