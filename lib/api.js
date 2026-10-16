// Utilitaires partagés par les Pages Functions (API /api/*)
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

export const fail = (status, message) => json({ ok: false, error: message }, status);

export const uid = () => crypto.randomUUID();

export const clip = (v, n = 500) => (v === null || v === undefined ? null : String(v).slice(0, n));

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

export const STATUSES = ['Ouverte', 'En cours', 'Résolue', 'Faux positif'];
export const SEVERITIES = ['Critique', 'Majeure', 'Mineure'];

/** Vérifie que la base D1 est liée au projet. */
export function needDb(env) {
  if (!env.DB) return fail(503, "Base D1 non liée : ajoutez la liaison « DB » dans Settings → Bindings du projet Pages.");
  return null;
}

/** Décode une data URL JPEG/PNG en octets. */
export function decodeDataUrl(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { mime: m[1], bytes, b64: m[2] };
}
