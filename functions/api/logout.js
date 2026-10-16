// POST /api/logout — ferme la session
import { json, sessionCookie } from '../../lib/api.js';
export async function onRequestPost() {
  const res = json({ ok: true });
  res.headers.append('set-cookie', sessionCookie('', 0));
  return res;
}
