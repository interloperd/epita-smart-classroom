/* EPITA Smart Classroom — avis des visiteurs (réels, stockés dans Cloudflare D1, aucun avis inventé).
 * Utilisé sur le site vitrine (liste + formulaire) et sur l'écran de connexion (aperçu).
 */
'use strict';
(() => {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const stars = (n) => '★★★★★'.slice(0, Math.round(n)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(n));
  const fmt = (iso) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  async function fetchReviews() {
    const r = await fetch('/api/reviews', { cache: 'no-store' });
    if (!(r.headers.get('content-type') || '').includes('json')) throw new Error('offline');
    const j = await r.json(); if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  }
  let canModerate = false;
  const card = (rv) => `<article class="rv" data-id="${esc(rv.id)}"><div class="rv-head"><span class="rv-stars" aria-label="${rv.rating} sur 5">${stars(rv.rating)}</span><span class="rv-date">${fmt(rv.created_at)}</span></div>
      <p class="rv-text">« ${esc(rv.comment)} »</p><p class="rv-who"><b>${esc(rv.name)}</b>${rv.role ? ` · ${esc(rv.role)}` : ''}</p>${canModerate ? '<button type="button" class="rv-del">Supprimer (modération)</button>' : ''}</article>`;

  async function render(root) {
    const list = root.querySelector('[data-rv-list]'), sum = root.querySelector('[data-rv-summary]');
    const limit = Number(root.dataset.limit || 30);
    try {
      const j = await fetchReviews();
      sum.innerHTML = j.count ? `<span class="rv-avg">${j.average.toFixed(1)}</span><span class="rv-stars big">${stars(j.average)}</span><span class="rv-count">${j.count} avis publiés par les visiteurs</span>`
        : '<span class="rv-count">Aucun avis pour l\'instant : soyez le premier à donner le vôtre.</span>';
      list.innerHTML = j.reviews.slice(0, limit).map(card).join('');
    } catch (e) {
      sum.innerHTML = `<span class="rv-count">${e.message === 'offline' ? 'Les avis s\'affichent sur le site en ligne.' : `Avis indisponibles (${esc(e.message)}).`}</span>`;
      list.innerHTML = '';
    }
  }

  function bindForm(root) {
    const f = root.querySelector('form[data-rv-form]'); if (!f) return;
    let rating = 0;
    const starBtns = f.querySelectorAll('[data-star]');
    const paint = (n) => starBtns.forEach((b) => b.classList.toggle('on', Number(b.dataset.star) <= n));
    starBtns.forEach((b) => {
      b.addEventListener('click', () => { rating = Number(b.dataset.star); paint(rating); });
      b.addEventListener('mouseenter', () => paint(Number(b.dataset.star)));
      b.addEventListener('mouseleave', () => paint(rating));
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = f.querySelector('[data-rv-msg]'), btn = f.querySelector('button[type=submit]');
      if (!rating) { msg.textContent = 'Choisissez une note de 1 à 5 étoiles.'; return; }
      btn.disabled = true; msg.textContent = 'Envoi…';
      try {
        const body = { name: f.name.value, role: f.role.value, comment: f.comment.value, rating, website: f.website.value };
        const r = await fetch('/api/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const isJson = (r.headers.get('content-type') || '').includes('json');
        const j = isJson ? await r.json() : {};
        if (!isJson) throw new Error('Le dépôt d\'avis fonctionne sur le site en ligne.');
        if (!r.ok) throw new Error(j.error || 'Envoi impossible.');
        f.reset(); rating = 0; paint(0); msg.textContent = '✓ Merci ! Votre avis est publié.';
        render(root);
      } catch (err) { msg.textContent = err.message; } finally { btn.disabled = false; }
    });
  }

  async function moderation() {
    try { const r = await fetch('/api/me', { credentials: 'same-origin' }); canModerate = r.ok && (r.headers.get('content-type') || '').includes('json'); } catch { canModerate = false; }
  }
  document.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('rv-del')) return;
    const art = e.target.closest('[data-id]'); if (!art || !confirm('Supprimer cet avis ?')) return;
    const r = await fetch(`/api/reviews/${encodeURIComponent(art.dataset.id)}`, { method: 'DELETE', credentials: 'same-origin' });
    if (r.ok) document.querySelectorAll('[data-reviews]').forEach(render); else alert('Suppression impossible (connexion requise).');
  });
  const start = async () => { await moderation(); document.querySelectorAll('[data-reviews]').forEach((root) => { render(root); bindForm(root); }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
