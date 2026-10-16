// EPITA Smart Classroom — salle de classe 3D de démonstration (Three.js)
// Scène 100 % générée par code : aucune image réelle, aucune personne.
// La vérité terrain (contenu exact de la salle) permet de mesurer le taux de détection.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = (s) => document.querySelector(s);
const vp = $('#viewport');
const overlay = $('#overlay3d');

// ---------------------------------------------------------------- Rendu
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
vp.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#2A1342');
const camera = new THREE.PerspectiveCamera(55, 16 / 10, 0.1, 60); // near/far resserrés = meilleure précision de profondeur
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 0.8;
controls.maxDistance = 22;

// Dimensions de la salle (mètres)
const W = 10, D = 12, H = 3.2;

// ---------------------------------------------------------------- Matériaux
const M = {
  wall: new THREE.MeshStandardMaterial({ color: '#EEEAE4', roughness: 0.95, side: THREE.BackSide }),
  floor: new THREE.MeshStandardMaterial({ color: '#B9A58C', roughness: 0.8 }),
  wood: new THREE.MeshStandardMaterial({ color: '#D2B48C', roughness: 0.55 }),
  metal: new THREE.MeshStandardMaterial({ color: '#3B3B40', roughness: 0.4, metalness: 0.6 }),
  chair: new THREE.MeshStandardMaterial({ color: '#2B2730', roughness: 0.6 }),
  chairSeat: new THREE.MeshStandardMaterial({ color: '#5B2D8E', roughness: 0.7 }),
  alu: new THREE.MeshStandardMaterial({ color: '#BFC2C7', roughness: 0.35, metalness: 0.7 }),
  laptopScreen: new THREE.MeshStandardMaterial({ color: '#0E1630', emissive: '#3C5AA8', emissiveIntensity: 0.6, roughness: 0.2 }),
  board: new THREE.MeshStandardMaterial({ color: '#FAFAFA', roughness: 0.25 }),
  frame: new THREE.MeshStandardMaterial({ color: '#9EA3A8', roughness: 0.4, metalness: 0.5 }),
  tvBody: new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.3 }),
  tvScreen: new THREE.MeshStandardMaterial({ color: '#05070D', emissive: '#1B2440', emissiveIntensity: 0.5, roughness: 0.1 }),
  glass: new THREE.MeshStandardMaterial({ color: '#CFE3F7', emissive: '#CFE3F7', emissiveIntensity: 1, roughness: 0.1 }),
  winFrame: new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.5 }),
};
const box = (w, h, d, mat, cast = true) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = cast; m.receiveShadow = true;
  return m;
};

// ---------------------------------------------------------------- Pièce
const room = box(W, H, D, M.wall, false);
room.position.y = H / 2;
scene.add(room);
// Sol : dalle épaisse (15 cm) dont la face supérieure est à +5 mm, au-dessus du fond de la pièce
// → supprime le « z-fighting » (scintillement) entre le sol et la face inférieure du volume de la salle.
const FLOOR_T = 0.15;
const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 0.02, FLOOR_T, D + 0.02), M.floor);
floor.position.y = 0.005 - FLOOR_T / 2;
floor.receiveShadow = true;
scene.add(floor);
// plinthes
[[0, -D / 2 + 0.01, W, 0], [0, D / 2 - 0.01, W, 0], [-W / 2 + 0.01, 0, D, Math.PI / 2], [W / 2 - 0.01, 0, D, Math.PI / 2]].forEach(([x, z, len, r]) => {
  const p = box(len, 0.1, 0.02, M.metal, false); p.position.set(x, 0.05, z); p.rotation.y = r; scene.add(p);
});

