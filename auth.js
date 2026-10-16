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
  let signup = false;   // formulaire en mode « Créer un compte »
  const localUsers = { get() { try { return JSON.parse(localStorage.getItem('esc.localUsers') || '{}'); } catch { return {}; } }, set(v) { try { localStorage.setItem('esc.localUsers', JSON.stringify(v)); } catch { /* */ } } };
  function setSignup(on) {
    signup = on;
    $('#authTitle').textContent = on ? 'Créer un compte' : 'Connexion';
    $('#authSub').textContent = on ? 'Créez votre accès en quelques secondes.' : 'Espace réservé aux responsables des salles.';
    $('#confirmWrap').hidden = !on; $('#pwRules').hidden = !on;
    $('#loginPass2').required = on;
    $('#loginPass').autocomplete = on ? 'new-password' : 'current-password';
    $('#loginBtn').textContent = on ? 'Créer mon compte' : 'Se connecter';
    $('#switchText').textContent = on ? 'Déjà un compte ?' : 'Pas encore de compte ?';
    $('#switchMode').textContent = on ? 'Se connecter' : 'Créer un compte';
    $('#authMsg').textContent = '';
  }

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
      const tok = ss.get('esc.auth'), who = ss.get('esc.authUser') || 'admin';
      if (tok && (tok === LOCAL_HASH || localUsers.get()[who] === tok)) return unlock(who);
      return lock();
    }
  }

  async function submit(e) {
    e.preventDefault();
    const user = $('#loginUser').value.trim(), password = $('#loginPass').value;
    const btn = $('#loginBtn'); btn.disabled = true; $('#authMsg').textContent = 'Vérification…';
    try {
      if (signup) {
        if (!/^[a-zA-Z0-9._-]{3,30}$/.test(user)) throw new Error('Identifiant : 3 à 30 caractères (lettres, chiffres, point, tiret, souligné).');
        if (password.length < 8) throw new Error('Mot de passe : 8 caractères minimum.');
        if (password !== $('#loginPass2').value) throw new Error('Les deux mots de passe ne correspondent pas.');
        if (mode === 'server') {
          const r = await fetch('/api/register', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user, password }) });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || 'Création impossible.');
          $('#loginPass').value = ''; $('#loginPass2').value = ''; setSignup(false); return unlock(j.user);
        }
        const u = localUsers.get(), key = user.toLowerCase();
        if (key === 'admin' || u[key]) throw new Error('Cet identifiant est déjà pris.');
        u[key] = await sha256(`${key}:${password}`); localUsers.set(u);
        ss.set('esc.auth', u[key]); ss.set('esc.authUser', key); $('#loginPass').value = ''; $('#loginPass2').value = ''; setSignup(false); return unlock(key);
      }
      if (mode === 'server') {
        const r = await fetch('/api/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user, password }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'Connexion refusée.');
        $('#loginPass').value = ''; unlock(j.user);
      } else {
        const key = user.toLowerCase(), h = await sha256(`${key}:${password}`), u = localUsers.get();
        if (h !== LOCAL_HASH && u[key] !== h) { await new Promise((r) => setTimeout(r, 600)); throw new Error('Identifiant ou mot de passe incorrect.'); }
        ss.set('esc.auth', h); ss.set('esc.authUser', key); $('#loginPass').value = ''; unlock(key);
      }
    } catch (err) {
      $('#authMsg').textContent = err.message || 'Connexion impossible.';
      $('#loginPass').select();
    } finally { btn.disabled = false; }
  }

  async function logout() {
    if (mode === 'server') { try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch { /* */ } }
    ss.set('esc.auth', null); ss.set('esc.authUser', null);
    if (window.__ESC__ && window.__ESC__.stopCamera) window.__ESC__.stopCamera();
    lock('Vous êtes déconnecté·e.');
  }

  const start = () => {
    $('#loginForm').addEventListener('submit', submit);
    $('#logoutBtn').addEventListener('click', logout);
    $('#switchMode').addEventListener('click', () => setSignup(!signup));
    $('#togglePass').addEventListener('click', () => { const p = $('#loginPass'); p.type = p.type === 'password' ? 'text' : 'password'; $('#togglePass').textContent = p.type === 'password' ? 'Afficher' : 'Masquer'; });
    check();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
