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
// 그래픽 품질: high = 그림자 2048 + 디테일, mid = 그림자 1024(30fps 갱신), low = 그림자 없음 (예전과 같음). 메뉴에서 바꿈
const GFX = { q: store.get('gfx', null) || (lowEnd ? 'low' : isTouch ? 'mid' : 'high') };
function gfxApply(q) {
  GFX.q = q; GFX.shadows = q !== 'low'; GFX.shadowSize = q === 'high' ? 2048 : 1024; GFX.detail = q !== 'low';
  renderer.shadowMap.enabled = GFX.shadows;
}
renderer.shadowMap.type = T.PCFSoftShadowMap;
// 색 관리: 재질 색·캔버스 텍스처는 지금처럼 sRGB로 적고(THREE.Color 값은 그대로 — UI·캔버스 그리기가 같은 값을 씀),
// 셰이더 안에서만 선형으로 바꿔 조명 계산 → 출력 때 sRGB + ACES 톤매핑. 빛이 물체에 떨어지는 모양(명암 경계·밝은 곳)이 실제처럼 부드러워짐
// 조명이 없는 재질(전광판·LED·조준 링·불꽃 등)은 톤매핑 없이 적은 색 그대로
{
  const toLin = (s) => s.replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( pow( diffuse, vec3( 2.2 ) ), opacity );')
    .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = pow( emissive, vec3( 2.2 ) );');
  for (const k in T.ShaderLib) {
    const sh = T.ShaderLib[k]; if (!sh || !sh.fragmentShader) continue;
    sh.fragmentShader = toLin(sh.fragmentShader);
    if (k === 'basic' || k === 'sprite' || k === 'points' || k === 'dashed') sh.fragmentShader = sh.fragmentShader.replace('#include <tonemapping_fragment>', '');
  }
  T.ShaderChunk.color_fragment = T.ShaderChunk.color_fragment.replace('diffuseColor.rgb *= vColor;', 'diffuseColor.rgb *= pow( vColor, vec3( 2.2 ) );');
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
}
gfxApply(GFX.q);
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
  t.encoding = T.sRGBEncoding; // 캔버스에 그린 색 = sRGB
  t.anisotropy = Math.min(o.aniso || 8, MAXANI);
  if (o.repeat) { t.wrapS = T.RepeatWrapping; t.wrapT = o.repeatT ? T.RepeatWrapping : T.ClampToEdgeWrapping; }
  if (o.nomip) { t.generateMipmaps = false; t.minFilter = T.LinearFilter; }
  return t;
}
function hexA(hex, a) {
  const c = new T.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}
const linColor = (hex) => new T.Color(hex).convertSRGBToLinear(); // 조명 색(셰이더가 안 바꿔 주는 값)용
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

