/* EPITA Smart Classroom — analyse avancée « open-vocabulary » (OWL-ViT, Google) via Transformers.js (Hugging Face).
 * Complète COCO-SSD sur l'image capturée : tables / bureaux de cours, tableau, fenêtres.
 * Détection zéro-shot par description textuelle, exécutée dans le navigateur (WebAssembly, modèle quantifié 8 bits).
 * Seules des catégories de mobilier sont demandées : le modèle ne cherche jamais de personnes.
 */
const TJS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const MODEL_ID = 'Xenova/owlvit-base-patch32';
const THRESHOLD = 0.1; // les scores OWL-ViT sont naturellement bas (≈ 0,1–0,4)

// Requêtes textuelles → classe interne de l'application
const QUERIES = [
  { text: 'a classroom desk', cls: 'desk' },
  { text: 'a school desk', cls: 'desk' },
  { text: 'a table', cls: 'desk' },
  { text: 'a whiteboard', cls: 'whiteboard' },
  { text: 'a blackboard', cls: 'whiteboard' },
  { text: 'a window', cls: 'window' },
  { text: 'a door', cls: 'door' },
];

const iou = (a, b) => {
  const ix = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
  const iy = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
  const i = ix * iy; return i / (a[2] * a[3] + b[2] * b[3] - i || 1);
};
/** Suppression des non-maxima par classe (plusieurs requêtes peuvent viser le même objet). */
function nms(list, thr = 0.45) {
  const out = [];
  list.sort((x, y) => y.score - x.score).forEach((p) => {
    if (!out.some((q) => q.cls === p.cls && iou(q.bbox, p.bbox) > thr)) out.push(p);
  });
  return out;
}

