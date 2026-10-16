/* EPITA Smart Classroom — écran de connexion.
 * En ligne : vérification côté serveur (/api/login, session HttpOnly signée de 8 h).
 * Sans API (ouverture en local avec un simple serveur statique) : repli de démonstration côté navigateur.
 * Identifiants de démonstration : admin / admin (à changer via les variables ADMIN_USER / ADMIN_PASSWORD de Cloudflare).
 */
'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  // SHA-256("admin:admin") — utilisé uniquement en repli local, jamais le mot de passe en clair
  const LOCAL_HASH = '8da193366e1554c08b2870c50f737b9587c3372b656151c4a96028af26f51334';
  const sha256 = async (txt) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* */ } } };

  let mode = 'server'; // 'server' si l'API répond, sinon 'local'

  function unlock(user) {
    document.body.classList.remove('locked');
    $('#authGate').hidden = true;
    const u = $('#authUser'); u.hidden = false; u.querySelector('b').textContent = user;
    document.dispatchEvent(new CustomEvent('esc:auth', { detail: { user, mode } }));
  }
  function lock(msg = '') {
    document.body.classList.add('locked');
    $('#authGate').hidden = false; $('#authUser').hidden = true;
    $('#authMsg').textContent = msg;
    setTimeout(() => { const f = $('#loginUser'); if (f) f.focus(); }, 50);
  }

  async function check() {
    try {
      const r = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' });
      const isJson = (r.headers.get('content-type') || '').includes('json');
      if (!isJson) throw new Error('no-api');
      mode = 'server';
      if (r.ok) { const j = await r.json(); return unlock(j.user); }
      return lock();
    } catch {
      mode = 'local';
      if (ss.get('esc.auth') === LOCAL_HASH) return unlock('admin');
      return lock();
    }
  }

  async function submit(e) {
    e.preventDefault();
    const user = $('#loginUser').value.trim(), password = $('#loginPass').value;
    const btn = $('#loginBtn'); btn.disabled = true; $('#authMsg').textContent = 'Vérification…';
    try {
      if (mode === 'server') {
        const r = await fetch('/api/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user, password }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Connexion refusée.');
        $('#loginPass').value = ''; unlock(j.user);
      } else {
        if ((await sha256(`${user}:${password}`)) !== LOCAL_HASH) { await new Promise((r) => setTimeout(r, 600)); throw new Error('Identifiant ou mot de passe incorrect.'); }
        ss.set('esc.auth', LOCAL_HASH); $('#loginPass').value = ''; unlock(user);
      }
    } catch (err) {
      $('#authMsg').textContent = err.message || 'Connexion impossible.';
      $('#loginPass').select();
    } finally { btn.disabled = false; }
  }

  async function logout() {
    if (mode === 'server') { try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch { /* */ } }
    ss.set('esc.auth', null);
    if (window.__ESC__ && window.__ESC__.stopCamera) window.__ESC__.stopCamera();
    lock('Vous êtes déconnecté·e.');
  }

  const start = () => {
    $('#loginForm').addEventListener('submit', submit);
    $('#logoutBtn').addEventListener('click', logout);
    $('#togglePass').addEventListener('click', () => { const p = $('#loginPass'); p.type = p.type === 'password' ? 'text' : 'password'; $('#togglePass').textContent = p.type === 'password' ? 'Afficher' : 'Masquer'; });
    check();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
