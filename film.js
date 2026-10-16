/* EPITA Smart Classroom — film de présentation (motion design temps réel).
 * Téléphone 3D (Three.js) + écrans d'application dessinés en direct + narration persuasive en 10 chapitres.
 * Structure : accroche → problème → agitation → solution (modules) → preuve d'autorité → confiance → appel à l'action.
 * Export vidéo : enregistrement du canvas (MediaRecorder, WebM), sans serveur.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const W = 1920, H = 1080;
const V = '#5B2D8E', V9 = '#2A1342', V2 = '#D6C6E7', V1 = '#ECE4F4', LIL = '#B794E0';
const F = 'Montserrat, system-ui, sans-serif';

// ---------------------------------------------------------------- Scénario (durées en secondes)
const SCENES = [
  { id: 'hook', d: 6.5, chip: 'Accroche', eyebrow: 'EPITA SMART CLASSROOM', title: ['Une salle vérifiée', 'en une prise de vue.'], sub: 'Sans tableur. Sans tournée. Sans filmer personne.', phone: { ry: 0, rx: 0.05, spin: true } },
  { id: 'problem', d: 7, chip: 'Le problème', eyebrow: 'LE PROBLÈME', title: ['Combien de chaises', 'manquent en B12 ?'], sub: 'Aujourd\'hui : un comptage à la main, des oublis, et aucune trace.', points: ['Lent', 'Approximatif', 'Invérifiable'], phone: { ry: -0.35, rx: 0.08 } },
  { id: 'scan', d: 8.5, chip: 'Scan temps réel', eyebrow: 'MODULE 1 · SCAN VIDÉO', title: ['Pointez.', 'L\'IA compte.'], sub: 'Chaque objet est repéré, identifié et suivi en temps réel, directement sur l\'appareil.', points: ['COCO-SSD en direct', 'Identifiants stables', 'Alertes lumière & flou'], phone: { ry: 0.32, rx: 0.06 } },
  { id: 'validate', d: 7, chip: 'Validation', eyebrow: 'MODULE 2 · VALIDATION', title: ['Vous gardez', 'la main.'], sub: 'Ajoutez, cochez, validez : chaque objet n\'est compté qu\'une seule fois.', points: ['Zéro double comptage', 'Décision humaine', 'Vignettes à l\'appui'], phone: { ry: -0.28, rx: 0.05 } },
  { id: 'inventory', d: 6.5, chip: 'Inventaire', eyebrow: 'MODULE 3 · INVENTAIRE', title: ['Une fiche', 'par objet.'], sub: 'Image, confiance, seuil, position, luminosité : tout est traçable.', phone: { ry: 0.26, rx: 0.04 } },
  { id: 'advanced', d: 8, chip: 'Analyse avancée', eyebrow: 'MODULE 4 · ANALYSE AVANCÉE', title: ['Là où les autres', 's\'arrêtent.'], sub: 'Un second modèle, OWL-ViT de Google, reconnaît tableaux, fenêtres et portes sur simple description.', points: ['Deux modèles combinés', 'Fusion sans doublon', 'Open-vocabulary'], phone: { ry: -0.3, rx: 0.06 } },
  { id: 'audit', d: 7.5, chip: 'Audit', eyebrow: 'MODULE 5 · AUDIT & RAPPORT', title: ['Un verdict,', 'pas un tableur.'], sub: 'Attendu, détecté, écart, statut — et un rapport PDF prêt à partager.', points: ['Tolérance réglable', 'Qualité de prise de vue', 'Export PDF'], phone: { ry: 0.3, rx: 0.05 } },
  { id: 'anomalies', d: 7, chip: 'Anomalies', eyebrow: 'MODULE 6 · PILOTAGE', title: ['De l\'alerte', 'à l\'action.'], sub: 'Chaque écart devient une action suivie jusqu\'à sa résolution, archivée dans Cloudflare.', points: ['Gravité', 'Statut', 'Taux de résolution'], phone: { ry: -0.26, rx: 0.05 } },
  { id: 'trust', d: 7, chip: 'Confiance', eyebrow: 'CONFIANCE PAR CONCEPTION', title: ['Puissante.', 'Et respectueuse.'], sub: 'L\'IA tourne sur l\'appareil. Les personnes ne sont jamais analysées. Rien n\'est envoyé sans votre accord.', points: ['IA locale', 'Personnes exclues', 'Droit à l\'effacement'], phone: { ry: 0.22, rx: 0.05 } },
  { id: 'cta', d: 7, chip: 'Passer à l\'action', eyebrow: 'À VOUS DE JOUER', title: ['Votre prochaine salle', 'commence ici.'], sub: 'epita-smart-classroom.pages.dev', phone: { ry: 0, rx: 0.03, spin: true }, cta: true },
];
const STARTS = []; let TOTAL = 0; SCENES.forEach((s) => { STARTS.push(TOTAL); TOTAL += s.d; });

// ---------------------------------------------------------------- Utilitaires 2D
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
function pill(g, x, y, text, { bg = V, fg = '#fff', size = 22, pad = 18, stroke = null } = {}) {
  g.font = `600 ${size}px ${F}`; const w = g.measureText(text).width + pad * 2, h = size * 1.9;
  rr(g, x, y, w, h, h / 2); if (bg) { g.fillStyle = bg; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); }
  g.fillStyle = fg; g.textBaseline = 'middle'; g.fillText(text, x + pad, y + h / 2 + 1); g.textBaseline = 'alphabetic';
  return w;
}

// ---------------------------------------------------------------- Écran du téléphone (UI dessinée en direct)
const SW = 600, SH = 1280;
const scr = document.createElement('canvas'); scr.width = SW; scr.height = SH;
const sg = scr.getContext('2d');

function statusBar(g, dark = false) {
  g.fillStyle = dark ? '#fff' : V9; g.font = `600 26px ${F}`; g.fillText('9:41', 46, 62);
  g.fillRect(SW - 120, 44, 40, 20); g.fillRect(SW - 70, 44, 26, 20);
  rr(g, SW / 2 - 70, 26, 140, 40, 20); g.fillStyle = '#000'; g.fill();
}
function appHeader(g, title) {
  g.fillStyle = '#fff'; g.fillRect(0, 90, SW, 90);
  g.strokeStyle = V; g.lineWidth = 3; g.beginPath(); g.arc(70, 135, 24, 0, Math.PI * 2); g.stroke();
  g.fillStyle = V9; g.font = `600 24px ${F}`; g.fillText(title, 110, 144);
}
function roomScene(g, x, y, w, h, t) {
  // salle stylisée : sol, mur, tableau, fenêtres, tables, chaises
  const grd = g.createLinearGradient(0, y, 0, y + h); grd.addColorStop(0, '#E9E4DD'); grd.addColorStop(0.45, '#E9E4DD'); grd.addColorStop(0.46, '#C9B79F'); grd.addColorStop(1, '#B49F84');
  g.fillStyle = grd; g.fillRect(x, y, w, h);
  g.fillStyle = '#fff'; g.fillRect(x + w * 0.3, y + h * 0.1, w * 0.4, h * 0.2); g.strokeStyle = '#9EA3A8'; g.lineWidth = 4; g.strokeRect(x + w * 0.3, y + h * 0.1, w * 0.4, h * 0.2);
  g.fillStyle = '#CFE3F7'; g.fillRect(x + w * 0.04, y + h * 0.08, w * 0.16, h * 0.26); g.fillRect(x + w * 0.8, y + h * 0.08, w * 0.16, h * 0.26);
  const items = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    const tx = x + w * (0.12 + c * 0.46), ty = y + h * (0.5 + r * 0.16), tw = w * 0.32, th = h * 0.05;
    g.fillStyle = '#D2B48C'; g.fillRect(tx, ty, tw, th); g.fillStyle = '#333'; g.fillRect(tx + 6, ty + th, 6, h * 0.06); g.fillRect(tx + tw - 12, ty + th, 6, h * 0.06);
    items.push({ type: 'TBL', box: [tx - 4, ty - 6, tw + 8, th + h * 0.07] });
    for (const k of [0.2, 0.62]) {
      const cx = tx + tw * k, cy = ty + th + h * 0.012;
      g.fillStyle = V; g.fillRect(cx, cy - h * 0.06, w * 0.08, h * 0.07); g.fillRect(cx, cy + h * 0.01, w * 0.08, h * 0.02);
      items.push({ type: 'CHR', box: [cx - 4, cy - h * 0.065, w * 0.08 + 8, h * 0.1] });
    }
    if ((r + c) % 2 === 0) { g.fillStyle = '#BFC2C7'; g.fillRect(tx + tw * 0.45, ty - h * 0.035, w * 0.09, h * 0.035); g.fillStyle = '#3C5AA8'; g.fillRect(tx + tw * 0.47, ty - h * 0.032, w * 0.07, h * 0.026); items.push({ type: 'LPT', box: [tx + tw * 0.43, ty - h * 0.04, w * 0.11, h * 0.045] }); }
  }
  return items;
}
function brackets(g, [x, y, w, h], col = '#fff', lw = 4) {
  const L = Math.min(w, h) * 0.28; g.strokeStyle = col; g.lineWidth = lw; g.beginPath();
  [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, dx, dy]) => { g.moveTo(cx + dx * L, cy); g.lineTo(cx, cy); g.lineTo(cx, cy + dy * L); });
  g.stroke();
}
function drawScreen(id, p, t) {
  const g = sg;
  g.clearRect(0, 0, SW, SH);
  g.save(); rr(g, 0, 0, SW, SH, 70); g.clip();
  g.fillStyle = '#FCFBFD'; g.fillRect(0, 0, SW, SH);
  if (id === 'hook' || id === 'cta') {
    const grd = g.createLinearGradient(0, 0, 0, SH); grd.addColorStop(0, V); grd.addColorStop(1, V9); g.fillStyle = grd; g.fillRect(0, 0, SW, SH);
    statusBar(g, true);
    const a = ease(p * 2.2);
    g.globalAlpha = a; g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(SW / 2, 520, 110, 0, Math.PI * 2); g.stroke();
    const pts = [[-50, -30], [10, -60], [60, 0], [40, 60], [-20, 50]];
    g.fillStyle = '#fff'; pts.forEach(([dx, dy]) => { g.beginPath(); g.arc(SW / 2 + dx, 520 + dy, 9, 0, Math.PI * 2); g.fill(); });
    g.lineWidth = 2; g.beginPath(); pts.forEach(([dx, dy], i) => (i ? g.lineTo(SW / 2 + dx, 520 + dy) : g.moveTo(SW / 2 + dx, 520 + dy))); g.closePath(); g.stroke();
    g.textAlign = 'center'; g.font = `600 44px ${F}`; g.fillText('EPITA', SW / 2, 720); g.font = `200 44px ${F}`; g.fillText('Smart Classroom', SW / 2, 774);
    g.font = `500 24px ${F}`; g.fillStyle = V2; g.fillText(id === 'cta' ? 'Lancer un audit →' : 'Audit visuel de salle', SW / 2, 850);
    if (id === 'cta') { rr(g, SW / 2 - 170, 900, 340, 84, 42); g.fillStyle = '#fff'; g.fill(); g.fillStyle = V9; g.font = `600 28px ${F}`; g.fillText('Commencer', SW / 2, 952); }
    g.textAlign = 'left'; g.globalAlpha = 1;
  } else if (id === 'problem') {
    statusBar(g); appHeader(g, 'Feuille de comptage');
    g.fillStyle = V9; g.font = `600 34px ${F}`; g.fillText('Salle B12 — inventaire', 46, 260);
    const rows = ['Chaises', 'Tables', 'Portables', 'Écrans', 'Tableau', 'Fenêtres'];
    rows.forEach((r, i) => {
      const y = 320 + i * 120, on = p > 0.12 + i * 0.12;
      rr(g, 40, y, SW - 80, 96, 18); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = V1; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#4A4253'; g.font = `500 28px ${F}`; g.fillText(r, 70, y + 58);
      g.fillStyle = on ? (i % 3 === 1 ? '#B33' : V9) : '#bbb'; g.font = `600 30px ${F}`; g.fillText(on ? (i % 3 === 1 ? '? ? ?' : String([18, 9, 4, 0, 1, 3][i])) : '—', SW - 170, y + 60);
    });
    g.globalAlpha = clamp01((p - 0.7) * 4); rr(g, 40, 1080, SW - 80, 110, 20); g.fillStyle = V9; g.fill();
    g.fillStyle = '#fff'; g.font = `600 26px ${F}`; g.fillText('⚠ À la main · oublis · aucune trace', 70, 1146); g.globalAlpha = 1;
  } else if (id === 'scan' || id === 'validate') {
    g.fillStyle = '#111'; g.fillRect(0, 0, SW, SH);
    const items = roomScene(g, 0, 90, SW, 860, t);
    g.fillStyle = 'rgba(42,19,66,.25)'; g.fillRect(0, 90, SW, 860);
    // balayage
    const sy = 90 + ((t * 260) % 860); const grd = g.createLinearGradient(0, sy - 80, 0, sy); grd.addColorStop(0, 'rgba(183,148,224,0)'); grd.addColorStop(1, 'rgba(183,148,224,.45)'); g.fillStyle = grd; g.fillRect(0, sy - 80, SW, 80);
    const n = Math.floor(items.length * clamp01(p * 1.6));
    const counts = { CHR: 0, TBL: 0, LPT: 0 };
    items.slice(0, n).forEach((it, i) => {
      counts[it.type]++;
      const jit = Math.sin(t * 3 + i) * 1.5; const b = [it.box[0] + jit, it.box[1], it.box[2], it.box[3]];
      const picked = id === 'validate' && i % 3 !== 2;
      brackets(g, b, picked ? LIL : '#fff', 4);
      g.font = `700 15px ${F}`; const tag = `${it.type}-${String(counts[it.type]).padStart(2, '0')}`;
      const tw = g.measureText(tag).width + 14; g.fillStyle = picked ? '#fff' : 'rgba(91,45,142,.95)'; g.fillRect(b[0], b[1] - 24, tw, 22);
      g.fillStyle = picked ? V9 : '#fff'; g.fillText(tag, b[0] + 7, b[1] - 8);
    });
    statusBar(g, true);
    g.fillStyle = '#fff'; g.font = `700 20px ui-monospace, Menlo, monospace`; g.fillText('● SCAN EN DIRECT', 40, 130);
    if (id === 'scan') {
      rr(g, 30, 980, SW - 60, 250, 24); g.fillStyle = 'rgba(20,10,34,.92)'; g.fill();
      g.fillStyle = '#fff'; g.font = `700 22px ui-monospace, Menlo, monospace`; g.fillText('INVENTAIRE EN DIRECT', 60, 1025);
      [['CHAISES', counts.CHR, 12], ['TABLES', counts.TBL, 6], ['PORTABLES', counts.LPT, 3]].forEach(([l, v, e], i) => {
        const y = 1070 + i * 52; g.fillStyle = V2; g.font = `500 20px ui-monospace, Menlo, monospace`; g.fillText(l, 60, y);
        g.fillStyle = '#fff'; g.fillText(`${v}/${e}`, SW - 150, y);
        g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(60, y + 12, SW - 160, 6); g.fillStyle = LIL; g.fillRect(60, y + 12, (SW - 160) * (v / e), 6);
      });
    } else {
      rr(g, 30, 960, SW - 60, 280, 24); g.fillStyle = '#fff'; g.fill();
      g.fillStyle = V; g.font = `700 20px ${F}`; g.fillText('À VALIDER · 4/6 SÉLECTIONNÉS', 60, 1005);
      for (let i = 0; i < 6; i++) {
        const x = 50 + (i % 3) * 172, y = 1030 + Math.floor(i / 3) * 102, on = i % 3 !== 2 || p < 0.45;
        rr(g, x, y, 156, 88, 14); g.fillStyle = on ? V1 : '#f3f3f3'; g.fill(); g.strokeStyle = on ? V : '#ddd'; g.lineWidth = 3; g.stroke();
        rr(g, x + 10, y + 10, 26, 26, 6); g.fillStyle = on ? V : '#fff'; g.fill(); g.strokeStyle = V; g.lineWidth = 2; g.stroke();
        if (on) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 16, y + 23); g.lineTo(x + 22, y + 30); g.lineTo(x + 31, y + 16); g.stroke(); }
        g.fillStyle = V9; g.font = `600 18px ${F}`; g.fillText(['CHR-01', 'CHR-02', 'CHR-02?', 'TBL-01', 'LPT-01', 'TBL-01?'][i], x + 44, y + 30);
        g.fillStyle = '#7C7486'; g.font = `500 15px ${F}`; g.fillText(i % 3 === 2 ? 'doublon' : `${[91, 88, 52, 77, 85, 49][i]} %`, x + 44, y + 58);
      }
    }
  } else if (id === 'inventory') {
    statusBar(g); appHeader(g, 'Inventaire');
    const a = ease(p * 2.5);
    g.globalAlpha = a;
    rr(g, 40, 220, SW - 80, 900, 30); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = V1; g.lineWidth = 2; g.stroke();
    rr(g, 40, 220, SW - 80, 330, 30); g.fillStyle = V9; g.fill(); g.fillRect(40, 480, SW - 80, 70);
    g.fillStyle = V; g.fillRect(SW / 2 - 70, 300, 140, 120); g.fillRect(SW / 2 - 70, 430, 140, 30); g.fillStyle = '#333'; g.fillRect(SW / 2 - 60, 460, 12, 60); g.fillRect(SW / 2 + 48, 460, 12, 60);
    pill(g, 64, 494, 'CHR-07', { bg: V, size: 20, pad: 14 });
    g.fillStyle = V9; g.font = `600 38px ${F}`; g.fillText('Chaise', 70, 620); g.fillStyle = '#7C7486'; g.font = `500 22px ${F}`; g.fillText('n° 7 / 20', 230, 620);
    const rows = [['Classe COCO', 'chair'], ['Confiance', '91 %'], ['Seuil appliqué', '50 % ✓'], ['Marge', '+41 pts'], ['Suivi', '2,3 s · 18 détections'], ['Luminosité', '62 %'], ['Modèle', 'COCO-SSD']];
    rows.forEach(([k, v], i) => {
      const y = 690 + i * 56; g.fillStyle = '#7C7486'; g.font = `500 22px ${F}`; g.fillText(k, 70, y); g.fillStyle = V9; g.font = `600 22px ${F}`; g.fillText(v, 320, y);
      if (k === 'Confiance') { g.fillStyle = V1; g.fillRect(430, y - 14, 90, 8); g.fillStyle = V; g.fillRect(430, y - 14, 90 * 0.91 * ease(p * 2), 8); }
    });
    g.globalAlpha = 1;
  } else if (id === 'advanced') {
    g.fillStyle = '#111'; g.fillRect(0, 0, SW, SH);
    roomScene(g, 0, 90, SW, 860, t);
    const boxes = [['TABLEAU', [SW * 0.3 - 6, 90 + 860 * 0.1 - 6, SW * 0.4 + 12, 860 * 0.2 + 12], 0.25], ['FENÊTRE', [SW * 0.04 - 6, 90 + 860 * 0.08 - 6, SW * 0.16 + 12, 860 * 0.26 + 12], 0.45], ['FENÊTRE', [SW * 0.8 - 6, 90 + 860 * 0.08 - 6, SW * 0.16 + 12, 860 * 0.26 + 12], 0.6]];
    boxes.forEach(([l, b, at]) => {
      const a = clamp01((p - at) * 5); if (!a) return; g.globalAlpha = a; brackets(g, b, '#FFE9A8', 5);
      g.font = `700 16px ${F}`; const tw = g.measureText(l).width + 14; g.fillStyle = '#FFE9A8'; g.fillRect(b[0], b[1] + b[3] + 4, tw, 24); g.fillStyle = V9; g.fillText(l, b[0] + 7, b[1] + b[3] + 22); g.globalAlpha = 1;
    });
    statusBar(g, true);
    rr(g, 30, 980, SW - 60, 250, 24); g.fillStyle = '#fff'; g.fill();
    g.fillStyle = V; g.font = `700 20px ${F}`; g.fillText('🔬 ANALYSE AVANCÉE · OWL-ViT', 60, 1025);
    g.fillStyle = '#4A4253'; g.font = `500 20px ui-monospace, Menlo, monospace`;
    ['"a whiteboard"  → 1', '"a window"      → 2', '"a door"        → 0'].forEach((q, i) => { g.globalAlpha = clamp01((p - 0.2 - i * 0.15) * 5); g.fillText(q, 60, 1075 + i * 44); });
    g.globalAlpha = 1;
  } else if (id === 'audit') {
    statusBar(g); appHeader(g, 'Tableau de bord');
    rr(g, 40, 220, SW - 80, 170, 28); g.fillStyle = V; g.fill();
    g.fillStyle = V2; g.font = `600 20px ${F}`; g.fillText('OBJETS DÉTECTÉS', 70, 270);
    g.fillStyle = '#fff'; g.font = `200 76px ${F}`; g.fillText(String(Math.round(31 * ease(p * 1.6))), 70, 360);
    const tiles = [['ÉCARTS', String(Math.round(2 * ease(p * 1.6)))], ['QUALITÉ', 'Bonne'], ['TAUX', `${Math.round(94 * ease(p * 1.6))} %`]];
    tiles.forEach(([l, v], i) => { const x = 40 + i * 180; rr(g, x, 410, 164, 140, 22); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = V1; g.lineWidth = 2; g.stroke(); g.fillStyle = '#7C7486'; g.font = `600 16px ${F}`; g.fillText(l, x + 18, 450); g.fillStyle = V9; g.font = `300 40px ${F}`; g.fillText(v, x + 18, 515); });
    const rows = [['Chaises', '20', '19', '≈ Conforme'], ['Tables', '10', '10', '✓ Conforme'], ['Portables', '5', '3', '△ À vérifier'], ['Tableau', '1', '1', '✓ Conforme']];
    rows.forEach(([c, e, d, st], i) => {
      const y = 600 + i * 120; g.globalAlpha = clamp01((p - 0.25 - i * 0.1) * 5);
      rr(g, 40, y, SW - 80, 100, 18); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = V1; g.stroke();
      g.fillStyle = V9; g.font = `600 24px ${F}`; g.fillText(c, 66, y + 42); g.fillStyle = '#7C7486'; g.font = `500 20px ${F}`; g.fillText(`${d} / ${e}`, 66, y + 76);
      pill(g, SW - 280, y + 30, st, { bg: st.startsWith('△') ? '#fff' : V, fg: st.startsWith('△') ? V : '#fff', stroke: st.startsWith('△') ? V : null, size: 18, pad: 14 });
      g.globalAlpha = 1;
    });
    g.globalAlpha = clamp01((p - 0.75) * 5); rr(g, 40, 1100, SW - 80, 90, 45); g.fillStyle = V9; g.fill(); g.fillStyle = '#fff'; g.font = `600 24px ${F}`; g.textAlign = 'center'; g.fillText('📄 Rapport PDF prêt', SW / 2, 1154); g.textAlign = 'left'; g.globalAlpha = 1;
  } else if (id === 'anomalies') {
    statusBar(g); appHeader(g, 'Registre des anomalies');
    const resolved = Math.floor(clamp01((p - 0.3) * 2) * 3);
    rr(g, 40, 220, SW - 80, 150, 28); g.fillStyle = V; g.fill();
    g.fillStyle = V2; g.font = `600 20px ${F}`; g.fillText('TAUX DE RÉSOLUTION', 70, 270);
    g.fillStyle = '#fff'; g.font = `200 70px ${F}`; g.fillText(`${Math.round((resolved / 4) * 100)} %`, 70, 345);
    const rows = [['Critique', 'Portables : 3 / 5'], ['Majeure', 'Image trop sombre'], ['Mineure', 'Tableau : contrôle manuel'], ['Mineure', 'Chaises : surplus +1']];
    rows.forEach(([sev, txt], i) => {
      const y = 410 + i * 170, done = i < resolved;
      rr(g, 40, y, SW - 80, 150, 22); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = V1; g.lineWidth = 2; g.stroke();
      pill(g, 66, y + 22, sev, { bg: sev === 'Critique' ? V9 : sev === 'Majeure' ? V : V1, fg: sev === 'Mineure' ? V : '#fff', size: 16, pad: 12 });
      g.fillStyle = V9; g.font = `600 24px ${F}`; g.fillText(txt, 66, y + 105);
      pill(g, SW - 230, y + 22, done ? 'Résolue ✓' : 'Ouverte', { bg: done ? V : '#fff', fg: done ? '#fff' : V, stroke: done ? null : V, size: 16, pad: 12 });
    });
  } else if (id === 'trust') {
    statusBar(g); appHeader(g, 'Confidentialité');
    const a = ease(p * 2);
    g.save(); g.translate(SW / 2, 470); g.scale(0.8 + 0.2 * a, 0.8 + 0.2 * a); g.globalAlpha = a;
    g.beginPath(); g.moveTo(0, -170); g.lineTo(150, -110); g.lineTo(150, 20); g.quadraticCurveTo(140, 140, 0, 200); g.quadraticCurveTo(-140, 140, -150, 20); g.lineTo(-150, -110); g.closePath();
    g.fillStyle = V; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 12; g.beginPath(); g.moveTo(-60, 10); g.lineTo(-10, 60); g.lineTo(70, -40); g.stroke(); g.restore(); g.globalAlpha = 1;
    [['0', 'image envoyée sans accord'], ['0', 'personne analysée'], ['100 %', 'inférence locale']].forEach(([v, l], i) => {
      const y = 760 + i * 150; g.globalAlpha = clamp01((p - 0.2 - i * 0.12) * 5);
      rr(g, 40, y, SW - 80, 126, 22); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = V1; g.stroke();
      g.fillStyle = V; g.font = `200 58px ${F}`; g.fillText(v, 70, y + 84); g.fillStyle = V9; g.font = `500 24px ${F}`; g.fillText(l, 250, y + 76); g.globalAlpha = 1;
    });
  }
  g.restore();
}

// ---------------------------------------------------------------- Téléphone 3D
function buildPhone(texture) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.78, 1.62, 0.085, 8, 0.1),
    new THREE.MeshPhysicalMaterial({ color: '#1B1424', metalness: 0.75, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.2 }));
  group.add(body);
  const frame = new THREE.Mesh(new RoundedBoxGeometry(0.8, 1.64, 0.07, 8, 0.11), new THREE.MeshStandardMaterial({ color: '#B9A9CF', metalness: 1, roughness: 0.25 }));
  group.add(frame);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.536), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }));
  screen.position.z = 0.0435; group.add(screen);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.536), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.06, roughness: 0, metalness: 0, clearcoat: 1 }));
  glass.position.z = 0.0445; group.add(glass);
  // module photo au dos
  const cam = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.3, 0.03, 4, 0.06), new THREE.MeshStandardMaterial({ color: '#2A1342', metalness: 0.6, roughness: 0.3 }));
  cam.position.set(-0.18, 0.56, -0.055); group.add(cam);
  const lensMat = new THREE.MeshPhysicalMaterial({ color: '#05050a', metalness: 0.2, roughness: 0.05, clearcoat: 1 });
  [[-0.24, 0.62], [-0.12, 0.62], [-0.24, 0.5]].forEach(([x, y]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 32), lensMat); l.rotation.x = Math.PI / 2; l.position.set(x, y, -0.072); group.add(l); });
  // boutons latéraux
  const btnMat = new THREE.MeshStandardMaterial({ color: '#B9A9CF', metalness: 1, roughness: 0.3 });
  [[0.405, 0.35, 0.18], [-0.405, 0.42, 0.1], [-0.405, 0.25, 0.1]].forEach(([x, y, h]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.015, h, 0.03), btnMat); b.position.set(x, y, 0); group.add(b); });
  return group;
}

// ---------------------------------------------------------------- Lecteur
export function mountFilm(root) {
  const film = root.querySelector('canvas.film-canvas');
  film.width = W; film.height = H;
  const g = film.getContext('2d');
  const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  gl.setPixelRatio(1); gl.setSize(1000, 1000, false);
  gl.toneMapping = THREE.ACESFilmicToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 0, 4.2);
  scene.add(new THREE.HemisphereLight('#ffffff', '#3a2457', 1.1));
  const key = new THREE.DirectionalLight('#ffffff', 2.4); key.position.set(2.5, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight('#B794E0', 3); rim.position.set(-3, 1, -2); scene.add(rim);
  const tex = new THREE.CanvasTexture(scr); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const phone = buildPhone(tex); scene.add(phone);

  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const stars = Array.from({ length: 90 }, () => ({ x: rnd() * W, y: rnd() * H, r: rnd() * 2.2 + 0.4, s: rnd() * 0.3 + 0.05 }));
  const st = { t: 0, playing: false, last: 0, onEnd: null, prevScene: -1 };
  const chips = root.querySelector('.film-chips');
  chips.innerHTML = SCENES.map((s, i) => `<button type="button" data-i="${i}">${i + 1}. ${s.chip}</button>`).join('');
  const bar = root.querySelector('.film-progress span'), timeEl = root.querySelector('.film-time');
  const playBtn = root.querySelector('[data-film=play]');

  function sceneAt(t) { let i = SCENES.length - 1; for (let k = 0; k < SCENES.length; k++) if (t < STARTS[k] + SCENES[k].d) { i = k; break; } return i; }

  function drawText(sc, p, i) {
    const inA = ease(p * 3.2), outA = 1 - ease((p - 0.9) * 10);
    const a = Math.min(inA, i === SCENES.length - 1 ? 1 : outA);
    const dx = (1 - inA) * -40;
    g.save(); g.globalAlpha = a; g.translate(dx, 0);
    const x = 150; let y = 330;
    g.fillStyle = LIL; g.font = `600 26px ${F}`; g.letterSpacing = '6px'; g.fillText(sc.eyebrow, x, y); g.letterSpacing = '0px';
    y += 110;
    sc.title.forEach((line, k) => { g.fillStyle = '#fff'; g.font = `${k ? 200 : 600} 92px ${F}`; g.fillText(line, x, y); y += 108; });
    y += 18;
    g.fillStyle = V2; g.font = `300 34px ${F}`;
    const words = sc.sub.split(' '); let line = ''; const maxW = 860;
    words.forEach((w) => { const test = line ? `${line} ${w}` : w; if (g.measureText(test).width > maxW) { g.fillText(line, x, y); y += 50; line = w; } else line = test; });
    if (line) { g.fillText(line, x, y); y += 50; }
    if (sc.points) {
      y += 30; let px = x;
      sc.points.forEach((pt, k) => { g.globalAlpha = a * clamp01((p - 0.18 - k * 0.08) * 6); px += pill(g, px, y, pt, { bg: 'rgba(255,255,255,.08)', fg: '#fff', stroke: 'rgba(255,255,255,.35)', size: 24 }) + 14; });
      g.globalAlpha = a;
    }
    if (sc.cta) { y += 40; pill(g, x, y, 'Ouvrir l\'application →', { bg: '#fff', fg: V9, size: 30, pad: 30 }); }
    g.restore();
  }

  // Boucle d'animation active seulement pendant la lecture (aucun calcul en pause ou hors écran)
  let looping = false;
  function startLoop() { if (!looping) { looping = true; st.last = performance.now(); requestAnimationFrame(frame); } }
  function frame(now) {
    if (!st.playing) { looping = false; render(); return; }
    if (st.playing) {
      const dt = Math.min(0.05, (now - st.last) / 1000 || 0); st.t += dt;
      if (st.t >= TOTAL) { st.t = TOTAL - 0.001; st.playing = false; playBtn.textContent = '↻ Revoir'; if (st.onEnd) { const f = st.onEnd; st.onEnd = null; f(); } }
    }
    st.last = now;
    render();
    if (st.playing) requestAnimationFrame(frame); else looping = false;
  }
  function render() {
    const i = sceneAt(st.t), sc = SCENES[i], lt = st.t - STARTS[i], p = lt / sc.d;
    // fond
    const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#2A1342'); bg.addColorStop(1, '#140a22'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    stars.forEach((s) => { const x = ((s.x - st.t * s.s * 60) % W + W) % W; g.fillStyle = `rgba(214,198,231,${0.25 + s.r / 6})`; g.beginPath(); g.arc(x, s.y, s.r, 0, Math.PI * 2); g.fill(); });
    const glow = g.createRadialGradient(1380, 540, 40, 1380, 540, 560); glow.addColorStop(0, 'rgba(91,45,142,.75)'); glow.addColorStop(1, 'rgba(91,45,142,0)'); g.fillStyle = glow; g.fillRect(0, 0, W, H);
    // écran + téléphone
    drawScreen(sc.id, p, st.t); tex.needsUpdate = true;
    const prev = SCENES[Math.max(0, i - 1)].phone, cur = sc.phone, k = easeIO(clamp01(lt / 1.1));
    let ry = prev.ry + (cur.ry - prev.ry) * k, rx = prev.rx + (cur.rx - prev.rx) * k;
    if (cur.spin) ry += (1 - easeIO(clamp01(lt / 1.8))) * Math.PI * 2;
    phone.rotation.set(rx + Math.sin(st.t * 1.1) * 0.025, ry + Math.sin(st.t * 0.7) * 0.05, Math.sin(st.t * 0.9) * 0.015);
    phone.position.y = Math.sin(st.t * 1.3) * 0.04;
    gl.render(scene, camera);
    // ombre portée
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(1380, 1010, 230, 26, 0, 0, Math.PI * 2); g.fill();
    g.drawImage(gl.domElement, 880, 40, 1000, 1000);
    drawText(sc, p, i);
    // habillage : marque + chapitres
    g.fillStyle = '#fff'; g.font = `600 22px ${F}`; g.letterSpacing = '5px'; g.fillText('EPITA', 150, 110); g.font = `300 22px ${F}`; g.fillText('SMART CLASSROOM', 262, 110); g.letterSpacing = '0px';
    SCENES.forEach((s, k) => {
      const x = 150 + k * 166, y = 1000, w = 150; g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x, y, w, 4);
      const f = k < i ? 1 : k === i ? p : 0; g.fillStyle = '#fff'; g.fillRect(x, y, w * f, 4);
    });
    bar.style.width = `${(st.t / TOTAL) * 100}%`;
    timeEl.textContent = `${Math.floor(st.t / 60)}:${String(Math.floor(st.t % 60)).padStart(2, '0')} / ${Math.floor(TOTAL / 60)}:${String(Math.round(TOTAL % 60)).padStart(2, '0')}`;
    if (i !== st.prevScene) { chips.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === i)); st.prevScene = i; }
  }
  /** Rendu déterministe d'une image du film à l'instant t (utilisé pour l'export MP4 image par image). */
  function renderAt(t) { st.playing = false; st.t = Math.min(TOTAL - 0.001, Math.max(0, t)); render(); }

  function play() { if (st.t >= TOTAL - 0.01) st.t = 0; st.playing = true; st.last = performance.now(); playBtn.textContent = '❚❚ Pause'; startLoop(); }
  function pause() { st.playing = false; playBtn.textContent = '▶ Lecture'; render(); }
  playBtn.addEventListener('click', () => (st.playing ? pause() : play()));
  chips.addEventListener('click', (e) => { const i = e.target.dataset.i; if (i === undefined) return; st.t = STARTS[+i] + 0.01; play(); render(); });
  root.querySelector('.film-progress').addEventListener('click', (e) => { const r = e.currentTarget.getBoundingClientRect(); st.t = ((e.clientX - r.left) / r.width) * TOTAL; play(); });
  root.querySelector('[data-film=full]').addEventListener('click', () => {
    const el = root.querySelector('.film-stage');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (el.requestFullscreen) el.requestFullscreen().catch(() => el.classList.toggle('is-full'));
    else el.classList.toggle('is-full');
  });
  // Export vidéo (WebM) : on rejoue le film du début en enregistrant le canvas
  const recBtn = root.querySelector('[data-film=rec]');
  recBtn.addEventListener('click', () => {
    if (!film.captureStream || !window.MediaRecorder) { recBtn.textContent = 'Export non pris en charge par ce navigateur'; return; }
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(film.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
    const chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `epita-smart-classroom-film.${(rec.mimeType || '').includes('mp4') ? 'mp4' : 'webm'}`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      recBtn.disabled = false; recBtn.textContent = '⬇ Télécharger la vidéo';
    };
    recBtn.disabled = true; recBtn.textContent = `● Enregistrement… (${Math.round(TOTAL)} s)`;
    st.t = 0; st.onEnd = () => setTimeout(() => rec.stop(), 300);
    rec.start(500); play();
  });

  // lecture automatique quand le film devient visible (sauf préférence « mouvement réduit »)
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  new IntersectionObserver((ents) => {
    ents.forEach((e) => { if (e.isIntersecting && !reduce && st.t === 0 && !st.playing) play(); if (!e.isIntersecting && st.playing && !recBtn.disabled) pause(); });
  }, { threshold: 0.4 }).observe(film);
  render(); // première image affichée, sans boucle
  return { play, pause, renderAt, state: st, TOTAL, canvas: film };
}

// Montage automatique
const root = document.getElementById('filmRoot');
if (root) {
  const go = () => document.fonts && document.fonts.load ? Promise.all([document.fonts.load(`600 40px ${F}`), document.fonts.load(`200 40px ${F}`), document.fonts.load(`300 40px ${F}`)]).catch(() => {}).then(() => { window.__FILM__ = mountFilm(root); }) : (window.__FILM__ = mountFilm(root));
  try { go(); } catch (e) { console.error('[film]', e); root.querySelector('.film-fallback').hidden = false; }
}