// Tableau (mur avant)
const boardGroup = new THREE.Group();
const boardPanel = box(3.4, 1.25, 0.03, M.board, false);
boardGroup.add(boardPanel);
[[0, 0.64, 3.5, 0.05], [0, -0.64, 3.5, 0.05]].forEach(([x, y, w, h]) => { const f = box(w, h, 0.05, M.frame, false); f.position.set(x, y, 0.01); boardGroup.add(f); });
[[-1.73, 0], [1.73, 0]].forEach(([x, y]) => { const f = box(0.05, 1.33, 0.05, M.frame, false); f.position.set(x, y, 0.01); boardGroup.add(f); });
const tray = box(3.4, 0.04, 0.1, M.frame, false); tray.position.set(0, -0.68, 0.05); boardGroup.add(tray);
boardGroup.position.set(-0.6, 1.65, -D / 2 + 0.03);
scene.add(boardGroup);

// Écran mural
const tvGroup = new THREE.Group();
tvGroup.add(box(1.35, 0.8, 0.07, M.tvBody, false));
const tvS = box(1.27, 0.72, 0.01, M.tvScreen, false); tvS.position.z = 0.04; tvGroup.add(tvS);
tvGroup.position.set(3.3, 1.9, -D / 2 + 0.06);
scene.add(tvGroup);

// Fenêtres (mur gauche)
const winGroup = new THREE.Group();
[-3.2, 0, 3.2].forEach((z) => {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.5), M.glass);
  glass.rotation.y = Math.PI / 2; g.add(glass);
  [[0.78, 1.9, 0.07], [-0.78, 1.9, 0.07]].forEach(([y, w, h]) => { const f = box(0.06, h, w, M.winFrame, false); f.position.set(0.02, y, 0); g.add(f); });
  [[0.93], [-0.93], [0]].forEach(([zz]) => { const f = box(0.06, 1.6, 0.06, M.winFrame, false); f.position.set(0.02, 0, zz); g.add(f); });
  const sill = box(0.22, 0.05, 2.0, M.winFrame, false); sill.position.set(0.1, -0.8, 0); g.add(sill);
  g.position.set(-W / 2 + 0.01, 1.7, z);
  winGroup.add(g);
});
scene.add(winGroup);

// Porte (mur du fond, côté droit)
const doorGroup = new THREE.Group();
const doorMat = new THREE.MeshStandardMaterial({ color: '#8A6A4A', roughness: 0.6 });
const leaf = box(0.95, 2.1, 0.05, doorMat, false); leaf.position.y = 1.05; doorGroup.add(leaf);
[[-0.52, 1.08, 0.06, 2.2], [0.52, 1.08, 0.06, 2.2]].forEach(([x, y, w, h]) => { const f = box(w, h, 0.08, M.winFrame, false); f.position.set(x, y, 0); doorGroup.add(f); });
const lintel = box(1.1, 0.06, 0.08, M.winFrame, false); lintel.position.y = 2.17; doorGroup.add(lintel);
const handle = box(0.12, 0.03, 0.05, M.alu, false); handle.position.set(0.32, 1.0, -0.05); doorGroup.add(handle);
doorGroup.position.set(3.6, 0, D / 2 - 0.04);
scene.add(doorGroup);

// Luminaires de plafond (décor)
for (const x of [-2.2, 2.2]) for (const z of [-3, 0, 3]) {
  const l = box(1.2, 0.04, 0.3, new THREE.MeshStandardMaterial({ color: '#fff', emissive: '#fff', emissiveIntensity: 0.6 }), false);
  l.position.set(x, H - 0.03, z); scene.add(l);
}

