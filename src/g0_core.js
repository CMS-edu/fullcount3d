/* ===================== CORE ===================== */
const S = window.Sim, T = THREE;
const D2R = Math.PI / 180;
const clamp = S.clamp;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const isTouch = matchMedia('(pointer: coarse)').matches;
const lowEnd = isTouch && ((navigator.hardwareConcurrency || 4) <= 4 || Math.min(screen.width, screen.height) < 380);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const store = {
  get(k, d) { try { const v = localStorage.getItem('fc3d.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('fc3d.' + k, JSON.stringify(v)); } catch (e) { /* 저장 불가 환경 */ } },
};

const DIFF = {
  rookie: { key: 'rookie', name: '루키', ts: 0.62, win: 1.35, pci: 1.25, cpuCon: -0.025, cpuPow: -2, meter: 0.75 },
  pro: { key: 'pro', name: '프로', ts: 0.78, win: 1, pci: 1, cpuCon: 0, cpuPow: 0, meter: 1 },
  legend: { key: 'legend', name: '레전드', ts: 0.95, win: 0.85, pci: 0.9, cpuCon: 0.03, cpuPow: 4, meter: 1.35 },
};

/* ---------- renderer / scene ---------- */
const glCanvas = $('#gl');
let renderer;
try {
  renderer = new T.WebGLRenderer({ canvas: glCanvas, antialias: !lowEnd, powerPreference: 'high-performance' });
} catch (e) {
  document.body.classList.add('no-webgl');
  throw e;
}
let pixelRatio = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.5 : 2);
renderer.setPixelRatio(pixelRatio);
const scene = new T.Scene();
const camera = new T.PerspectiveCamera(40, 1, 0.5, 1600);
const MAXANI = renderer.capabilities.getMaxAnisotropy();

/* ---------- 게임 시계 & 스케줄러 (일시정지 안전) ---------- */
let clock = 0, paused = false;
const timers = [];
function later(s, fn) { const t = { t: clock + s, fn }; timers.push(t); return t; }
function clearTimers() { timers.length = 0; }
function runTimers() {
  for (let i = 0; i < timers.length; i++) {
    if (timers[i].t <= clock) { const f = timers[i].fn; timers.splice(i, 1); i--; f(); }
  }
}

/* ---------- 텍스처 헬퍼 ---------- */
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c, o = {}) {
  const t = new T.CanvasTexture(c);
  t.anisotropy = Math.min(o.aniso || 8, MAXANI);
  if (o.repeat) { t.wrapS = T.RepeatWrapping; t.wrapT = o.repeatT ? T.RepeatWrapping : T.ClampToEdgeWrapping; }
  if (o.nomip) { t.generateMipmaps = false; t.minFilter = T.LinearFilter; }
  return t;
}
function hexA(hex, a) {
  const c = new T.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}
function shadeHex(hex, f) {
  const c = new T.Color(hex);
  if (f >= 0) c.lerp(new T.Color(1, 1, 1), f); else c.multiplyScalar(1 + f);
  return '#' + c.getHexString();
}
function lum(hex) { const c = new T.Color(hex); return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; }
const FONT_UI = '"IBM Plex Sans KR","Apple SD Gothic Neo","Malgun Gothic","Noto Sans CJK KR","Noto Sans KR",sans-serif';
const FONT_DISP = '"Black Han Sans","Apple SD Gothic Neo","Malgun Gothic","Noto Sans CJK KR","Noto Sans KR",sans-serif';

/* 방사형 글로우 스프라이트 텍스처 */
const glowTex = (() => {
  const c = makeCanvas(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,250,235,0.55)');
  gr.addColorStop(0.6, 'rgba(255,240,210,0.12)'); gr.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return canvasTex(c);
})();
const dotTex = (() => {
  const c = makeCanvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return canvasTex(c);
})();

/* 수직 리본(벽) 지오메트리: path=[{x,z}], y0(i), y1(i), inside={x,z}(앞면이 향할 쪽) */
function ribbonGeo(path, y0, y1, inside, uScale = 1) {
  const pos = [], uv = [], idx = [];
  let L = 0;
  for (let i = 0; i < path.length; i++) {
    if (i > 0) L += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
    const p = path[i];
    pos.push(p.x, y0(i), p.z, p.x, y1(i), p.z);
    uv.push(L * uScale, 0, L * uScale, 1);
  }
  // 첫 구간으로 방향 판정
  const a = path[0], b = path[1];
  const nx = -(b.z - a.z), nz = b.x - a.x;
  const flip = (nx * (inside.x - a.x) + nz * (inside.z - a.z)) < 0;
  for (let i = 0; i < path.length - 1; i++) {
    const k = i * 2;
    if (!flip) idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); else idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  g.userData.length = L;
  return g;
}

