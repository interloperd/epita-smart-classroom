/* EPITA Smart Classroom — logique applicative
 * Détection : TensorFlow.js + COCO-SSD, exécutée localement dans le navigateur.
 * Règles : aucune analyse des personnes, aucune image stockée, aucune détection inventée.
 */
'use strict';

(() => {
  // ------------------------------------------------------------------
  // 1. Référentiel : catégories cibles ↔ classes COCO réellement disponibles
  // ------------------------------------------------------------------
  /** Liste officielle des 80 classes COCO-SSD (tfjs-models/coco-ssd/src/classes.ts). */
  const COCO_CLASSES = ['person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat',
    'traffic light', 'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep',
    'cow', 'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
    'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
    'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple', 'sandwich',
    'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch', 'potted plant', 'bed',
    'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone', 'microwave', 'oven',
    'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'];

  /** Classes exclues par principe : jamais affichées, comptées ni conservées. */
  const EXCLUDED_CLASSES = new Set(['person']);

  /** Catégories cibles du sujet. coco = [] ⇒ non prise en charge par le modèle. */
  const CATEGORIES = [
    { key: 'tables',  label: 'Tables et bureaux',     coco: ['dining table'], support: 'partial', example: 10,
      note: 'Classe « dining table » : bureaux et tables de cours reconnus de façon imparfaite.' },
    { key: 'chairs',  label: 'Chaises',               coco: ['chair'],        support: 'yes',     example: 20 },
    { key: 'board',   label: 'Tableau',               coco: [],               support: 'no',      example: 1,
      note: 'Aucune classe « tableau / whiteboard » dans COCO.' },
    { key: 'laptops', label: 'Ordinateurs portables', coco: ['laptop'],       support: 'yes',     example: 5 },
    { key: 'screens', label: 'Écrans',                coco: ['tv'],           support: 'partial', example: null,
      note: 'Classe « tv » : moniteurs et écrans assimilés.' },
    { key: 'windows', label: 'Fenêtres',              coco: [],               support: 'no',      example: null,
      note: 'Aucune classe « window » dans COCO.' },
  ];

  /** Libellés français des autres équipements reconnaissables en salle. */
  const FR = {
    'chair': 'Chaise', 'dining table': 'Table / bureau', 'laptop': 'Ordinateur portable', 'tv': 'Écran',
    'keyboard': 'Clavier', 'mouse': 'Souris', 'book': 'Livre', 'clock': 'Horloge', 'potted plant': 'Plante',
    'couch': 'Canapé', 'bench': 'Banc', 'backpack': 'Sac à dos', 'handbag': 'Sac', 'cell phone': 'Téléphone',
    'bottle': 'Bouteille', 'cup': 'Tasse', 'remote': 'Télécommande', 'vase': 'Vase', 'scissors': 'Ciseaux',
    'refrigerator': 'Réfrigérateur', 'microwave': 'Micro-ondes', 'sink': 'Évier', 'umbrella': 'Parapluie',
    'suitcase': 'Valise', 'bed': 'Lit', 'oven': 'Four', 'toaster': 'Grille-pain', 'wine glass': 'Verre',
  };
  const fr = (c) => FR[c] || c;

  // Vérification au démarrage : chaque classe référencée existe bien dans COCO.
  CATEGORIES.forEach((c) => c.coco.forEach((k) => {
    if (!COCO_CLASSES.includes(k)) console.error(`[référentiel] classe inconnue de COCO : ${k}`);
  }));

  // ------------------------------------------------------------------
  // 2. État
  // ------------------------------------------------------------------
  const params = new URLSearchParams(location.search);
  const TEST = {
    modelFail: params.get('test') === 'model-fail',      // simule l'échec de chargement du modèle
    cameraDenied: params.get('test') === 'camera-denied', // simule un refus d'accès caméra
  };
  const MIN_RAW_SCORE = 0.15; // on garde les scores bas pour pouvoir rejouer le seuil sans relancer le modèle

  const state = {
    model: null, modelState: 'loading', modelBase: 'lite_mobilenet_v2',
    stream: null, live: false, liveTimer: null,
    raw: [],              // dernières prédictions (personnes déjà retirées)
    analyzed: false, source: null, analyzedAt: null, inferenceMs: null,
    imgW: 0, imgH: 0,
    threshold: 0.5,
    auditStart: null, lastDurationS: null,
    config: {}, roomName: 'Salle de démonstration',
    history: [],
  };

  // Stockage local : confort par utilisateur (config + historique chiffré, jamais d'image).
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
  };

  // ------------------------------------------------------------------
  // 3. Raccourcis DOM
  // ------------------------------------------------------------------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const els = {
    video: $('#video'), overlay: $('#overlay'), frame: $('#frame'), stage: $('#stage'),
    stageEmpty: $('#stageEmpty'), stageBadge: $('#stageBadge'), cameraMsg: $('#cameraMsg'),
    btnStart: $('#btnStart'), btnStop: $('#btnStop'), btnCapture: $('#btnCapture'), btnLive: $('#btnLive'),
    btnBack: $('#btnBack'), fileInput: $('#fileInput'), threshold: $('#threshold'), thresholdOut: $('#thresholdOut'),
    modelBase: $('#modelBase'), modelStatus: $('#modelStatus'), modelBanner: $('#modelBanner'),
    modelBannerMsg: $('#modelBannerMsg'), retryModel: $('#retryModel'),
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pct = (x) => `${Math.round(x * 100)} %`;
  const fmtTime = (d) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const fmtDate = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // ------------------------------------------------------------------
  // 4. Navigation
  // ------------------------------------------------------------------
  function show(view) {
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.id === `view-${view}`));
    $$('.nav-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
    if (view === 'rapport') renderReport();
    if (view === 'dashboard') renderDashboard();
    if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-view]');
    if (t) { e.preventDefault(); show(t.dataset.view); }
  });

  // ------------------------------------------------------------------
  // 5. Modèle
  // ------------------------------------------------------------------
  function setModelState(s, msg = '') {
    state.modelState = s;
    els.modelStatus.className = `model-status ${s}`;
    els.modelStatus.querySelector('.txt').textContent =
      s === 'ready' ? `Modèle prêt · ${state.modelBase}` : s === 'error' ? 'Modèle indisponible' : 'Chargement du modèle…';
    els.modelBanner.hidden = s !== 'error';
    els.modelBannerMsg.textContent = msg ? ` (${msg})` : '';
    updateButtons();
  }

  function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`délai de ${ms / 1000} s dépassé`)), ms))]);
  }

  async function loadModel() {
    setModelState('loading');
    state.model = null;
    try {
      if (TEST.modelFail) throw new Error('échec simulé — paramètre ?test=model-fail');
      if (typeof window.tf === 'undefined' || typeof window.cocoSsd === 'undefined') {
        throw new Error('bibliothèques TensorFlow.js / COCO-SSD non chargées — vérifiez la connexion');
      }
      await tf.ready();
      state.model = await withTimeout(cocoSsd.load({ base: state.modelBase }), 60000);
      setModelState('ready');
    } catch (err) {
      console.error('[modèle]', err);
      const m = err.message || String(err);
      setModelState('error', /fetch|network|load/i.test(m) && !/simulé|bibliothèques/.test(m)
        ? 'poids du modèle inaccessibles — vérifiez la connexion réseau' : m);
    }
  }
  els.retryModel.addEventListener('click', loadModel);
  els.modelBase.addEventListener('change', () => { state.modelBase = els.modelBase.value; loadModel(); });

  /** Détection + exclusion immédiate des personnes. Rien d'autre n'est conservé. */
  async function detect(source) {
    const preds = await state.model.detect(source, 100, MIN_RAW_SCORE);
    return preds
      .filter((p) => !EXCLUDED_CLASSES.has(p.class))
      .map((p) => ({ cls: p.class, score: p.score, bbox: p.bbox }));
  }

  // ------------------------------------------------------------------
  // 6. Caméra
  // ------------------------------------------------------------------
  function cameraError(err) {
    const name = err && err.name;
    const msgs = {
      NotAllowedError: "Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur, ou importez une image de test.",
      SecurityError: "Accès à la caméra bloqué par le navigateur (contexte non sécurisé). Utilisez HTTPS ou localhost, ou importez une image.",
      NotFoundError: "Aucune caméra détectée sur cet appareil. Importez une image de test pour réaliser l'audit.",
      NotReadableError: "La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.",
      OverconstrainedError: "La caméra ne supporte pas la résolution demandée. Réessayez.",
      Unsupported: "Ce navigateur ne permet pas l'accès à la caméra (API indisponible ou page non sécurisée). Importez une image.",
    };
    showAlert(msgs[name] || `Impossible de démarrer la caméra (${esc(err && err.message || name)}). Importez une image de test.`);
  }
  function showAlert(html) { els.cameraMsg.innerHTML = html; els.cameraMsg.hidden = false; }
  function hideAlert() { els.cameraMsg.hidden = true; }

  async function startCamera() {
    hideAlert();
    try {
      if (TEST.cameraDenied) throw Object.assign(new Error('refus simulé'), { name: 'NotAllowedError' });
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw Object.assign(new Error('getUserMedia indisponible'), { name: 'Unsupported' });
      }
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
      els.video.srcObject = state.stream;
      await els.video.play();
      els.stageEmpty.hidden = true;
      unfreeze();
      if (!state.auditStart) state.auditStart = performance.now();
      setBadge('Caméra active · rien n\'est enregistré');
    } catch (err) {
      console.warn('[caméra]', err);
      stopCamera();
      cameraError(err);
    }
    updateButtons();
  }

  function stopCamera() {
    stopLive();
    if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
    els.video.srcObject = null;
    clearCanvas(els.overlay);
    if (!els.stage.classList.contains('frozen')) { els.stageEmpty.hidden = false; setBadge(null); }
    updateButtons();
  }

  function setBadge(txt) { els.stageBadge.hidden = !txt; els.stageBadge.textContent = txt || ''; }
  function clearCanvas(c) { c.getContext('2d').clearRect(0, 0, c.width, c.height); }
  function freeze() { els.stage.classList.add('frozen'); els.btnBack.hidden = !state.stream; }
  function unfreeze() { els.stage.classList.remove('frozen'); els.btnBack.hidden = true; }

  // Détection en direct (aperçu uniquement : n'alimente pas l'audit)
  function stopLive() {
    state.live = false; clearTimeout(state.liveTimer);
    els.btnLive.textContent = 'Détection en direct : off'; els.btnLive.setAttribute('aria-pressed', 'false');
    clearCanvas(els.overlay);
  }
  async function liveLoop() {
    if (!state.live || !state.stream || !state.model) return;
    const v = els.video;
    if (v.videoWidth) {
      try {
        const preds = (await detect(v)).filter((p) => p.score >= state.threshold);
        els.overlay.width = v.videoWidth; els.overlay.height = v.videoHeight;
        drawBoxes(els.overlay, preds, false);
      } catch (e) { console.warn('[live]', e); }
    }
    state.liveTimer = setTimeout(liveLoop, 350);
  }
  els.btnLive.addEventListener('click', () => {
    if (state.live) return stopLive();
    state.live = true; unfreeze();
    els.btnLive.textContent = 'Détection en direct : on'; els.btnLive.setAttribute('aria-pressed', 'true');
    liveLoop();
  });

  // ------------------------------------------------------------------
  // 7. Analyse (capture webcam ou image importée)
  // ------------------------------------------------------------------
  async function analyzeFromCanvas(sourceLabel) {
    const t0 = performance.now();
    try {
      state.raw = await detect(els.frame);
    } catch (err) {
      console.error('[détection]', err);
      showAlert(`La détection a échoué (${esc(err.message)}). Réessayez ou rechargez le modèle.`);
      return;
    }
    state.inferenceMs = performance.now() - t0;
    state.analyzed = true;
    state.source = sourceLabel;
    state.analyzedAt = new Date();
    state.lastDurationS = state.auditStart ? (performance.now() - state.auditStart) / 1000 : state.inferenceMs / 1000;
    state.auditStart = state.stream ? performance.now() : null; // l'audit suivant démarre maintenant si la caméra reste ouverte
    redrawFrame();
    renderResults();
    pushHistory();
  }

  let frameBitmap = null; // copie en mémoire de l'image analysée, pour redessiner les cadres (jamais persistée)
  function redrawFrame() {
    const c = els.frame, ctx = c.getContext('2d');
    if (frameBitmap) { ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(frameBitmap, 0, 0, c.width, c.height); }
    drawBoxes(c, filtered(), true, false);
  }

  async function capture() {
    const v = els.video;
    if (!v.videoWidth) return;
    stopLive();
    els.frame.width = v.videoWidth; els.frame.height = v.videoHeight;
    els.frame.getContext('2d').drawImage(v, 0, 0);
    frameBitmap = await createImageBitmap(els.frame);
    freeze();
    setBadge('Image figée · analyse locale');
    await analyzeFromCanvas('Webcam');
  }

  async function analyzeFile(file) {
    if (!file || !file.type.startsWith('image/')) { showAlert('Format non pris en charge : choisissez une image (JPG, PNG, WebP).'); return; }
    hideAlert();
    if (!state.auditStart) state.auditStart = performance.now();
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const maxW = 1600, scale = Math.min(1, maxW / img.naturalWidth);
      els.frame.width = Math.round(img.naturalWidth * scale);
      els.frame.height = Math.round(img.naturalHeight * scale);
      els.frame.getContext('2d').drawImage(img, 0, 0, els.frame.width, els.frame.height);
      frameBitmap = await createImageBitmap(els.frame);
    } catch (e) {
      showAlert("Impossible de lire cette image."); return;
    } finally {
      URL.revokeObjectURL(url);
      els.fileInput.value = '';
    }
    stopLive();
    els.stageEmpty.hidden = true;
    freeze();
    setBadge('Image importée · analyse locale');
    if (!state.model) { showAlert('Image chargée, mais le modèle est indisponible : analyse impossible pour le moment.'); return; }
    await analyzeFromCanvas('Image importée');
  }

  els.btnStart.addEventListener('click', startCamera);
  els.btnStop.addEventListener('click', stopCamera);
  els.btnCapture.addEventListener('click', capture);
  els.btnBack.addEventListener('click', () => { unfreeze(); setBadge('Caméra active · rien n\'est enregistré'); });
  els.fileInput.addEventListener('change', (e) => analyzeFile(e.target.files[0]));

  els.threshold.addEventListener('input', () => {
    state.threshold = parseFloat(els.threshold.value);
    els.thresholdOut.textContent = pct(state.threshold);
    if (state.analyzed) { redrawFrame(); renderResults(); }
  });

  function updateButtons() {
    const ready = state.modelState === 'ready';
    els.btnStart.disabled = !!state.stream;
    els.btnStop.disabled = !state.stream;
    els.btnCapture.disabled = !state.stream || !ready;
    els.btnLive.disabled = !state.stream || !ready;
  }

  // ------------------------------------------------------------------
  // 8. Dessin des cadres
  // ------------------------------------------------------------------
  function drawBoxes(canvas, preds, keepImage = false, clear = true) {
    const ctx = canvas.getContext('2d');
    if (clear && !keepImage) ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = Math.max(1, canvas.width / 900);
    ctx.lineWidth = 2.5 * s;
    ctx.font = `600 ${13 * s}px Montserrat, sans-serif`;
    preds.forEach((p) => {
      const [x, y, w, h] = p.bbox;
      ctx.strokeStyle = '#B794E0';
      ctx.strokeRect(x, y, w, h);
      const label = `${fr(p.cls)} · ${Math.round(p.score * 100)} %`;
      const tw = ctx.measureText(label).width + 12 * s, th = 20 * s;
      const ly = y > th ? y - th : y;
      ctx.fillStyle = '#5B2D8E';
      ctx.fillRect(x - ctx.lineWidth / 2, ly, tw, th);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, x + 6 * s - ctx.lineWidth / 2, ly + 14 * s);
    });
  }

  // ------------------------------------------------------------------
  // 9. Calculs d'audit (uniquement à partir des détections réelles)
  // ------------------------------------------------------------------
  const filtered = () => state.raw.filter((p) => p.score >= state.threshold);

  function countsByClass(preds) {
    const m = new Map();
    preds.forEach((p) => {
      const e = m.get(p.cls) || { n: 0, sum: 0, min: 1, max: 0 };
      e.n++; e.sum += p.score; e.min = Math.min(e.min, p.score); e.max = Math.max(e.max, p.score);
      m.set(p.cls, e);
    });
    return m;
  }

  function computeAudit() {
    const preds = filtered();
    const counts = countsByClass(preds);
    const rows = CATEGORIES.map((c) => {
      const raw = state.config[c.key];
      const expected = raw === '' || raw === null || raw === undefined || Number.isNaN(Number(raw)) ? null : Number(raw);
      const supported = c.coco.length > 0;
      const detected = supported && state.analyzed ? c.coco.reduce((s, k) => s + (counts.get(k)?.n || 0), 0) : null;
      let status, gap = null;
      if (expected === null) status = { code: 'unset', label: 'Non contrôlé', cls: 'status-na', sym: '—' };
      else if (!supported) status = { code: 'unsupported', label: 'Non vérifiable (hors modèle)', cls: 'status-na', sym: '∅' };
      else if (!state.analyzed) status = { code: 'pending', label: 'En attente d\'analyse', cls: 'status-pending', sym: '…' };
      else {
        gap = detected - expected;
        if (gap === 0) status = { code: 'ok', label: 'Conforme', cls: 'status-ok', sym: '✓' };
        else if (gap < 0) status = { code: 'under', label: 'À vérifier — sous-détection', cls: 'status-warn', sym: '△' };
        else status = { code: 'over', label: 'À vérifier — surplus', cls: 'status-warn', sym: '△' };
      }
      return { ...c, expected, supported, detected, gap, status };
    });
    const verifiable = rows.filter((r) => r.expected !== null && r.supported);
    const gaps = verifiable.filter((r) => r.status.code === 'under' || r.status.code === 'over');
    const unsupportedRules = rows.filter((r) => r.expected !== null && !r.supported);
    const sumExp = verifiable.reduce((s, r) => s + r.expected, 0);
    const detRate = state.analyzed && sumExp > 0
      ? verifiable.reduce((s, r) => s + Math.min(r.detected, r.expected), 0) / sumExp : null;

    let global;
    if (!state.analyzed) global = { label: 'En attente d\'analyse', cls: 'status-pending', code: 'pending' };
    else if (verifiable.length === 0) global = { label: 'Aucune règle vérifiable', cls: 'status-na', code: 'none' };
    else if (gaps.length === 0) global = { label: 'Conforme sur le périmètre vérifiable', cls: 'status-ok', code: 'ok' };
    else global = { label: `Écarts à vérifier (${gaps.length})`, cls: 'status-warn', code: 'warn' };

    const belowThreshold = state.raw.filter((p) => p.score < state.threshold).length;
    return { preds, counts, rows, verifiable, gaps, unsupportedRules, detRate, global, belowThreshold };
  }

  // ------------------------------------------------------------------
  // 10. Rendus
  // ------------------------------------------------------------------
  function renderScope() {
    const tag = (s) => s === 'yes' ? '<span class="tag tag-yes">Pris en charge</span>'
      : s === 'partial' ? '<span class="tag tag-partial">Partiel</span>' : '<span class="tag tag-no">Non pris en charge</span>';
    $('#scopeList').innerHTML = CATEGORIES.map((c) =>
      `<li><span>${esc(c.label)} ${c.coco.length ? `<span class="code">${c.coco.join(', ')}</span>` : ''}</span>${tag(c.support)}</li>`
    ).join('') + '<li><span>Autres équipements <span class="code">keyboard, mouse, book, clock, potted plant…</span></span><span class="tag tag-partial">Selon le modèle</span></li>';
  }

  function renderConfig() {
    $('#configTable tbody').innerHTML = CATEGORIES.map((c) => {
      const v = state.config[c.key];
      const sup = c.support === 'yes' ? '<span class="tag tag-yes">Oui</span>' : c.support === 'partial' ? '<span class="tag tag-partial">Partiel</span>' : '<span class="tag tag-no">Non</span>';
      return `<tr><td><b>${esc(c.label)}</b>${c.note ? `<br><span class="muted small">${esc(c.note)}</span>` : ''}</td>
        <td class="code">${c.coco.length ? c.coco.join(', ') : '—'}</td><td>${sup}</td>
        <td class="num"><input type="number" min="0" max="999" step="1" data-key="${c.key}" value="${v ?? ''}" aria-label="Quantité attendue ${esc(c.label)}"></td></tr>`;
    }).join('');
    $('#roomName').value = state.roomName;
  }

  $('#configTable').addEventListener('input', (e) => {
    const k = e.target.dataset.key; if (!k) return;
    const v = e.target.value.trim();
    state.config[k] = v === '' ? null : Math.max(0, Math.floor(Number(v)));
    store.set('esc.config', state.config);
  });
  $('#roomName').addEventListener('input', (e) => { state.roomName = e.target.value; store.set('esc.room', state.roomName); });
  $('#btnResetConfig').addEventListener('click', () => {
    state.config = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.example]));
    store.set('esc.config', state.config); renderConfig();
  });

  function renderResults() {
    const a = computeAudit();
    const tbody = $('#countsTable tbody');
    const entries = [...a.counts.entries()].sort((x, y) => y[1].n - x[1].n);
    $('#countsEmpty').hidden = state.analyzed;
    $('#countsTable').hidden = !state.analyzed;
    $('#countsEmpty').textContent = 'Aucune analyse pour l\'instant.';
    if (state.analyzed && entries.length === 0) {
      $('#countsEmpty').hidden = false; $('#countsTable').hidden = true;
      $('#countsEmpty').textContent = 'Aucun objet détecté au-dessus du seuil. Abaissez le seuil ou recadrez la prise de vue.';
    }
    tbody.innerHTML = entries.map(([k, e]) =>
      `<tr><td>${esc(fr(k))} <span class="code">${esc(k)}</span></td><td class="num"><b>${e.n}</b></td><td class="num">${pct(e.sum / e.n)}</td></tr>`).join('');

    const sorted = [...state.raw].sort((x, y) => y.score - x.score);
    $('#detList').innerHTML = sorted.map((p) => {
      const below = p.score < state.threshold;
      return `<li class="${below ? 'below' : ''}"><span>${esc(fr(p.cls))}${below ? ' <span class="muted small">(sous le seuil)</span>' : ''}</span><b>${pct(p.score)}</b><div class="bar"><span style="width:${p.score * 100}%"></span></div></li>`;
    }).join('') || '<li class="muted">—</li>';
    $('#detMeta').textContent = state.analyzed ? `· ${a.preds.length} retenue(s) · ${Math.round(state.inferenceMs)} ms` : '';
  }

  function renderDashboard() {
    const a = computeAudit();
    const avgDur = state.history.length ? state.history.reduce((s, h) => s + h.durationS, 0) / state.history.length : null;
    const kpi = (label, value, sub, primary = false) =>
      `<div class="kpi${primary ? ' primary' : ''}"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div></div>`;
    const na = '—';
    $('#kpis').innerHTML = [
      kpi('Objets détectés', state.analyzed ? a.preds.length : na, `au-dessus du seuil de ${pct(state.threshold)}`, true),
      kpi('Catégories reconnues', state.analyzed ? a.counts.size : na, 'classes COCO distinctes'),
      kpi('Règles vérifiables', a.verifiable.length, `${a.unsupportedRules.length} règle(s) hors modèle`),
      kpi('Écarts observés', state.analyzed ? a.gaps.length : na, 'attendu ≠ détecté'),
      kpi('Taux de détection', a.detRate === null ? na : pct(a.detRate), 'vs. configuration attendue'),
      kpi('Durée de l\'audit', state.lastDurationS === null ? na : `${state.lastDurationS.toFixed(1)} s`, avgDur === null ? 'moyenne : —' : `moyenne : ${avgDur.toFixed(1)} s sur ${state.history.length} audit(s)`),
      kpi('Temps d\'inférence', state.inferenceMs === null ? na : `${Math.round(state.inferenceMs)} ms`, state.modelBase),
      kpi('Statut global', `<span style="font-size:1.1rem;font-weight:500">${a.global.label}</span>`, state.analyzedAt ? `analyse de ${fmtTime(state.analyzedAt)}` : 'aucune analyse'),
    ].join('');
    const g = $('#globalStatus'); g.className = `status-chip ${a.global.cls}`; g.textContent = a.global.label;

    $('#auditTable tbody').innerHTML = a.rows.map((r) => `<tr>
      <td><b>${esc(r.label)}</b></td>
      <td class="num">${r.expected ?? '—'}</td>
      <td class="num">${r.detected ?? (r.supported ? '—' : 'n/a')}</td>
      <td class="num">${r.gap === null ? '—' : (r.gap > 0 ? '+' : '') + r.gap}</td>
      <td><span class="tag ${r.status.cls}">${r.status.sym} ${esc(r.status.label)}</span></td></tr>`).join('');

    $('#historyTable tbody').innerHTML = state.history.slice().reverse().map((h) =>
      `<tr><td>${esc(h.time)}</td><td>${esc(h.source)}</td><td class="num">${h.total}</td><td class="num">${h.gaps}</td><td class="num">${h.durationS.toFixed(1)} s</td></tr>`).join('')
      || '<tr><td colspan="5" class="muted">Aucun audit enregistré.</td></tr>';
  }

  function pushHistory() {
    const a = computeAudit();
    state.history.push({ time: fmtTime(state.analyzedAt), source: state.source, total: a.preds.length, gaps: a.gaps.length, durationS: state.lastDurationS });
    state.history = state.history.slice(-20);
    store.set('esc.history', state.history);
  }
  $('#btnClearHistory').addEventListener('click', () => { state.history = []; store.set('esc.history', []); renderDashboard(); });

  // ------------------------------------------------------------------
  // 11. Rapport d'audit (généré par règles, sans IA générative)
  // ------------------------------------------------------------------
  function recommendations(a) {
    const rec = [];
    a.rows.forEach((r) => {
      if (r.status.code === 'under') rec.push(`${r.label} : ${-r.gap} unité(s) non retrouvée(s). Contrôle visuel sur place, puis nouvelle prise de vue sous un autre angle (objets masqués ou empilés probables). Ne pas conclure à une absence.`);
      if (r.status.code === 'over') rec.push(`${r.label} : ${r.gap} unité(s) en surplus. Vérifier les doublons de détection, le mobilier d'une salle voisine dans le champ, ou mettre à jour la configuration théorique.`);
      if (r.status.code === 'unsupported') rec.push(`${r.label} : catégorie non reconnue par COCO-SSD. Comptage manuel requis (attendu : ${r.expected}).`);
    });
    if (a.belowThreshold > 0) rec.push(`${a.belowThreshold} détection(s) sous le seuil de ${pct(state.threshold)} ont été écartées : en cas de doute, les examiner en abaissant temporairement le seuil.`);
    if (state.analyzed && a.verifiable.length && a.gaps.length === 0) rec.push('Aucun écart sur les catégories vérifiables : contrôle complémentaire limité aux catégories hors modèle.');
    rec.push('Pour une salle étendue, réaliser plusieurs audits par zone plutôt qu\'une prise de vue unique.');
    return rec;
  }

  const LIMITS = [
    'Modèle pré-entraîné sur COCO (images du quotidien), non spécialisé pour les salles de cours : bureaux reconnus comme « dining table », écrans comme « tv ».',
    'Tableau et fenêtres absents des 80 classes COCO : non vérifiables automatiquement.',
    'Une seule image analysée : les objets masqués, empilés, coupés par le cadre ou trop petits ne sont pas comptés.',
    'Le score de confiance n\'est pas une probabilité calibrée ; le résultat dépend du seuil choisi.',
    'Sensibilité à l\'éclairage, aux reflets, au flou et à l\'angle de prise de vue.',
    'Les personnes sont volontairement exclues ; une personne masquant du mobilier réduit le comptage.',
  ];

  function renderReport() {
    const a = computeAudit();
    const d = state.analyzedAt || new Date();
    const detected = [...a.counts.entries()].sort((x, y) => y[1].n - x[1].n);
    const exec = !state.analyzed
      ? 'Aucune analyse n\'a encore été réalisée. Lancez un audit depuis l\'onglet <strong>Audit</strong> pour générer un compte rendu complet.'
      : `<strong>${a.global.label}.</strong> ${a.preds.length} objet(s) détecté(s) dans ${a.counts.size} catégorie(s), ${a.verifiable.length} règle(s) vérifiable(s), <strong>${a.gaps.length} écart(s)</strong> observé(s)${a.unsupportedRules.length ? `, ${a.unsupportedRules.length} catégorie(s) à contrôler manuellement` : ''}.`;

    $('#report').innerHTML = `
      <header>
        <p class="eyebrow">EPITA Smart Classroom · Compte rendu d'audit</p>
        <h1>${esc(state.roomName || 'Salle non nommée')}</h1>
        <div class="meta">
          <div><span>Date</span>${fmtDate(d)} · ${fmtTime(d)}</div>
          <div><span>Source</span>${esc(state.source || '—')}</div>
          <div><span>Modèle</span>COCO-SSD · ${esc(state.modelBase)}</div>
          <div><span>Seuil de confiance</span>${pct(state.threshold)}</div>
          <div><span>Durée de l'audit</span>${state.lastDurationS === null ? '—' : state.lastDurationS.toFixed(1) + ' s'}</div>
          <div><span>Inférence</span>${state.inferenceMs === null ? '—' : Math.round(state.inferenceMs) + ' ms, locale'}</div>
        </div>
      </header>
      <p class="exec">${exec}</p>

      <h2>1. Contexte de l'audit</h2>
      <p>Audit visuel automatisé de la configuration de la salle par détection d'objets (apprentissage supervisé, modèle pré-entraîné COCO-SSD exécuté dans le navigateur). Les valeurs attendues sont fictives et servent à la démonstration. Aucune personne n'a été analysée et aucune image n'a été enregistrée ni transmise.</p>

      <h2>2. Objets détectés</h2>
      ${detected.length ? `<table class="table"><thead><tr><th>Objet</th><th>Classe COCO</th><th class="num">Nombre</th><th class="num">Confiance (min–max)</th></tr></thead><tbody>
        ${detected.map(([k, e]) => `<tr><td>${esc(fr(k))}</td><td class="code">${esc(k)}</td><td class="num">${e.n}</td><td class="num">${pct(e.min)} – ${pct(e.max)}</td></tr>`).join('')}
      </tbody></table>` : '<p class="muted">Aucun objet détecté au-dessus du seuil.</p>'}

      <h2>3. Quantités attendues et observées</h2>
      <table class="table"><thead><tr><th>Catégorie</th><th class="num">Attendu</th><th class="num">Observé</th><th class="num">Écart</th><th>Statut</th></tr></thead><tbody>
        ${a.rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="num">${r.expected ?? '—'}</td><td class="num">${r.detected ?? (r.supported ? '—' : 'n/a')}</td><td class="num">${r.gap === null ? '—' : (r.gap > 0 ? '+' : '') + r.gap}</td><td>${r.status.sym} ${esc(r.status.label)}</td></tr>`).join('')}
      </tbody></table>

      <h2>4. Écarts identifiés</h2>
      ${a.gaps.length ? `<ul>${a.gaps.map((r) => `<li><b>${esc(r.label)}</b> : attendu ${r.expected}, observé ${r.detected} (${r.gap > 0 ? '+' : ''}${r.gap}).</li>`).join('')}</ul>`
        : `<p>${state.analyzed ? 'Aucun écart sur les catégories vérifiables.' : '—'}</p>`}
      <p class="muted small">Un objet non détecté n'est pas réputé absent : il peut être masqué, mal cadré ou non reconnu.</p>

      <h2>5. Catégories non prises en charge</h2>
      <ul>${CATEGORIES.filter((c) => !c.coco.length).map((c) => `<li><b>${esc(c.label)}</b> — ${esc(c.note)}</li>`).join('')}
        <li><b>Personnes</b> — exclues par principe (classe « person » supprimée avant tout traitement).</li></ul>

      <h2>6. Limites de l'analyse</h2>
      <ul>${LIMITS.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>

      <h2>7. Recommandations de contrôle complémentaire</h2>
      <ul>${recommendations(a).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="note">Rapport généré automatiquement par règles programmées · EPITA Smart Classroom · aucune IA générative.</p>`;
  }

  function reportMarkdown() {
    const a = computeAudit();
    const d = state.analyzedAt || new Date();
    const L = [];
    L.push(`# Rapport d'audit — ${state.roomName || 'Salle non nommée'}`, '');
    L.push(`- **Date** : ${fmtDate(d)} ${fmtTime(d)}`, `- **Source** : ${state.source || '—'}`, `- **Modèle** : COCO-SSD (${state.modelBase}), TensorFlow.js, inférence locale`,
      `- **Seuil de confiance** : ${pct(state.threshold)}`, `- **Statut global** : ${a.global.label}`, '');
    L.push('## 1. Contexte', 'Audit visuel automatisé par détection d\'objets (modèle pré-entraîné). Valeurs attendues fictives. Aucune personne analysée, aucune image enregistrée.', '');
    L.push('## 2. Objets détectés', '| Objet | Classe COCO | Nombre | Confiance min–max |', '|---|---|---:|---:|');
    [...a.counts.entries()].forEach(([k, e]) => L.push(`| ${fr(k)} | ${k} | ${e.n} | ${pct(e.min)} – ${pct(e.max)} |`));
    L.push('', '## 3. Attendu vs observé', '| Catégorie | Attendu | Observé | Écart | Statut |', '|---|---:|---:|---:|---|');
    a.rows.forEach((r) => L.push(`| ${r.label} | ${r.expected ?? '—'} | ${r.detected ?? (r.supported ? '—' : 'n/a')} | ${r.gap === null ? '—' : (r.gap > 0 ? '+' : '') + r.gap} | ${r.status.label} |`));
    L.push('', '## 4. Écarts identifiés');
    if (a.gaps.length) a.gaps.forEach((r) => L.push(`- ${r.label} : attendu ${r.expected}, observé ${r.detected}`)); else L.push('- Aucun');
    L.push('', '## 5. Catégories non prises en charge');
    CATEGORIES.filter((c) => !c.coco.length).forEach((c) => L.push(`- ${c.label} — ${c.note}`));
    L.push('- Personnes — exclues par principe', '', '## 6. Limites');
    LIMITS.forEach((l) => L.push(`- ${l}`));
    L.push('', '## 7. Recommandations');
    recommendations(a).forEach((r) => L.push(`- ${r}`));
    return L.join('\n');
  }

  $('#btnPrint').addEventListener('click', () => { renderReport(); window.print(); });
  $('#btnMd').addEventListener('click', () => {
    const blob = new Blob([reportMarkdown()], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rapport-audit-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.md`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // ------------------------------------------------------------------
  // 12. Initialisation
  // ------------------------------------------------------------------
  function init() {
    const saved = store.get('esc.config', null);
    state.config = saved || Object.fromEntries(CATEGORIES.map((c) => [c.key, c.example]));
    state.roomName = store.get('esc.room', state.roomName);
    state.history = store.get('esc.history', []);
    renderScope(); renderConfig(); renderResults(); renderDashboard();
    const initial = location.hash.slice(1);
    if (['accueil', 'audit', 'config', 'dashboard', 'rapport'].includes(initial)) show(initial);
    updateButtons();
    loadModel();
    window.addEventListener('beforeunload', stopCamera);
  }
  init();

  // Exposé pour les tests automatisés uniquement (lecture seule de l'état calculé)
  window.__ESC__ = { computeAudit, state };
})();