// ---------------------------------------------------------------- Mobilier
function makeTable() {
  const g = new THREE.Group();
  const top = box(1.6, 0.04, 0.7, M.wood); top.position.y = 0.74; g.add(top);
  for (const x of [-0.75, 0.75]) for (const z of [-0.3, 0.3]) { const leg = box(0.04, 0.72, 0.04, M.metal); leg.position.set(x, 0.36, z); g.add(leg); }
  const bar = box(1.5, 0.04, 0.03, M.metal); bar.position.set(0, 0.2, -0.3); g.add(bar);
  return g;
}
function makeChair() {
  const g = new THREE.Group();
  const seat = box(0.44, 0.05, 0.42, M.chairSeat); seat.position.y = 0.46; g.add(seat);
  const back = box(0.44, 0.38, 0.04, M.chairSeat); back.position.set(0, 0.74, 0.2); back.rotation.x = -0.08; g.add(back);
  for (const x of [-0.19, 0.19]) for (const z of [-0.18, 0.18]) { const leg = box(0.025, 0.46, 0.025, M.chair); leg.position.set(x, 0.23, z); g.add(leg); }
  for (const x of [-0.19, 0.19]) { const up = box(0.025, 0.42, 0.025, M.chair); up.position.set(x, 0.68, 0.2); g.add(up); }
  return g;
}
function makeLaptop() {
  const g = new THREE.Group();
  const base = box(0.34, 0.018, 0.24, M.alu); base.position.y = 0.009; g.add(base);
  const kb = box(0.3, 0.002, 0.12, M.chair, false); kb.position.set(0, 0.019, -0.02); g.add(kb);
  const lid = new THREE.Group();
  const shell = box(0.34, 0.23, 0.012, M.alu); shell.position.y = 0.115; lid.add(shell);
  const scr = box(0.31, 0.2, 0.002, M.laptopScreen, false); scr.position.set(0, 0.117, -0.007); lid.add(scr);
  lid.position.set(0, 0.018, 0.12); lid.rotation.x = 0.28; g.add(lid);
  return g;
}

const furniture = new THREE.Group();
scene.add(furniture);
const TABLE_SLOTS = [];
for (let r = 0; r < 6; r++) for (const x of [-2.3, 2.3]) TABLE_SLOTS.push([x, -3.0 + r * 1.55]);