const start = () => {
  const E = window.__ESC__;
  const $ = (s) => document.querySelector(s);
  const btn = $('#btnAdvanced'), msg = $('#advMsg');
  let detector = null, loading = null;

  async function getDetector() {
    if (detector) return detector;
    if (!loading) {
      loading = (async () => {
        const { pipeline, env } = await import(TJS_URL);
        env.allowLocalModels = false;
        const files = {};
        const progress = (p) => {
          if (p.status === 'progress' && p.total) {
            files[p.file] = [p.loaded, p.total];
            const [l, t] = Object.values(files).reduce((a, [x, y]) => [a[0] + x, a[1] + y], [0, 0]);
            msg.textContent = `Téléchargement du modèle OWL-ViT (une seule fois, mis en cache) : ${Math.round((l / t) * 100)} % · ${Math.round(t / 1e6)} Mo`;
          }
        };
        // Version quantifiée 8 bits exécutée en WebAssembly : la plus légère et la plus compatible (ordinateur et mobile)
        return pipeline('zero-shot-object-detection', MODEL_ID, { device: 'wasm', dtype: 'q8', progress_callback: progress });
      })();
    }
    detector = await loading;
    return detector;
  }

  async function run() {
    const bmp = E.getFrameBitmap();
    if (!bmp || !E.state.analyzed) { msg.textContent = 'Faites d\'abord une capture ou importez une image.'; return; }
    btn.disabled = true;
    try {
      msg.textContent = 'Chargement du modèle OWL-ViT…';
      const det = await getDetector();
      msg.textContent = 'Analyse avancée en cours (quelques secondes)…';
      const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
      const url = URL.createObjectURL(blob); // image éphémère, jamais stockée
      const t0 = performance.now();
      let out;
      try { out = await det(url, QUERIES.map((q) => q.text), { threshold: THRESHOLD, percentage: false }); }
      finally { URL.revokeObjectURL(url); }
      const ms = Math.round(performance.now() - t0);
      let preds = out.map((o) => {
        const q = QUERIES.find((x) => x.text === o.label);
        const b = o.box;
        return { cls: q ? q.cls : 'desk', score: o.score, bbox: [b.xmin, b.ymin, Math.max(1, b.xmax - b.xmin), Math.max(1, b.ymax - b.ymin)], source: 'owlvit' };
      });
      preds = nms(preds);
      // pas de double comptage : on écarte les bureaux OWL-ViT qui recouvrent une table déjà trouvée par COCO-SSD
      const cocoTables = E.filtered().filter((p) => p.cls === 'dining table' && p.bbox);
      preds = preds.filter((p) => p.cls !== 'desk' || !cocoTables.some((t) => iou(t.bbox, p.bbox) > 0.3));
      // vignettes découpées dans l'image analysée (en mémoire uniquement)
      found = preds.map((p, i) => ({ ...p, id: i, keep: true, frame: [bmp.width, bmp.height], ...cropOf(bmp, p.bbox) }));
      E.addAdvanced(preds);
      renderGallery();
      const n = (k) => preds.filter((p) => p.cls === k).length;
      msg.textContent = `✓ Analyse avancée (${ms} ms) : +${n('desk')} table(s)/bureau(x), ${n('whiteboard')} tableau(x), ${n('window')} fenêtre(s), ${n('door')} porte(s). Tableau, fenêtres et portes sont désormais vérifiables pour cet audit.`;
    } catch (e) {
      console.error('[OWL-ViT]', e);
      msg.textContent = `Analyse avancée indisponible (${e.message || e}). L'audit COCO-SSD reste valable.`;
      loading = null;
    } finally { btn.disabled = false; }
  }

  // ---- Galerie des objets trouvés par l'analyse avancée
  let found = [];
  const LABEL = { desk: 'Table / bureau', whiteboard: 'Tableau', window: 'Fenêtre', door: 'Porte' };
  function cropOf(bmp, [x, y, w, h]) {
    try {
      const c = document.createElement('canvas'); c.width = 160; c.height = 160;
      const side = Math.max(w, h) * 1.08, cx = x + w / 2 - side / 2, cy = y + h / 2 - side / 2;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.fillStyle = '#2A1342'; g.fillRect(0, 0, 160, 160);
      g.drawImage(bmp, cx, cy, side, side, 0, 0, 160, 160);
      const d = g.getImageData(40, 40, 80, 80).data; let L = 0;
      for (let i = 0; i < d.length; i += 4) L += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      return { thumb: c.toDataURL('image/jpeg', 0.78), lum: Math.round((L / (d.length / 4)) / 2.55) };
    } catch { return { thumb: '', lum: null }; }
  }
  function renderGallery() {
    const box = $('#advGallery');
    if (!found.length) { box.hidden = true; return; }
    box.hidden = false;
    const kept = found.filter((f) => f.keep).length;
    box.innerHTML = `<div class="adv-head"><b>Objets trouvés par l'analyse avancée</b><span class="muted small">${kept}/${found.length} retenu(s) dans l'audit · décochez une détection fausse</span>
        <button class="btn btn-primary btn-sm" type="button" id="advToInv"${kept ? '' : ' disabled'}>＋ Ajouter la sélection à l'inventaire</button></div>
      <div class="coll-grid">${found.map((f) => `<label class="coll-item${f.keep ? ' on' : ''}">
        <input type="checkbox" data-adv="${f.id}" ${f.keep ? 'checked' : ''} aria-label="Retenir ${LABEL[f.cls]}">
        ${f.thumb ? `<img src="${f.thumb}" alt="">` : '<img alt="">'}
        <div><b>${LABEL[f.cls] || f.cls}</b><span>OWL-ViT · ${Math.round(f.score * 100)} %</span></div></label>`).join('')}</div>`;
  }
  $('#advGallery').addEventListener('change', (e) => {
    const id = e.target.dataset.adv; if (id === undefined) return;
    const f = found.find((x) => String(x.id) === id); if (!f) return;
    f.keep = e.target.checked;
    E.addAdvanced(found.filter((x) => x.keep).map(({ cls, score, bbox, source }) => ({ cls, score, bbox, source })));
    renderGallery();
  });
  $('#advGallery').addEventListener('click', (e) => {
    if (e.target.id !== 'advToInv') return;
    const sel = found.filter((f) => f.keep);
    if (!window.__ESC_SCAN__ || !sel.length) return;
    window.__ESC_SCAN__.addExternal(sel);
    e.target.disabled = true; e.target.textContent = `✓ ${sel.length} objet(s) envoyé(s) dans « À valider »`;
    document.getElementById('collectionCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.addEventListener('esc:analyzed', () => { if (!E.state.advancedDone) { found = []; renderGallery(); } });

  btn.addEventListener('click', run);

  // ---- Mode automatique : préchargement en arrière-plan + analyse avancée incluse dans chaque audit
  const auto = $('#advAuto');
  try { auto.checked = localStorage.getItem('esc.advAuto') !== '0'; } catch { /* */ }
  auto.addEventListener('change', () => { try { localStorage.setItem('esc.advAuto', auto.checked ? '1' : '0'); } catch { /* */ } if (auto.checked) preload(); });
  const conn = navigator.connection || {};
  const okNetwork = () => !conn.saveData && !['slow-2g', '2g', '3g'].includes(conn.effectiveType) && conn.type !== 'cellular';
  let preloadDone = false;
  function preload() {
    if (preloadDone || !auto.checked) return;
    if (!okNetwork()) { msg.textContent = 'Réseau mobile détecté : le modèle avancé sera récupéré au premier audit (≈ 155 Mo, idéalement en wifi).'; return; }
    preloadDone = true;
    const go = () => getDetector().then(() => { if (!E.state.analyzed) msg.textContent = '✓ Modèle avancé prêt (en cache) : il sera inclus automatiquement dans chaque audit.'; })
      .catch((e) => { preloadDone = false; loading = null; msg.textContent = `Préchargement du modèle avancé impossible (${e.message || e}). Il sera retenté au prochain audit.`; });
    ('requestIdleCallback' in window) ? requestIdleCallback(go, { timeout: 8000 }) : setTimeout(go, 6000);
  }
  document.addEventListener('esc:analyzed', () => {
    btn.disabled = !E.getFrameBitmap();
    // analyse avancée automatique sur chaque nouvelle capture (pas sur l'inventaire cumulé, ni en boucle)
    if (auto.checked && E.state.analyzed && !E.state.advancedDone && !E.state.collectionMode && E.getFrameBitmap() && !btn.dataset.running) {
      btn.dataset.running = '1';
      run().finally(() => { delete btn.dataset.running; });
    }
  });
  // préchargement seulement quand l'utilisateur est dans l'Audit et que COCO-SSD est prêt (n'alourdit pas les autres pages)
  const tryPreload = () => { if (document.getElementById('view-audit').classList.contains('is-active') && E.state.modelState === 'ready') setTimeout(preload, 5000); };
  document.addEventListener('esc:view', (e) => { if (e.detail === 'audit') { const iv = setInterval(() => { if (E.state.modelState !== 'loading') { clearInterval(iv); tryPreload(); } }, 1000); } });
  if (location.hash === '#audit') document.dispatchEvent(new CustomEvent('esc:view', { detail: 'audit' }));
};

if (window.__ESC__) start(); else document.addEventListener('esc:ready', start, { once: true });
