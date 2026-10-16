/* EPITA Smart Classroom — base de données (Cloudflare D1 + R2) et registre des anomalies.
 * Mode « cloud » si l'API /api est liée à D1 ; sinon repli automatique en mode local (navigateur, sans image).
 */
'use strict';
(() => {
  const start = () => {
    const E = window.__ESC__;
    if (!E) return;
    const $ = (s) => document.querySelector(s);
    const { esc } = E;
    const STATUSES = ['Ouverte', 'En cours', 'Résolue', 'Faux positif'];
    const db = { mode: 'pending', info: null, lastSavedAt: null };

    const ss = { get: (k) => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* */ } } };
    const ls = {
      get() { try { return JSON.parse(localStorage.getItem('esc.db')) || { audits: [], anomalies: [] }; } catch { return { audits: [], anomalies: [] }; } },
      set(v) { try { localStorage.setItem('esc.db', JSON.stringify(v)); return true; } catch { return false; } },
    };
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    const fmt = (iso) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    async function api(path, opts = {}) {
      const headers = { 'content-type': 'application/json', ...(opts.headers || {}) };
      const code = ss.get('esc.code'); if (code) headers['x-access-code'] = code;
      const res = await fetch(`/api${path}`, { ...opts, headers });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) { if (opts.raw && res.ok) return res; throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }); }
      const data = await res.json();
      if (!res.ok || data.ok === false) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
      return data;
    }

    // ------------------------------------------------------------ Connexion
    async function connect() {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
        const r = await fetch('/api/health', { signal: ctl.signal }); clearTimeout(t);
        const info = (r.headers.get('content-type') || '').includes('json') ? await r.json() : null;
        db.info = info;
        db.mode = info && info.d1 && info.tables ? 'cloud' : 'local';
      } catch { db.mode = 'local'; db.info = null; }
      renderMode();
      refreshCount();
    }
    function modeText() {
      if (db.mode === 'cloud') return `Base Cloudflare connectée · D1 ✓ · images : ${db.info.r2 ? 'R2 ✓' : 'stockées dans D1 (R2 non lié)'}${db.info.protected ? ' · accès protégé par code' : ''}`;
      if (db.info && db.info.d1 && !db.info.tables) return 'Base D1 liée mais tables absentes : exécutez schema.sql dans la console D1. Mode local en attendant.';
      if (db.info && !db.info.d1) return 'API en ligne mais base D1 non liée (Settings → Bindings → DB). Mode local : audits gardés dans ce navigateur, sans image.';
      return 'Mode local : audits gardés dans ce navigateur, sans image (base Cloudflare non disponible ici).';
    }
    function renderMode() {
      const t = modeText();
      ['#dbMode', '#anoMode', '#archMode'].forEach((s) => { const el = $(s); if (el) el.textContent = t; });
      const img = $('#saveImage');
      if (img) { img.disabled = db.mode !== 'cloud'; if (db.mode !== 'cloud') img.checked = false; }
    }

    // ------------------------------------------------------------ Anomalies générées par un audit
    function severityFor(r) {
      if (r.status.code === 'under') {
        const ratio = r.expected ? r.detected / r.expected : 1;
        return ratio < 0.5 ? 'Critique' : Math.abs(r.gap) >= 2 ? 'Majeure' : 'Mineure';
      }
      return 'Mineure';
    }
    function buildAnomalies(a) {
      const out = [];
      a.rows.forEach((r) => {
        if (r.status.code === 'under') out.push({ type: 'Écart', category: r.label, severity: severityFor(r), title: `${r.label} : ${r.detected} détecté(s) pour ${r.expected} attendu(s) (${r.gap})`, action: 'Contrôle visuel sur place, puis nouvelle prise de vue sous un autre angle. Ne pas conclure à une absence.' });
        if (r.status.code === 'over') out.push({ type: 'Écart', category: r.label, severity: 'Mineure', title: `${r.label} : ${r.detected} détecté(s) pour ${r.expected} attendu(s) (+${r.gap})`, action: 'Vérifier les doublons de détection ou mettre à jour la configuration théorique.' });
        if (r.status.code === 'unsupported') out.push({ type: 'Hors modèle', category: r.label, severity: 'Mineure', title: `${r.label} : non vérifiable automatiquement (attendu : ${r.expected})`, action: 'Comptage manuel.' });
      });
      // anomalies audio (mode Scan avec micro) : bruits perturbants et niveau sonore
      const amb = E.state.ambient;
      if (amb) {
        (amb.events || []).forEach((ev) => out.push({ type: 'Audio', category: ev.cat, severity: ev.sev, title: `Bruit perturbant : ${ev.cat} (${ev.count} détection(s), confiance max ${Math.round(ev.max * 100)} %)`, action: ev.action }));
        const peak = amb.peak ?? amb.level;
        if (peak >= 65) out.push({ type: 'Audio', category: 'Niveau sonore', severity: peak >= 80 ? 'Majeure' : 'Mineure', title: `Ambiance bruyante : pic ${peak}/100 (niveau relatif)`, action: 'Identifier la source (couloir, rue, ventilation) ; fermer portes et fenêtres ; mesurer avec un sonomètre si le problème persiste.' });
      }
      ((E.state.quality && E.state.quality.list) || []).filter((q) => q.level !== 'info').forEach((q) => {
        out.push({ type: 'Prise de vue', category: 'Qualité', severity: q.level === 'high' ? 'Majeure' : 'Mineure', title: q.title, action: q.advice });
      });
      return out;
    }

    function imageDataUrl() {
      const bmp = E.getFrameBitmap(); if (!bmp) return null;
      const s = Math.min(1, 1024 / bmp.width);
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.75);
    }

    // ------------------------------------------------------------ Enregistrement
    async function save() {
      const st = E.state; if (!st.analyzed) return;
      const a = E.computeAudit();
      const msg = $('#saveMsg'); const btn = $('#btnSave');
      const counts = Object.fromEntries([...a.counts.entries()].map(([k, v]) => [k, v.n]));
      if (st.weather) counts.__meteo = { lieu: st.weather.place, temp: st.weather.temp, ressenti: st.weather.feels, humidite: st.weather.rh, conditions: st.weather.label };
      if (st.ambient) counts.__ambiance = { niveau: st.ambient.level, label: st.ambient.label, sons: st.ambient.top.map((s) => s.name) };
      const audit = {
        room: st.roomName, source: st.source, model: st.modelBase, threshold: st.threshold, total: a.preds.length,
        gaps: a.gaps.length, verifiable: a.verifiable.length, global_status: a.global.label, quality: st.quality ? st.quality.grade : null,
        duration_s: st.lastDurationS, inference_ms: st.inferenceMs, detection_rate: a.detRate, counts,
        rows: a.rows.map((r) => ({ label: r.label, expected: r.expected, detected: r.detected, gap: r.gap, status: r.status.label })),
      };
      const anomalies = buildAnomalies(a);
      btn.disabled = true; msg.textContent = 'Enregistrement…';
      try {
        if (db.mode === 'cloud') {
          const image = $('#saveImage').checked ? imageDataUrl() : null;
          const r = await api('/audits', { method: 'POST', body: JSON.stringify({ audit, anomalies, image }) });
          msg.textContent = `✓ Audit enregistré dans Cloudflare D1 (${anomalies.length} anomalie(s)${r.image ? `, image ${r.image.toUpperCase()}` : ''}).`;
        } else {
          const d = ls.get(); const id = uid(); const now = new Date().toISOString();
          d.audits.unshift({ id, created_at: now, ...audit, counts_json: JSON.stringify(counts), has_image: false });
          anomalies.forEach((n) => d.anomalies.unshift({ id: uid(), audit_id: id, created_at: now, updated_at: now, status: 'Ouverte', comment: '', room: audit.room, ...n }));
          d.audits = d.audits.slice(0, 50); d.anomalies = d.anomalies.slice(0, 300);
          ls.set(d);
          msg.textContent = `✓ Audit enregistré localement (${anomalies.length} anomalie(s)).`;
        }
        db.lastSavedAt = st.analyzedAt;
        refreshCount();
      } catch (e) {
        msg.textContent = e.status === 401 ? 'Session expirée : reconnectez-vous (bouton Déconnexion puis connexion admin).' : `Échec de l'enregistrement : ${e.message}`;
        btn.disabled = false;
      }
    }

    // ------------------------------------------------------------ Registre
    async function loadAnomalies(status = '') {
      if (db.mode === 'cloud') return (await api(`/anomalies${status ? `?status=${encodeURIComponent(status)}` : ''}`)).anomalies;
      const sev = { Critique: 0, Majeure: 1, Mineure: 2 };
      return ls.get().anomalies.filter((n) => !status || n.status === status).sort((x, y) => sev[x.severity] - sev[y.severity]);
    }
    async function updateAnomaly(id, patch) {
      if (db.mode === 'cloud') return api(`/anomalies/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      const d = ls.get(); const n = d.anomalies.find((x) => x.id === id);
      if (n) Object.assign(n, patch, { updated_at: new Date().toISOString() }); ls.set(d);
    }
    let anoCache = [];
    async function renderAnomalies() {
      const tb = $('#anoTable tbody');
      try {
        const all = await loadAnomalies('');
        const filter = $('#anoFilter').value;
        anoCache = all;
        const list = filter ? all.filter((n) => n.status === filter) : all;
        const c = (s) => all.filter((n) => n.status === s).length;
        const done = c('Résolue') + c('Faux positif');
        const critOpen = all.filter((n) => n.severity === 'Critique' && (n.status === 'Ouverte' || n.status === 'En cours')).length;
        const kpi = (l, v, s, p) => `<div class="kpi${p ? ' primary' : ''}"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div><div class="kpi-sub">${s}</div></div>`;
        $('#anoKpis').innerHTML = [
          kpi('Anomalies ouvertes', c('Ouverte'), `dont ${critOpen} critique(s) non traitée(s)`, true),
          kpi('En cours', c('En cours'), 'action engagée'),
          kpi('Résolues', done, `${c('Faux positif')} faux positif(s)`),
          kpi('Taux de résolution', all.length ? `${Math.round((done / all.length) * 100)} %` : '—', `${all.length} anomalie(s) au total`),
        ].join('');
        tb.innerHTML = list.map((n) => `<tr data-id="${esc(n.id)}">
          <td class="nowrap">${fmt(n.created_at)}</td><td>${esc(n.room || '—')}</td><td>${esc(n.type)}</td>
          <td><span class="tag sev-${esc((n.severity || '').toLowerCase())}">${esc(n.severity)}</span></td>
          <td><b>${esc(n.title)}</b><br><span class="muted small">${esc(n.action)}</span></td>
          <td><select class="ano-status" aria-label="Statut">${STATUSES.map((s) => `<option${s === n.status ? ' selected' : ''}>${s}</option>`).join('')}</select></td>
          <td><input class="ano-comment" type="text" maxlength="500" value="${esc(n.comment || '')}" placeholder="Ajouter un commentaire" aria-label="Commentaire"></td></tr>`).join('')
          || '<tr><td colspan="7" class="muted">Aucune anomalie. Enregistrez un audit depuis l\'onglet Audit pour alimenter le registre.</td></tr>';
      } catch (e) {
        tb.innerHTML = `<tr><td colspan="7" class="muted">${e.status === 401 ? 'Code d\'accès requis (onglet Archives).' : `Impossible de charger le registre : ${esc(e.message)}`}</td></tr>`;
      }
      refreshCount();
    }
    $('#anoTable').addEventListener('change', async (e) => {
      const tr = e.target.closest('tr[data-id]'); if (!tr) return;
      const patch = e.target.classList.contains('ano-status') ? { status: e.target.value } : e.target.classList.contains('ano-comment') ? { comment: e.target.value } : null;
      if (!patch) return;
      try { await updateAnomaly(tr.dataset.id, patch); e.target.classList.add('saved'); setTimeout(() => e.target.classList.remove('saved'), 900); if (patch.status) renderAnomalies(); }
      catch (err) { alert(`Mise à jour impossible : ${err.message}`); }
    });
    $('#anoFilter').addEventListener('change', renderAnomalies);
    $('#anoRefresh').addEventListener('click', renderAnomalies);
    $('#anoCsv').addEventListener('click', () => {
      const head = ['date', 'salle', 'type', 'categorie', 'gravite', 'anomalie', 'action', 'statut', 'commentaire'];
      const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = anoCache.map((n) => [n.created_at, n.room, n.type, n.category, n.severity, n.title, n.action, n.status, n.comment].map(q).join(';'));
      const blob = new Blob(['﻿' + [head.join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'registre-anomalies.csv';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });

    async function refreshCount() {
      try {
        const all = db.mode === 'cloud' ? (await api('/anomalies')).anomalies : ls.get().anomalies;
        const open = all.filter((n) => n.status === 'Ouverte' || n.status === 'En cours').length;
        const b = $('#navAnoCount'); b.hidden = !open; b.textContent = open;
      } catch { /* silencieux */ }
    }

    // ------------------------------------------------------------ Archives
    const blobUrls = [];
    async function renderArchives() {
      const grid = $('#archGrid');
      blobUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
      try {
        const audits = db.mode === 'cloud' ? (await api('/audits')).audits : ls.get().audits;
        if (!audits.length) { grid.innerHTML = '<p class="muted">Aucun audit archivé pour l\'instant.</p>'; return; }
        grid.innerHTML = audits.map((a) => `<article class="arch-card" data-id="${esc(a.id)}">
          <div class="arch-img">${a.has_image ? '<span class="muted small">Chargement…</span>' : '<span class="muted small">Sans image</span>'}</div>
          <div class="arch-body">
            <b>${esc(a.room || 'Salle')}</b><span class="muted small">${fmt(a.created_at)} · ${esc(a.source || '')}</span>
            <span class="tag ${/Conforme/.test(a.global_status || '') ? 'status-ok' : 'status-warn'}">${esc(a.global_status || '—')}</span>
            <span class="small">${a.total ?? 0} objet(s) · ${a.gaps ?? 0} écart(s) · qualité ${esc(a.quality || '—')}${a.open_anomalies !== undefined ? ` · ${a.open_anomalies} anomalie(s) ouverte(s)` : ''}</span>
            <button class="btn btn-ghost btn-sm arch-del" type="button">Supprimer (droit à l'effacement)</button>
          </div></article>`).join('');
        if (db.mode === 'cloud') {
          for (const a of audits.filter((x) => x.has_image)) {
            try {
              const code = ss.get('esc.code');
              const r = await fetch(`/api/images/${a.id}`, { headers: code ? { 'x-access-code': code } : {} });
              if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) continue;
              const u = URL.createObjectURL(await r.blob()); blobUrls.push(u);
              const box = grid.querySelector(`[data-id="${CSS.escape(a.id)}"] .arch-img`);
              if (box) box.innerHTML = `<img src="${u}" alt="Image de l'audit ${esc(a.room || '')}">`;
            } catch { /* image indisponible */ }
          }
        }
      } catch (e) {
        grid.innerHTML = `<p class="muted">${e.status === 401 ? 'Code d\'accès requis : saisissez-le ci-dessus puis cliquez sur Actualiser.' : `Impossible de charger les archives : ${esc(e.message)}`}</p>`;
      }
    }
    $('#archGrid').addEventListener('click', async (e) => {
      if (!e.target.classList.contains('arch-del')) return;
      const card = e.target.closest('[data-id]');
      if (!confirm('Supprimer définitivement cet audit, son image et ses anomalies ?')) return;
      try {
        if (db.mode === 'cloud') await api(`/audits/${card.dataset.id}`, { method: 'DELETE' });
        else { const d = ls.get(); d.audits = d.audits.filter((a) => a.id !== card.dataset.id); d.anomalies = d.anomalies.filter((n) => n.audit_id !== card.dataset.id); ls.set(d); }
        renderArchives(); refreshCount();
      } catch (err) { alert(`Suppression impossible : ${err.message}`); }
    });
    $('#archRefresh').addEventListener('click', renderArchives);
    $('#accessCode').value = ss.get('esc.code');
    $('#accessCode').addEventListener('change', (e) => { ss.set('esc.code', e.target.value.trim()); renderArchives(); refreshCount(); });

    // ------------------------------------------------------------ Branchements
    $('#btnSave').addEventListener('click', save);
    document.addEventListener('esc:analyzed', () => { $('#btnSave').disabled = false; $('#saveMsg').textContent = ''; });
    document.addEventListener('esc:view', (e) => { if (e.detail === 'anomalies') renderAnomalies(); if (e.detail === 'archives') renderArchives(); });
    document.addEventListener('esc:auth', () => { refreshCount(); const v = location.hash.slice(1); if (v === 'anomalies') renderAnomalies(); if (v === 'archives') renderArchives(); });
    window.__ESC_DB__ = { db, buildAnomalies, renderAnomalies, renderArchives };
    connect().then(() => {
      const v = location.hash.slice(1);
      if (v === 'anomalies') renderAnomalies(); if (v === 'archives') renderArchives();
    });
  };
  if (window.__ESC__) start(); else document.addEventListener('esc:ready', start, { once: true });
})();