// Générateur pseudo-aléatoire reproductible (pour le « désordre »)
function rng(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

const cfg = { tables: 10, chairs: 20, laptops: 5, board: true, windows: true, screen: true, door: true, mess: false };
const truth = { tables: 0, chairs: 0, laptops: 0, screens: 0, board: 0, windows: 0, doors: 0 };

function disposeGroup(g) { while (g.children.length) g.remove(g.children[0]); }

function buildFurniture() {
  disposeGroup(furniture);
  const rand = rng(42);
  const nT = cfg.tables;
  const nL = Math.min(cfg.laptops, nT);
  let chairsLeft = cfg.chairs;
  for (let i = 0; i < nT; i++) {
    const [x, z] = TABLE_SLOTS[i];
    const t = makeTable(); t.position.set(x, 0, z); furniture.add(t);
    if (i < nL) { const l = makeLaptop(); l.position.set(x - 0.35, 0.76, z - 0.02); l.rotation.y = Math.PI; furniture.add(l); }
    for (const dx of [-0.4, 0.4]) {
      if (chairsLeft <= 0) break;
      const c = makeChair();
      let cx = x + dx, cz = z + 0.6, ry = 0;
      if (cfg.mess) { cx += (rand() - 0.5) * 0.5; cz += rand() * 0.45; ry = (rand() - 0.5) * 1.6; }
      c.position.set(cx, 0, cz); c.rotation.y = ry; furniture.add(c); chairsLeft--;
    }
  }
  // chaises en surplus : rangées le long du mur droit
  for (let k = 0; chairsLeft > 0; k++, chairsLeft--) {
    const c = makeChair(); c.position.set(W / 2 - 0.45, 0, -4.5 + k * 0.6); c.rotation.y = -Math.PI / 2; furniture.add(c);
  }
  boardGroup.visible = cfg.board;
  winGroup.visible = cfg.windows;
  tvGroup.visible = cfg.screen;
  doorGroup.visible = cfg.door;
  Object.assign(truth, { tables: nT, chairs: cfg.chairs, laptops: nL, screens: cfg.screen ? 1 : 0, board: cfg.board ? 1 : 0, windows: cfg.windows ? 3 : 0, doors: cfg.door ? 1 : 0 });
  clearDetection();
}

// ---------------------------------------------------------------- Lumières
const hemi = new THREE.HemisphereLight('#FFFFFF', '#8A7A66', 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#FFF4E0', 1.8);
sun.position.set(-9, 6, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.02; // évite l'« acné » d'ombre sur le sol
scene.add(sun);
const ceilingLights = [];
for (const x of [-2.2, 2.2]) for (const z of [-3, 0, 3]) {
  const p = new THREE.PointLight('#FFE2B8', 0, 7, 1.6); p.position.set(x, H - 0.2, z); scene.add(p); ceilingLights.push(p);
}
const LIGHTS = {
  day: { hemi: 0.9, sun: 1.8, ceil: 0, glass: 1.0, exposure: 1.0 },
  evening: { hemi: 0.18, sun: 0, ceil: 2.2, glass: 0.08, exposure: 1.0 },
  backlight: { hemi: 0.12, sun: 3.2, ceil: 0, glass: 3.5, exposure: 1.15 },
};
function setLight(k) {
  const L = LIGHTS[k];
  hemi.intensity = L.hemi; sun.intensity = L.sun;
  ceilingLights.forEach((p) => { p.intensity = L.ceil; });
  M.glass.emissiveIntensity = L.glass;
  M.glass.emissive.set(k === 'evening' ? '#1B2A55' : '#CFE3F7');
  renderer.toneMappingExposure = L.exposure;
  clearDetection();
}

// ---------------------------------------------------------------- Caméras
const CAMS = {
  overview: { pos: [4.3, 2.55, 5.6], target: [-0.6, 0.55, -1.6] },
  back: { pos: [0, 1.7, 5.75], target: [0, 0.7, -3] },
  door: { pos: [-1.5, 1.6, -3.5], target: [3.4, 1.0, 6] },
  close: { pos: [-0.55, 1.35, -1.25], target: [-2.4, 0.78, -3.1] },
  top: { pos: [0.01, 3.05, 4.6], target: [0, 0, -0.8] },
  windows: { pos: [4.2, 1.55, 0.4], target: [-5, 1.1, 0] },
};
let camAnim = null;
function goCam(k, instant = false) {
  const c = CAMS[k];
  const to = { pos: new THREE.Vector3(...c.pos), target: new THREE.Vector3(...c.target) };
  if (instant) { camera.position.copy(to.pos); controls.target.copy(to.target); controls.update(); return; }
  camAnim = { from: { pos: camera.position.clone(), target: controls.target.clone() }, to, t: 0 };
}

// ---------------------------------------------------------------- Boucle
function resize() {
  const r = vp.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
  overlay.width = renderer.domElement.width; overlay.height = renderer.domElement.height;
  clearDetection();
}
new ResizeObserver(resize).observe(vp);

controls.addEventListener('start', () => { clearDetection(); const f = document.getElementById('vpFsRate'); if (f) f.hidden = true; });
function loop() {
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + 0.035);
    const e = 1 - Math.pow(1 - camAnim.t, 3);
    camera.position.lerpVectors(camAnim.from.pos, camAnim.to.pos, e);
    controls.target.lerpVectors(camAnim.from.target, camAnim.to.target, e);
    if (camAnim.t >= 1) camAnim = null;
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- Détection (vraie inférence COCO-SSD)
let model = null, modelPromise = null;
const THRESHOLD = 0.5;
const CAT = [
  { key: 'tables', label: 'Tables', coco: ['dining table'] },
  { key: 'chairs', label: 'Chaises', coco: ['chair'] },
  { key: 'laptops', label: 'Ordinateurs portables', coco: ['laptop'] },
  { key: 'screens', label: 'Écrans', coco: ['tv'] },
  { key: 'board', label: 'Tableau', coco: [] },
  { key: 'windows', label: 'Fenêtres', coco: [] },
  { key: 'doors', label: 'Portes', coco: [] },
];
const FR = { 'chair': 'Chaise', 'dining table': 'Table', 'laptop': 'Portable', 'tv': 'Écran', 'keyboard': 'Clavier', 'couch': 'Canapé', 'bench': 'Banc', 'book': 'Livre' };
let lastDetected = null;

function setStatus(t) { $('#detStatus').textContent = t; }
function clearDetection() {
  overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
  lastDetected = null; renderTruth();
}

function renderTruth() {
  $('#gtTable tbody').innerHTML = CAT.map((c) => {
    const real = truth[c.key];
    const det = !c.coco.length ? '<span class="na">hors modèle</span>' : lastDetected ? lastDetected[c.key] : '—';
    return `<tr><td>${c.label}</td><td class="n">${real}</td><td class="n">${det}</td></tr>`;
  }).join('');
  const box = $('#rateBox');
  if (!lastDetected) { box.hidden = true; return; }
  const sup = CAT.filter((c) => c.coco.length && truth[c.key] > 0);
  const sumReal = sup.reduce((s, c) => s + truth[c.key], 0);
  const sumHit = sup.reduce((s, c) => s + Math.min(lastDetected[c.key], truth[c.key]), 0);
  box.hidden = false;
  $('#rateVal').textContent = sumReal ? `${Math.round((sumHit / sumReal) * 100)} %` : '—';
  $('#rateNote').textContent = `${sumHit} objet(s) retrouvé(s) sur ${sumReal} vérifiables · seuil ${Math.round(THRESHOLD * 100)} %`;
}

async function ensureModel() {
  if (model) return model;
  if (typeof window.tf === 'undefined' || typeof window.cocoSsd === 'undefined') throw new Error('bibliothèques TensorFlow.js / COCO-SSD non chargées');
  if (!modelPromise) modelPromise = cocoSsd.load({ base: 'lite_mobilenet_v2' });
  model = await modelPromise;
  return model;
}

async function detect() {
  const btn = $('#btnDetect');
  btn.disabled = true;
  try {
    setStatus('Chargement du modèle (première fois : quelques secondes)…');
    await ensureModel();
    setStatus('Analyse de la vue…');
    renderer.render(scene, camera);
    const t0 = performance.now();
    const preds = (await model.detect(renderer.domElement, 100, THRESHOLD)).filter((p) => p.class !== 'person');
    const ms = Math.round(performance.now() - t0);
    lastDetected = Object.fromEntries(CAT.map((c) => [c.key, preds.filter((p) => c.coco.includes(p.class)).length]));
    drawBoxes(preds);
    renderTruth();
    const others = preds.filter((p) => !CAT.some((c) => c.coco.includes(p.class)));
    // Diagnostic de visibilité : luminosité moyenne de la vue
    const q = document.createElement('canvas'); q.width = 80; q.height = 50;
    const qc = q.getContext('2d'); qc.drawImage(renderer.domElement, 0, 0, 80, 50);
    const px = qc.getImageData(0, 0, 80, 50).data; let lum = 0;
    for (let i = 0; i < px.length; i += 4) lum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
    lum /= px.length / 4;
    const tip = lum < 55 ? ' ⚠ Vue trop sombre : allumez la lumière (bouton « Jour »).'
      : lum > 215 ? ' ⚠ Vue surexposée.'
      : cfg.mess ? ' Chaises en désordre : certaines peuvent être mal reconnues, redressez-les (décochez « désordre »).' : '';
    setStatus(`${preds.length} détection(s) en ${ms} ms${others.length ? ` (dont ${others.length} autre(s) : ${[...new Set(others.map((o) => FR[o.class] || o.class))].join(', ')})` : ''}.${tip}`);
  } catch (e) {
    console.error(e);
    setStatus(`Détection indisponible : ${e.message || e}. La salle 3D reste utilisable.`);
    modelPromise = null;
  } finally { btn.disabled = false; }
}

function drawBoxes(preds) {
  const ctx = overlay.getContext('2d');
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  const s = Math.max(1, overlay.width / 900);
  ctx.lineWidth = 2.5 * s; ctx.font = `600 ${12 * s}px Montserrat, sans-serif`;
  preds.forEach((p) => {
    const [x, y, w, h] = p.bbox;
    ctx.strokeStyle = '#E3D2F7'; ctx.strokeRect(x, y, w, h);
    const label = `${FR[p.class] || p.class} · ${Math.round(p.score * 100)} %`;
    const tw = ctx.measureText(label).width + 10 * s, th = 18 * s, ly = y > th ? y - th : y;
    ctx.fillStyle = '#5B2D8E'; ctx.fillRect(x - 1, ly, tw, th);
    ctx.fillStyle = '#fff'; ctx.fillText(label, x + 4 * s, ly + 13 * s);
  });
}

// ---------------------------------------------------------------- UI
function bindRange(id, out, key, after) {
  const el = $(id);
  el.addEventListener('input', () => { cfg[key] = +el.value; $(out).textContent = el.value; after && after(); buildFurniture(); });
}
bindRange('#nTables', '#oTables', 'tables', () => {
  const l = $('#nLaptops'); l.max = cfg.tables;
  if (cfg.laptops > cfg.tables) { cfg.laptops = cfg.tables; l.value = cfg.tables; $('#oLaptops').textContent = cfg.tables; }
});
bindRange('#nChairs', '#oChairs', 'chairs');
bindRange('#nLaptops', '#oLaptops', 'laptops');
[['#tBoard', 'board'], ['#tWindows', 'windows'], ['#tScreen', 'screen'], ['#tDoor', 'door'], ['#tMess', 'mess']].forEach(([id, k]) => {
  $(id).addEventListener('change', (e) => { cfg[k] = e.target.checked; buildFurniture(); });
});
document.querySelectorAll('[data-cam]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-cam]').forEach((x) => x.classList.toggle('is-on', x === b));
  clearDetection(); goCam(b.dataset.cam);
}));
document.querySelectorAll('[data-light]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-light]').forEach((x) => x.classList.toggle('is-on', x === b));
  setLight(b.dataset.light);
  if (b.dataset.light === 'backlight') { // le contre-jour se lit face aux fenêtres
    document.querySelectorAll('[data-cam]').forEach((x) => x.classList.remove('is-on'));
    goCam('windows');
  }
}));
$('#btnDetect').addEventListener('click', detect);

