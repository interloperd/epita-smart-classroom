/* EPITA Smart Classroom — Mode Scan : vidéo temps réel façon HUD, suivi d'objets et ambiance sonore.
 * Vision : COCO-SSD (équipements uniquement, classe « person » supprimée en amont).
 * Son : YAMNet (AudioSet, 521 classes) via MediaPipe Audio Classifier — catégories anonymes, aucun enregistrement.
 */
const MP_VERSION = '0.10.14';
const MP_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@${MP_VERSION}`;
const YAMNET_URL = 'https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite';

const PREFIX = { 'chair': 'CHR', 'dining table': 'TBL', 'laptop': 'LPT', 'tv': 'SCR', 'keyboard': 'KBD', 'mouse': 'MSE', 'book': 'BOK', 'clock': 'CLK', 'potted plant': 'PLT', 'cell phone': 'PHN', 'backpack': 'BAG', 'couch': 'SOF', 'bench': 'BNC', 'desk': 'DSK', 'whiteboard': 'WBD', 'window': 'WIN', 'door': 'DOR' };
const TYPE = { 'chair': 'CHAISE', 'dining table': 'TABLE / BUREAU', 'laptop': 'ORDINATEUR PORTABLE', 'tv': 'ÉCRAN', 'keyboard': 'CLAVIER', 'mouse': 'SOURIS', 'book': 'LIVRE', 'clock': 'HORLOGE', 'potted plant': 'PLANTE', 'cell phone': 'TÉLÉPHONE', 'backpack': 'SAC À DOS', 'couch': 'CANAPÉ', 'bench': 'BANC', 'desk': 'TABLE / BUREAU', 'whiteboard': 'TABLEAU', 'window': 'FENÊTRE', 'door': 'PORTE' };
// Catégories d'audit et classes qui les alimentent (COCO-SSD + analyse avancée OWL-ViT)
const GROUPS = [
  ['tables', 'Tables', ['dining table', 'desk']], ['chairs', 'Chaises', ['chair']], ['laptops', 'Portables', ['laptop']],
  ['screens', 'Écrans', ['tv']], ['board', 'Tableau', ['whiteboard']], ['windows', 'Fenêtres', ['window']], ['doors', 'Portes', ['door']],
];
const CONFIG_KEY = Object.fromEntries(GROUPS.flatMap(([k, label, classes]) => classes.map((c) => [c, [k, label]])));
const SOUND_FR = {
  'Speech': 'Voix humaine', 'Conversation': 'Conversation', 'Male speech, man speaking': 'Voix humaine', 'Female speech, woman speaking': 'Voix humaine',
  'Child speech, kid speaking': 'Voix humaine', 'Narration, monologue': 'Voix humaine', 'Laughter': 'Rires', 'Applause': 'Applaudissements',
  'Music': 'Musique', 'Silence': 'Silence', 'Vehicle': 'Véhicule', 'Car': 'Voiture', 'Traffic noise, roadway noise': 'Bruit de circulation',
  'Motor vehicle (road)': 'Véhicule', 'Vehicle horn, car horn, honking': 'Klaxon', 'Siren': 'Sirène', 'Emergency vehicle': 'Véhicule d\'urgence',
  'Bus': 'Bus', 'Truck': 'Camion', 'Motorcycle': 'Moto', 'Train': 'Train', 'Aircraft': 'Avion', 'Typing': 'Frappe au clavier',
  'Computer keyboard': 'Clavier d\'ordinateur', 'Door': 'Porte', 'Knock': 'On frappe', 'Footsteps': 'Pas', 'Walk, footsteps': 'Pas',
  'Mechanical fan': 'Ventilateur', 'Air conditioning': 'Climatisation', 'Inside, small room': 'Intérieur (petite pièce)',
  'Inside, large room or hall': 'Intérieur (grande salle)', 'Outside, urban or manmade': 'Extérieur urbain', 'Alarm': 'Alarme',
  'Fire alarm': 'Alarme incendie', 'Telephone': 'Téléphone', 'Ringtone': 'Sonnerie', 'Drill': 'Perceuse', 'Hammer': 'Marteau',
  'Power tool': 'Outil électrique', 'Wind': 'Vent', 'Rain': 'Pluie', 'Bird': 'Oiseau', 'Dog': 'Chien', 'Writing': 'Écriture',
  'Chewing, mastication': 'Mastication', 'Clapping': 'Claquements de mains', 'Cough': 'Toux', 'White noise': 'Bruit blanc',
  'Hum': 'Bourdonnement', 'Buzz': 'Bourdonnement', 'Static': 'Grésillement', 'Engine': 'Moteur', 'Tick': 'Tic-tac', 'Television': 'Télévision',
};
const ALERT_SOUNDS = new Set(['Siren', 'Alarm', 'Fire alarm', 'Vehicle horn, car horn, honking', 'Drill', 'Power tool', 'Hammer', 'Emergency vehicle',
  'Ambulance (siren)', 'Police car (siren)', 'Fire engine, fire truck (siren)', 'Civil defense siren', 'Smoke detector, smoke alarm', 'Jackhammer', 'Sawing',
  'Traffic noise, roadway noise', 'Truck', 'Motorcycle', 'Aircraft', 'Train', 'Music', 'Television', 'Telephone', 'Ringtone']);
/** Bruits perturbants → anomalie audio : gravité et action corrective (catégories anonymes, aucun enregistrement). */
const NOISE_RULES = [
  { re: /Fire alarm|Smoke detector/, sev: 'Critique', cat: 'Alarme incendie', action: 'Vérifier immédiatement l\'origine de l\'alarme et appliquer la procédure d\'évacuation.' },
  { re: /Siren|Emergency vehicle|Ambulance|Police car|Fire engine|Civil defense/, sev: 'Majeure', cat: 'Sirène (véhicule d\'urgence)', action: 'Bruit extérieur perturbant : fermer les fenêtres côté rue ; si récurrent, privilégier une salle côté cour.' },
  { re: /Alarm/, sev: 'Majeure', cat: 'Alarme', action: 'Identifier l\'alarme (réveil, équipement) et la couper ; signaler au service technique si elle persiste.' },
  { re: /Drill|Power tool|Hammer|Jackhammer|Sawing/, sev: 'Majeure', cat: 'Travaux', action: 'Signaler les travaux à la logistique et planifier les cours hors des créneaux bruyants.' },
  { re: /Traffic|Vehicle horn|Truck|Motorcycle|Aircraft|Train/, sev: 'Mineure', cat: 'Circulation', action: 'Fermer les fenêtres pendant le cours ; vérifier l\'isolation phonique de la salle.' },
  { re: /Music|Television|Telephone|Ringtone/, sev: 'Mineure', cat: 'Appareil sonore', action: 'Éteindre ou mettre en silencieux l\'appareil identifié avant le cours.' },
];

const start = () => {
  const E = window.__ESC__;
  const $ = (s) => document.querySelector(s);
  const stage = $('#stage'), video = $('#video'), hud = $('#hud'), ui = $('#hudUi');
  const ctx = hud.getContext('2d');
  const S = { on: false, tracks: [], counters: {}, busy: false, fps: 0, lastDet: 0, lastQ: 0, raf: 0, timer: 0, sweep: 0 };
  // Calques d'affichage du HUD (mémorisés par navigateur)
  const PRESETS = {
    min: { cards: false, adds: true, inv: false, feed: false, audio: false, info: false, fx: false },
    std: { cards: true, adds: true, inv: true, feed: false, audio: false, info: true, fx: true },
    all: { cards: true, adds: true, inv: true, feed: true, audio: true, info: true, fx: true },
  };
  let LAY = (() => { try { return { ...PRESETS.std, ...JSON.parse(localStorage.getItem('esc.hudLayers') || '{}') }; } catch { return { ...PRESETS.std }; } })();
  function applyLayers() {
    Object.keys(PRESETS.all).forEach((k) => ui.classList.toggle(`no-${k}`, !LAY[k]));
    stage.classList.toggle('no-fx', !LAY.fx);
    ui.querySelectorAll('[data-layer]').forEach((c) => { c.checked = !!LAY[c.dataset.layer]; });
    try { localStorage.setItem('esc.hudLayers', JSON.stringify(LAY)); } catch { /* */ }
  }
  const C = { items: [], pending: [], seq: 0 };
  // Sauvegarde automatique de l'inventaire dans le navigateur (survit au rechargement de la page)
  const INV_KEY = 'esc.inventory.v1';
  function saveInv() {
    const pack = (i) => ({ ...i, at: i.at && i.at.toISOString(), validatedAt: i.validatedAt && i.validatedAt.toISOString() });
    const data = { seq: C.seq, items: C.items.map(pack), pending: C.pending.map(pack) };
    try { localStorage.setItem(INV_KEY, JSON.stringify(data)); return true; }
    catch { // quota dépassé : on garde les données, sans les vignettes les plus anciennes
      try { data.items = data.items.map((i, k) => (k < data.items.length - 20 ? { ...i, thumb: '' } : i)); localStorage.setItem(INV_KEY, JSON.stringify(data)); return true; } catch { return false; }
    }
  }
  function loadInv() {
    try {
      const d = JSON.parse(localStorage.getItem(INV_KEY) || 'null'); if (!d) return;
      const un = (i) => ({ ...i, at: i.at ? new Date(i.at) : new Date(), validatedAt: i.validatedAt ? new Date(i.validatedAt) : null });
      C.seq = d.seq || 0; C.items = (d.items || []).map(un); C.pending = (d.pending || []).map(un);
    } catch { /* stockage indisponible */ }
  }
  const addBtns = new Map();
  const A = { on: false, stream: null, ac: null, analyser: null, proc: null, classifier: null, buf: [], bufLen: 0, top: [], level: 0, lastAlert: {}, events: {}, peak: 0 };

  // ---------------------------------------------------------- Fil d'alertes
  function feed(text, kind = '') {
    const el = $('#hudFeed');
    const line = document.createElement('div');
    line.className = `hud-msg ${kind}`;
    line.textContent = `${new Date().toLocaleTimeString('fr-FR')} · ${text}`;
    el.prepend(line);
    while (el.children.length > 5) el.lastChild.remove();
  }
  const throttle = {};
  const once = (key, ms, fn) => { const t = performance.now(); if (!throttle[key] || t - throttle[key] > ms) { throttle[key] = t; fn(); } };

  // ---------------------------------------------------------- Suivi d'objets (appariement IoU glouton)
  const iou = (a, b) => {
    const ix = Math.max(0, Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]));
    const iy = Math.max(0, Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]));
    const i = ix * iy; return i / (a[2] * a[3] + b[2] * b[3] - i || 1);
  };
  function updateTracks(preds, now) {
    const free = new Set(S.tracks);
    preds.sort((x, y) => y.score - x.score).forEach((p) => {
      let best = null, bestIoU = 0.2;
      free.forEach((t) => { if (t.cls === p.cls) { const v = iou(t.bbox, p.bbox); if (v > bestIoU) { bestIoU = v; best = t; } } });
      if (best) {
        free.delete(best); best.bbox = p.bbox; best.score = p.score; best.last = now; best.hits++;
      } else {
        S.counters[p.cls] = (S.counters[p.cls] || 0) + 1;
        const t = { id: `${PREFIX[p.cls] || 'OBJ'}-${String(S.counters[p.cls]).padStart(2, '0')}`, cls: p.cls, bbox: p.bbox, shown: [...p.bbox], score: p.score, first: now, last: now, hits: 1 };
        S.tracks.push(t);
        feed(`NOUVEL OBJET · ${t.id} · ${TYPE[p.cls] || p.cls.toUpperCase()}`);
      }
    });
    S.tracks = S.tracks.filter((t) => now - t.last < 1500);
  }

  // ---------------------------------------------------------- Boucle de détection
  async function detectLoop() {
    if (!S.on) return;
    if (video.videoWidth && !S.busy) {
      S.busy = true;
      const t0 = performance.now();
      try {
        const raw = await E.detect(video); // une seule inférence par cycle
        const preds = raw.filter((p) => p.score >= E.thr(p.cls));
        const now = performance.now();
        updateTracks(preds, now);
        const dt = now - (S.lastDet || now); S.lastDet = now;
        if (dt) S.fps = S.fps ? S.fps * 0.8 + (1000 / dt) * 0.2 : 1000 / dt;
        renderCounts();
        if (now - S.lastQ > 1500) { // qualité de prise de vue
          S.lastQ = now;
          const m = E.measureImage(video, video.videoWidth, video.videoHeight);
          if (m.mean < 55) once('dark', 6000, () => feed('ALERTE · IMAGE TROP SOMBRE → ALLUMEZ LA LUMIÈRE', 'warn'));
          else if (m.satRatio > 0.12 && m.center < m.mean * 0.9) once('back', 6000, () => feed('ALERTE · CONTRE-JOUR → PLACEZ-VOUS DOS AUX FENÊTRES', 'warn'));
          else if (m.sharp < 60) once('blur', 6000, () => feed('ALERTE · IMAGE FLOUE → STABILISEZ L\'APPAREIL', 'warn'));
          const weak = raw.filter((p) => p.score >= 0.25 && p.score < E.thr(p.cls)); // réutilise l'inférence du cycle
          if (weak.length) once('weak', 8000, () => feed(`${weak.length} OBJET(S) MAL RECONNU(S) → REDRESSEZ-LES OU RAPPROCHEZ-VOUS`, 'warn'));
        }
      } catch (e) { console.warn('[scan]', e); }
      S.busy = false;
      $('#hudFps').textContent = `${S.fps ? S.fps.toFixed(1) : '—'} IPS · ${Math.round(performance.now() - t0)} MS`;
    }
    S.timer = setTimeout(detectLoop, 120);
  }

  // ---------------------------------------------------------- Rendu HUD (60 ips, interpolation des cadres)
  let lastDraw = 0;
  function draw(ts = 0) {
    if (!S.on) return;
    if (ts - lastDraw < 32) { S.raf = requestAnimationFrame(draw); return; } // ~30 i/s suffisent pour le HUD
    lastDraw = ts;
    if (video.videoWidth && (hud.width !== video.videoWidth || hud.height !== video.videoHeight)) { hud.width = video.videoWidth; hud.height = video.videoHeight; }
    const W = hud.width, H = hud.height, s = Math.max(1, W / 960), now = performance.now();
    ctx.clearRect(0, 0, W, H);
    if (LAY.fx) {
    // balayage
    S.sweep = (S.sweep + 2.2 * s) % H;
    const g = ctx.createLinearGradient(0, S.sweep - 60 * s, 0, S.sweep);
    g.addColorStop(0, 'rgba(183,148,224,0)'); g.addColorStop(1, 'rgba(183,148,224,.22)');
    ctx.fillStyle = g; ctx.fillRect(0, S.sweep - 60 * s, W, 60 * s);
    // grille de visée centrale
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, 18 * s, 0, Math.PI * 2); ctx.moveTo(W / 2 - 30 * s, H / 2); ctx.lineTo(W / 2 - 10 * s, H / 2); ctx.moveTo(W / 2 + 10 * s, H / 2); ctx.lineTo(W / 2 + 30 * s, H / 2); ctx.stroke();
    }

    S.tracks.forEach((t) => {
      for (let i = 0; i < 4; i++) t.shown[i] += (t.bbox[i] - t.shown[i]) * 0.25;
      const [x, y, w, h] = t.shown;
      const stale = now - t.last > 400, fresh = t.hits < 2;
      const alpha = stale ? 0.35 : fresh ? 0.6 : 1;
      const L = Math.min(w, h) * 0.22;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = t.collected === 'pending' ? '#FFE9A8' : t.collected ? '#B794E0' : '#FFFFFF'; ctx.lineWidth = 2.6 * s;
      ctx.beginPath();
      [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, dx, dy]) => {
        ctx.moveTo(cx + dx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * L);
      });
      ctx.stroke();
      // étiquette
      ctx.font = `600 ${12 * s}px Montserrat, sans-serif`;
      const tag = `${t.collected === 'pending' ? '⏳ ' : t.collected ? '✓ ' : ''}${t.id} ▸ ${TYPE[t.cls] || t.cls.toUpperCase()}${t.collected === 'pending' ? ' · À VALIDER' : t.collected ? ` · INVENTAIRE #${t.collected}` : ''}`;
      const tw = ctx.measureText(tag).width + 14 * s, th = 20 * s, ty = Math.max(0, y - th - 4 * s);
      ctx.fillStyle = 'rgba(91,45,142,.92)'; ctx.fillRect(x, ty, tw, th);
      ctx.fillStyle = '#fff'; ctx.fillText(tag, x + 7 * s, ty + 14 * s);
      // fiche de données (calque « Fiches »)
      if (!LAY.cards) { ctx.globalAlpha = 1; return; }
      const key = CONFIG_KEY[t.cls];
      const expected = key ? E.state.config[key[0]] : null;
      const got = C.items.filter((o) => o.cls === t.cls).length;
      const lines = [`CONFIANCE  ${Math.round(t.score * 100)} %`, `SUIVI      ${((now - t.first) / 1000).toFixed(1)} s`,
        key ? `INVENTAIRE ${got}/${expected ?? '—'} ${key[1].toUpperCase()}` : 'HORS RÉFÉRENTIEL'];
      ctx.font = `500 ${10.5 * s}px ui-monospace, Menlo, monospace`;
      const cw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16 * s, ch = lines.length * 15 * s + 10 * s;
      let cx = x + w + 12 * s; if (cx + cw > W) cx = Math.max(0, x - cw - 12 * s);
      const cy = Math.min(H - ch, Math.max(0, y));
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1 * s;
      ctx.beginPath(); ctx.moveTo(cx > x ? x + w : x, y + 6 * s); ctx.lineTo(cx > x ? cx : cx + cw, cy + 8 * s); ctx.stroke();
      ctx.fillStyle = 'rgba(20,10,34,.78)'; ctx.fillRect(cx, cy, cw, ch);
      ctx.fillStyle = '#B794E0'; ctx.fillRect(cx, cy, 2.5 * s, ch);
      ctx.fillStyle = '#F2ECF9';
      lines.forEach((l, i) => ctx.fillText(l, cx + 9 * s, cy + 16 * s + i * 15 * s));
      ctx.globalAlpha = 1;
    });
    positionAdds(now);
    drawSpectrum();
    S.raf = requestAnimationFrame(draw);
  }

  function renderCounts() {
    const now = performance.now();
    const live = S.tracks.filter((t) => now - t.last < 600);
    const rows = GROUPS.filter(([k, , classes]) => classes.some((c) => !['desk', 'whiteboard', 'window', 'door'].includes(c)) || C.items.some((t) => classes.includes(t.cls))).map(([k, label, classes]) => {
      const n = C.items.filter((t) => classes.includes(t.cls)).length, v = live.filter((t) => classes.includes(t.cls)).length, exp = E.state.config[k];
      const pctv = exp ? Math.min(100, (n / exp) * 100) : n ? 100 : 0;
      return `<div class="hud-row"><span>${label.toUpperCase()} <i>· vu ${v}</i></span><b>${n}${exp !== null && exp !== undefined ? `<i>/${exp}</i>` : ''}</b><div class="hud-bar"><span style="width:${pctv}%"></span></div></div>`;
    });
    const others = live.filter((t) => !CONFIG_KEY[t.cls]).length;
    $('#hudCounts').innerHTML = `<div class="hud-title">INVENTAIRE · ${C.items.length} OBJET(S)${C.pending.length ? ` · ${C.pending.length} À VALIDER` : ''}</div>${rows.join('')}<div class="hud-row"><span>AUTRES</span><b>${C.items.filter((t) => !CONFIG_KEY[t.cls]).length}<i> · vu ${others}</i></b></div><div class="hud-row muted"><span>VIA ANALYSE AVANCÉE</span><b>TABLEAU · FENÊTRES · PORTES</b></div>`;
  }

  // ---------------------------------------------------------- Audio : niveau, spectre, classification YAMNet
  const specCanvas = $('#hudSpectrum'), sctx = specCanvas.getContext('2d');
  const freq = new Uint8Array(512), wave = new Float32Array(1024);
  function drawSpectrum() {
    sctx.clearRect(0, 0, specCanvas.width, specCanvas.height);
    if (!A.on || !A.analyser) return;
    A.analyser.getByteFrequencyData(freq);
    A.analyser.getFloatTimeDomainData(wave);
    const bars = 48, bw = specCanvas.width / bars;
    for (let i = 0; i < bars; i++) {
      const v = freq[Math.floor((i / bars) ** 1.6 * 300)] / 255;
      sctx.fillStyle = `rgba(${183 + 72 * v | 0},${148 + 107 * v | 0},255,${0.35 + v * 0.65})`;
      sctx.fillRect(i * bw + 1, specCanvas.height * (1 - v), bw - 2, specCanvas.height * v);
    }
    let sum = 0; for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
    const db = 20 * Math.log10(Math.sqrt(sum / wave.length) + 1e-8);
    const level = Math.round(Math.min(100, Math.max(0, ((db + 70) / 60) * 100)));
    A.level = A.level ? A.level * 0.9 + level * 0.1 : level;
    $('#hudLevelBar').style.width = `${A.level}%`;
    const label = A.level < 30 ? 'calme' : A.level < 60 ? 'modéré' : 'bruyant';
    A.peak = Math.max(A.peak, A.level);
    E.state.ambient = { level: Math.round(A.level), peak: Math.round(A.peak), label, top: A.top, events: Object.values(A.events) };
  }

  async function loadClassifier() {
    if (A.classifier) return A.classifier;
    const { AudioClassifier, FilesetResolver } = await import(`${MP_URL}/audio_bundle.mjs`);
    const files = await FilesetResolver.forAudioTasks(`${MP_URL}/wasm`);
    A.classifier = await AudioClassifier.createFromOptions(files, { baseOptions: { modelAssetPath: YAMNET_URL }, maxResults: 5, scoreThreshold: 0.1 });
    return A.classifier;
  }

  async function micOn() {
    const btn = $('#hudMic');
    try {
      btn.disabled = true; btn.textContent = '… Micro';
      A.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      A.ac = new (window.AudioContext || window.webkitAudioContext)();
      const src = A.ac.createMediaStreamSource(A.stream);
      A.analyser = A.ac.createAnalyser(); A.analyser.fftSize = 1024; A.analyser.smoothingTimeConstant = 0.7;
      src.connect(A.analyser);
      A.on = true; A.events = {}; A.peak = 0; btn.textContent = '🎙 Couper le micro'; btn.disabled = false;
      $('#hudSounds').textContent = 'Chargement du modèle sonore YAMNet…';
      feed('MICRO ACTIF · ANALYSE ANONYME DES SONS (AUCUN ENREGISTREMENT)');
      try {
        await loadClassifier();
        A.proc = A.ac.createScriptProcessor(16384, 1, 1);
        const mute = A.ac.createGain(); mute.gain.value = 0;
        src.connect(A.proc); A.proc.connect(mute); mute.connect(A.ac.destination);
        A.proc.onaudioprocess = (ev) => {
          if (!A.on) return;
          const data = new Float32Array(ev.inputBuffer.getChannelData(0)); // copie éphémère, jamais stockée
          A.buf.push(data); A.bufLen += data.length;
          if (A.bufLen < A.ac.sampleRate) return; // ~1 s d'audio
          const chunk = new Float32Array(A.bufLen); let o = 0; A.buf.forEach((b) => { chunk.set(b, o); o += b.length; });
          A.buf = []; A.bufLen = 0;
          const res = A.classifier.classify(chunk, A.ac.sampleRate);
          const cats = (res[0] && res[0].classifications[0] && res[0].classifications[0].categories) || [];
          const merged = new Map();
          cats.forEach((c) => { const n = SOUND_FR[c.categoryName] || c.categoryName; merged.set(n, Math.max(merged.get(n) || 0, c.score)); });
          A.top = [...merged.entries()].map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score).slice(0, 3);
          $('#hudSounds').innerHTML = A.top.length ? A.top.map((t) => `<span>${t.name} <b>${Math.round(t.score * 100)} %</b></span>`).join('') : 'Aucun son caractéristique';
          // journal des bruits perturbants de la session (catégorie, nombre d'occurrences, score max)
          cats.filter((c) => ALERT_SOUNDS.has(c.categoryName) && c.score > 0.3).forEach((c) => {
            const rule = NOISE_RULES.find((r) => r.re.test(c.categoryName)); if (!rule) return;
            const ev = A.events[rule.cat] || (A.events[rule.cat] = { cat: rule.cat, sev: rule.sev, action: rule.action, count: 0, max: 0, first: new Date().toISOString() });
            ev.count++; ev.max = Math.max(ev.max, c.score); ev.last = new Date().toISOString();
          });
          cats.filter((c) => ALERT_SOUNDS.has(c.categoryName) && c.score > 0.3).forEach((c) => once(`snd-${c.categoryName}`, 10000, () => feed(`SON DÉTECTÉ · ${(SOUND_FR[c.categoryName] || c.categoryName).toUpperCase()}`, 'warn')));
          if (A.level > 65) once('loud', 15000, () => feed('AMBIANCE BRUYANTE · NIVEAU SONORE ÉLEVÉ', 'warn'));
        };
      } catch (e) {
        console.warn('[audio]', e);
        $('#hudSounds').textContent = 'Classification sonore indisponible (modèle non chargé) · niveau sonore actif';
      }
    } catch (e) {
      console.warn('[micro]', e);
      btn.disabled = false; btn.textContent = '🎙 Activer le micro';
      $('#hudSounds').textContent = e.name === 'NotAllowedError' ? 'Accès au micro refusé.' : 'Micro indisponible sur cet appareil.';
    }
  }
  function micOff() {
    A.on = false;
    if (A.proc) { A.proc.disconnect(); A.proc.onaudioprocess = null; A.proc = null; }
    if (A.stream) A.stream.getTracks().forEach((t) => t.stop());
    if (A.ac) A.ac.close();
    A.stream = A.ac = A.analyser = null; A.buf = []; A.bufLen = 0;
    $('#hudMic').textContent = '🎙 Activer le micro'; $('#hudSounds').textContent = 'Micro inactif';
    $('#hudLevelBar').style.width = '0%';
  }


  // ---------------------------------------------------------- Collection : Ajouter → À valider → Inventaire
  // Chaque objet est validé une seule fois par l'utilisateur : pas de double comptage d'une image à l'autre.
  function stageMap() {
    const sw = stage.clientWidth, sh = stage.clientHeight, vw = video.videoWidth || 1, vh = video.videoHeight || 1;
    const k = Math.min(sw / vw, sh / vh);
    return { k, ox: (sw - vw * k) / 2, oy: (sh - vh * k) / 2 };
  }
  function positionAdds(now) {
    const box = $('#hudAdds'); const m = stageMap(); const keep = new Set();
    S.tracks.filter((t) => t.hits >= 2 && now - t.last < 600).forEach((t) => {
      keep.add(t.id);
      let b = addBtns.get(t.id);
      if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'hud-add'; b.addEventListener('click', () => addTrack(t)); box.appendChild(b); addBtns.set(t.id, b); }
      const [x, y, w, h] = t.shown;
      const L = m.ox + x * m.k, T = Math.min(stage.clientHeight - 30, m.oy + (y + h) * m.k);
      // hystérésis : le bouton ne bouge que si l'objet s'est vraiment déplacé (plus facile à cliquer)
      if (b._l === undefined || Math.abs(b._l - L) > 14 || Math.abs(b._t - T) > 14) { b._l = L; b._t = T; b.style.left = `${L}px`; b.style.top = `${T}px`; }
      const txt = t.collected === 'pending' ? `⏳ ${t.id} à valider` : t.collected ? `✓ ${t.id} inventorié` : `＋ Ajouter ${(TYPE[t.cls] || t.cls).toLowerCase()}`;
      if (b.textContent !== txt) { b.textContent = txt; b.classList.toggle('done', !!t.collected); b.disabled = !!t.collected; }
    });
    addBtns.forEach((b, id) => { if (!keep.has(id)) { b.remove(); addBtns.delete(id); } });
  }
  function crop(t) {
    const out = { thumb: '', lum: null };
    try {
      const [x, y, w, h] = t.bbox, c = document.createElement('canvas'); c.width = 192; c.height = 192;
      const side = Math.max(w, h) * 1.1, cx = x + w / 2 - side / 2, cy = y + h / 2 - side / 2;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.fillStyle = '#2A1342'; g.fillRect(0, 0, 192, 192);
      g.drawImage(video, cx, cy, side, side, 0, 0, 192, 192);
      const d = g.getImageData(48, 48, 96, 96).data; let L = 0;
      for (let i = 0; i < d.length; i += 4) L += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      out.lum = Math.round((L / (d.length / 4)) / 2.55);
      out.thumb = c.toDataURL('image/jpeg', 0.75); // vignette en mémoire ; archivée seulement avec l'audit si l'utilisateur le choisit
    } catch { /* vidéo indisponible */ }
    return out;
  }
  function addTrack(t) {
    if (t.collected) return;
    C.seq++;
    const now = performance.now(), cr = crop(t), k = CONFIG_KEY[t.cls];
    C.pending.push({
      key: `c${C.seq}`, trackId: t.id, cls: t.cls, type: TYPE[t.cls] || t.cls, score: t.score, threshold: E.thr(t.cls),
      model: E.state.modelBase, at: new Date(), trackedS: (now - t.first) / 1000, hits: t.hits,
      bbox: t.bbox.map(Math.round), frame: [video.videoWidth, video.videoHeight], lum: cr.lum, thumb: cr.thumb,
      category: k ? k[1] : 'Hors référentiel', selected: true,
    });
    t.collected = 'pending';
    feed(`AJOUTÉ · ${t.id} → À VALIDER (${C.pending.length})`);
    renderCollection();
  }
  function trackOf(it) { return S.tracks.find((x) => x.id === it.trackId); }
  function validate() {
    const keep = C.pending.filter((i) => i.selected), drop = C.pending.filter((i) => !i.selected);
    keep.forEach((i) => {
      i.validatedAt = new Date(); C.items.push(i);
      i.rank = C.items.filter((o) => o.cls === i.cls).length;
      const t = trackOf(i); if (t) t.collected = i.rank;
    });
    drop.forEach((i) => { const t = trackOf(i); if (t) t.collected = 0; });
    C.pending = [];
    if (keep.length) feed(`${keep.length} OBJET(S) VALIDÉ(S) → INVENTAIRE (${C.items.length})${drop.length ? ` · ${drop.length} ÉCARTÉ(S)` : ''}`);
    renderCounts(); renderCollection(); renderInventory(); syncAudit();
  }
  const pctS = (v) => `${Math.round(v * 100)} %`;
  function renderCollection() {
    const card = $('#collectionCard');
    card.hidden = !C.pending.length && !C.items.length && !S.on;
    const nSel = C.pending.filter((i) => i.selected).length;
    $('#collTotal').textContent = C.pending.length ? `· ${nSel}/${C.pending.length} sélectionné(s)` : '';
    $('#collValidate').disabled = !C.pending.length;
    $('#collValidate').textContent = C.pending.length ? `✓ Valider la sélection (${nSel})` : '✓ Valider la sélection';
    $('#collToggle').disabled = !C.pending.length;
    $('#collToggle').textContent = nSel === C.pending.length ? 'Tout désélectionner' : 'Tout sélectionner';
    $('#collSum').innerHTML = `<span>Inventaire : <b>${C.items.length}</b> objet(s)</span>` + GROUPS.map(([k, label, classes]) => {
      const n = C.items.filter((i) => classes.includes(i.cls)).length, exp = E.state.config[k];
      if (!n && (exp === null || exp === undefined)) return '';
      return `<span>${label} <b>${n}</b>${exp !== null && exp !== undefined ? ` / ${exp}` : ''}</span>`;
    }).join('') + `<button class="btn btn-ghost btn-sm" type="button" data-view="inventaire">Voir l'inventaire →</button>`;
    $('#collGrid').innerHTML = C.pending.map((i) => `<label class="coll-item${i.selected ? ' on' : ''}">
        <input type="checkbox" data-key="${i.key}" ${i.selected ? 'checked' : ''} aria-label="Sélectionner ${i.trackId}">
        ${i.thumb ? `<img src="${i.thumb}" alt="">` : '<img alt="">'}
        <div><b>${i.trackId}</b><span>${i.type.toLowerCase()} · ${pctS(i.score)}</span></div></label>`).join('')
      || '<p class="muted small">Aucun objet en attente. En mode Scan, cliquez sur « ＋ Ajouter » sur un objet détecté.</p>';
    const cap = $('#hudCapture');
    cap.textContent = C.pending.length ? `⏳ ${C.pending.length} objet(s) à valider` : C.items.length ? `✓ Auditer l'inventaire (${C.items.length})` : '📸 Capturer & auditer';
    const nav = $('#navInvCount'); nav.hidden = !C.items.length; nav.textContent = C.items.length;
    $('#invAudit').disabled = !C.items.length; $('#invClear').disabled = !C.items.length;
    const ok = saveInv();
    const msgSaved = !C.items.length && !C.pending.length ? '' : ok ? `✓ Sauvegardé automatiquement dans ce navigateur (${C.items.length} objet(s) en inventaire, ${C.pending.length} à valider)` : '⚠ Sauvegarde locale impossible (navigation privée ?)';
    ['#invSaved', '#collSaved'].forEach((q) => { const el = $(q); if (el) el.textContent = msgSaved; });
  }
  $('#collGrid').addEventListener('change', (e) => {
    const k = e.target.dataset.key; const it = C.pending.find((i) => i.key === k); if (!it) return;
    it.selected = e.target.checked; renderCollection();
  });
  $('#collToggle').addEventListener('click', () => {
    const all = C.pending.every((i) => i.selected); C.pending.forEach((i) => { i.selected = !all; }); renderCollection();
  });
  $('#collValidate').addEventListener('click', validate);

  // ---------------------------------------------------------- Onglet Inventaire : une fiche par objet
  function fmtDT(d) { return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  function renderInventory() {
    const g = $('#invGrid'); if (!g) return;
    const rows = GROUPS.map(([k, label, classes]) => {
      const n = C.items.filter((i) => classes.includes(i.cls)).length, exp = E.state.config[k];
      if (!n && (exp === null || exp === undefined)) return '';
      return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${n}${exp !== null && exp !== undefined ? `<span class="kpi-of">/${exp}</span>` : ''}</div><div class="kpi-sub">${exp ? `${Math.round(Math.min(1, n / exp) * 100)} % de l'attendu` : 'non contrôlé'}</div></div>`;
    });
    $('#invKpis').innerHTML = rows.join('');
    $('#invSync').textContent = E.state.collectionMode ? '● Audit lié à l\'inventaire : il se met à jour automatiquement à chaque ajout ou retrait.' : 'Cliquez sur « Auditer l\'inventaire » pour lier l\'audit à cet inventaire (mise à jour automatique ensuite).';
    g.innerHTML = C.items.map((i) => {
      const exp = CONFIG_KEY[i.cls] ? E.state.config[CONFIG_KEY[i.cls][0]] : null;
      return `<article class="fiche">
        <div class="fiche-img">${i.thumb ? `<img src="${i.thumb}" alt="Vignette ${i.trackId}">` : ''}<span class="fiche-id">${i.trackId}</span></div>
        <div class="fiche-body">
          <h3>${i.type.charAt(0) + i.type.slice(1).toLowerCase()} <span class="muted small">n° ${i.rank}${exp ? ` / ${exp}` : ''}</span></h3>
          <dl>
            <dt>Classe COCO</dt><dd class="code">${i.cls}</dd>
            <dt>Catégorie d'audit</dt><dd>${i.category}</dd>
            <dt>Confiance</dt><dd><b>${pctS(i.score)}</b><span class="meter"><span style="width:${i.score * 100}%"></span></span></dd>
            <dt>Seuil appliqué</dt><dd>${pctS(i.threshold)} ${i.score >= i.threshold ? '· au-dessus ✓' : ''}</dd>
            <dt>Marge</dt><dd>+${Math.round((i.score - i.threshold) * 100)} pts</dd>
            <dt>Suivi avant ajout</dt><dd>${i.trackedS.toFixed(1)} s · ${i.hits} détection(s)</dd>
            <dt>Position (px)</dt><dd class="code">x ${i.bbox[0]} · y ${i.bbox[1]} · ${i.bbox[2]}×${i.bbox[3]}</dd>
            <dt>Part de l'image</dt><dd>${((i.bbox[2] * i.bbox[3]) / (i.frame[0] * i.frame[1]) * 100).toFixed(1)} % (${i.frame[0]}×${i.frame[1]})</dd>
            <dt>Luminosité locale</dt><dd>${i.lum ?? '—'} %${i.lum !== null && i.lum < 22 ? ' · sombre' : ''}</dd>
            <dt>Modèle</dt><dd class="code">COCO-SSD · ${i.model}</dd>
            <dt>Ajouté / validé</dt><dd>${fmtDT(i.at)} · ${i.validatedAt ? fmtDT(i.validatedAt) : '—'}</dd>
          </dl>
          <button class="btn btn-ghost btn-sm" type="button" data-remove="${i.key}">Retirer de l'inventaire</button>
        </div></article>`;
    }).join('') || '<p class="muted">Inventaire vide. Lancez le mode Scan (onglet Audit), ajoutez des objets puis validez-les.</p>';
  }
  $('#invGrid').addEventListener('click', (e) => {
    const k = e.target.dataset && e.target.dataset.remove; if (!k) return;
    const it = C.items.find((i) => i.key === k); C.items = C.items.filter((i) => i.key !== k);
    const t = it && trackOf(it); if (t) t.collected = 0;
    // renumérote les rangs par catégorie
    const seen = {}; C.items.forEach((i) => { seen[i.cls] = (seen[i.cls] || 0) + 1; i.rank = seen[i.cls]; });
    renderCounts(); renderCollection(); renderInventory(); syncAudit();
  });
  $('#invClear').addEventListener('click', () => {
    if (!confirm('Vider l\'inventaire ?')) return;
    C.items = []; S.tracks.forEach((t) => { if (t.collected !== 'pending') t.collected = 0; });
    renderCounts(); renderCollection(); renderInventory(); syncAudit();
  });
  /** Inventaire ↔ audit : si l'audit en cours porte sur l'inventaire, il est recalculé à chaque modification. */
  function syncAudit() {
    if (E.state.collectionMode) E.refreshCollection(C.items);
  }
  async function auditCollection() {
    if (!C.items.length) return;
    const snapshot = E.state.ambient ? { ...E.state.ambient, top: [...E.state.ambient.top], events: [...(E.state.ambient.events || [])] } : null;
    if (S.on) exit(true);
    E.state.ambient = snapshot;
    E.show('audit');
    await E.analyzeCollection(C.items);
    renderCollection();
  }
  $('#invAudit').addEventListener('click', auditCollection);
  document.addEventListener('esc:view', (e) => { if (e.detail === 'inventaire') renderInventory(); });
  $('#hudAddAll').addEventListener('click', () => {
    const now = performance.now();
    const list = S.tracks.filter((t) => !t.collected && t.hits >= 2 && now - t.last < 600);
    if (!list.length) feed('AUCUN NOUVEL OBJET VISIBLE À AJOUTER');
    list.forEach(addTrack);
  });

  // ---------------------------------------------------------- Entrée / sortie du mode Scan
  async function enter() {
    if (!E.state.model) return;
    if (!E.state.stream) await E.startCamera();
    if (!E.state.stream) return;
    stage.classList.remove('frozen'); $('#btnBack').hidden = true;
    S.on = true; S.tracks = []; S.fps = 0; S.lastDet = 0;
    // reprend la numérotation après les objets déjà inventoriés (pas de doublon d'identifiant)
    S.counters = {};
    [...C.items, ...C.pending].forEach((i) => { const n = parseInt(String(i.trackId).split('-')[1], 10) || 0; S.counters[i.cls] = Math.max(S.counters[i.cls] || 0, n); });
    stage.classList.add('scan'); ui.hidden = false;
    stage.closest('.audit-layout').classList.add('scanning');
    $('#hudFeed').innerHTML = '';
    feed('SCAN DÉMARRÉ · PÉRIMÈTRE : MOBILIER ET ÉQUIPEMENTS');
    feed('PROTOCOLE VIE PRIVÉE · PERSONNES EXCLUES DE L\'ANALYSE');
    renderCounts(); renderCollection(); detectLoop(); draw();
    stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function exit(keepAmbient = false) {
    S.on = false; clearTimeout(S.timer); cancelAnimationFrame(S.raf);
    ctx.clearRect(0, 0, hud.width, hud.height);
    addBtns.forEach((b) => b.remove()); addBtns.clear();
    stage.classList.remove('scan'); ui.hidden = true;
    stage.closest('.audit-layout').classList.remove('scanning');
    if (!keepAmbient) E.state.ambient = null;
    if (A.on) micOff();
    renderCollection();
  }

  $('#hudLayersBtn').addEventListener('click', () => {
    const p = $('#hudLayers'); p.hidden = !p.hidden; $('#hudLayersBtn').setAttribute('aria-expanded', String(!p.hidden));
  });
  $('#hudLayers').addEventListener('change', (e) => { const k = e.target.dataset.layer; if (k) { LAY[k] = e.target.checked; applyLayers(); if (k === 'audio' && !LAY.audio && A.on) micOff(); } });
  $('#hudLayers').addEventListener('click', (e) => { const p = e.target.dataset.preset; if (p) { LAY = { ...PRESETS[p] }; applyLayers(); if (!LAY.audio && A.on) micOff(); } });
  applyLayers();
  $('#btnScan').addEventListener('click', () => (S.on ? exit() : enter()));
  $('#hudExit').addEventListener('click', () => exit());
  $('#hudMic').addEventListener('click', () => (A.on ? micOff() : micOn()));
  $('#hudFull').addEventListener('click', () => {
    const F = window.__ESC_FULL__; if (!F) return;
    if (F.isFull()) F.exitFull(); else F.enterFull();
  });
  $('#hudCapture').addEventListener('click', async () => {
    if (C.pending.length) { $('#collectionCard').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (C.items.length) return auditCollection();
    const snapshot = E.state.ambient ? { ...E.state.ambient, top: [...E.state.ambient.top], events: [...(E.state.ambient.events || [])] } : null;
    exit(true);
    E.state.ambient = snapshot;
    await E.analyzeFromVideo();
  });
  document.getElementById('btnStop').addEventListener('click', () => { if (S.on) exit(); });
  loadInv(); renderCollection(); renderInventory();
  if (location.hash === '#inventaire') renderInventory();
  /** Ajout d'objets venus de l'analyse avancée (image fixe) dans l'étape « À valider ». */
  function addExternal(list) {
    const counters = {};
    [...C.items, ...C.pending].forEach((i) => { const n = parseInt(String(i.trackId).split('-')[1], 10) || 0; counters[i.cls] = Math.max(counters[i.cls] || 0, n); });
    list.forEach((o) => {
      counters[o.cls] = (counters[o.cls] || 0) + 1; C.seq++;
      const k = CONFIG_KEY[o.cls];
      C.pending.push({
        key: `c${C.seq}`, trackId: `${PREFIX[o.cls] || 'OBJ'}-${String(counters[o.cls]).padStart(2, '0')}`, cls: o.cls, type: TYPE[o.cls] || o.cls.toUpperCase(),
        score: o.score, threshold: E.thr(o.cls), model: 'OWL-ViT (zéro-shot)', at: new Date(), trackedS: 0, hits: 1,
        bbox: o.bbox.map(Math.round), frame: o.frame, lum: o.lum ?? null, thumb: o.thumb, category: k ? k[1] : 'Hors référentiel', selected: true,
      });
    });
    renderCollection();
    $('#collectionCard').hidden = false;
  }
  window.__ESC_SCAN__ = { S, A, C, enter, exit, addTrack, addExternal };
};

if (window.__ESC__) start(); else document.addEventListener('esc:ready', start, { once: true });