// ---------------------------------------------------------------- Plein écran (natif, ou secours CSS pour iPhone)
const wrap = vp.closest('.viewport-wrap');
const isFull = () => !!document.fullscreenElement || wrap.classList.contains('is-full');
function pseudoFull(on) { wrap.classList.toggle('is-full', on); document.body.classList.toggle('no-scroll', on); requestAnimationFrame(resize); }
async function enterFull() {
  try {
    if (wrap.requestFullscreen) await wrap.requestFullscreen();
    else if (wrap.webkitRequestFullscreen) wrap.webkitRequestFullscreen();
    else pseudoFull(true);
  } catch { pseudoFull(true); }
  try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch { /* non supporté */ }
}
function exitFull() { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); pseudoFull(false); }
$('#vpFull').addEventListener('click', enterFull);
$('#vpFull2').addEventListener('click', () => (isFull() ? exitFull() : enterFull()));
$('#vpFsExit').addEventListener('click', exitFull);
$('#vpFsDetect').addEventListener('click', async () => {
  await detect();
  const r = $('#rateVal').textContent, f = $('#vpFsRate');
  f.hidden = $('#rateBox').hidden; f.textContent = `Taux de détection : ${r}`;
});
document.addEventListener('fullscreenchange', () => { requestAnimationFrame(resize); if (!document.fullscreenElement) $('#vpFsRate').hidden = true; });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && wrap.classList.contains('is-full')) pseudoFull(false); });
$('#btnPng').addEventListener('click', () => {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = `salle-3d-${cfg.tables}t-${cfg.chairs}c-${Math.min(cfg.laptops, cfg.tables)}p.png`;
  document.body.appendChild(a); a.click(); a.remove();
});

// ---------------------------------------------------------------- Démarrage
buildFurniture();
setLight('day');
goCam('overview', true);
resize();
loop();
$('#vpLoading').hidden = true;
window.__room3d = { cfg, truth, renderer, scene };
