/* ===================== 스킬 연출 (순수 연출 — 경기 결과에 영향 없음) ===================== */
// 주의: Math.random만 씀 (경기 난수 GR을 쓰면 온라인 두 기기가 어긋남)
//  ① 컷인: 화면을 가로지르는 띠 + 선수 얼굴 + 스킬 아이콘 + 대사 (등판·등장·발동 순간)
//  ② 3D 오라: 스킬 가진 타자·투수·주자 발밑의 빛 고리 + 빛기둥 + 떠오르는 빛가루 (조건이 맞아 "준비"되면 더 밝게)
//  ③ 투구 꼬리: 파이어볼러 불꽃 · 마구 보랏빛 반짝이 · 핀포인트 레이저 · 잠수함 물결 · 끝판왕 금빛 …
//  ④ 임팩트: 거포 충격파 · 해결사 불기둥 · 초구 킬러 "POW!" · 끈질김 바위 파편 · 당겨치기 자기장 · 대도 번개 …
//  ⑤ 스킬별 합성 효과음
const SKFX = {
  slug: { c: ['#b04dff', '#ff3df0', '#ffe066'], line: '한 방이면 끝!', snd: 'boom', hit: 'blast' },
  contact: { c: ['#10c99a', '#9dffdf', '#ffffff'], line: '어디로 오든 맞힌다', snd: 'chime', hit: 'target' },
  speed: { c: ['#ffcc00', '#fff6a8', '#6fd8ff'], line: '번개처럼 달린다!', snd: 'zap', hit: 'bolt' },
  eye: { c: ['#2fb3ff', '#d6f4ff', '#ffffff'], line: '공이 다 보인다', snd: 'shine', hit: 'glint' },
  clutch: { c: ['#ff3d1f', '#ffb627', '#fff3b0'], line: '찬스는 내가 끝낸다!', snd: 'flame', hit: 'flame' },
  first: { c: ['#ff7a1a', '#ffd166', '#ffffff'], line: '초구부터 간다!', snd: 'punch', hit: 'pow' },
  pull: { c: ['#ff2e63', '#3d8bff', '#ffffff'], line: '끌어당겨 날린다', snd: 'magnet', hit: 'magnet' },
  tough: { c: ['#8d8a86', '#e7e5e4', '#ffd84a'], line: '절대 안 물러선다', snd: 'rock', hit: 'rock' },
  heat: { c: ['#ff4d00', '#ffd84a', '#fff3b0'], line: '불꽃 강속구!', snd: 'flame', trail: 'fire' },
  magic: { c: ['#8b5cf6', '#f0abfc', '#ffffff'], line: '마구가 춤춘다', snd: 'magic', trail: 'magic' },
  ctrl: { c: ['#06d6f0', '#a5f3fc', '#ffffff'], line: '원하는 곳에 정확히', snd: 'laser', trail: 'laser' },
  gb: { c: ['#c08552', '#f5d0a9', '#ffffff'], line: '땅으로 굴려라', snd: 'rock', trail: 'dust' },
  escape: { c: ['#3b82f6', '#bfdbfe', '#ffffff'], line: '위기? 문제없다', snd: 'shield', trail: 'shield' },
  eater: { c: ['#22c55e', '#bbf7d0', '#ffffff'], line: '오늘도 길게 간다', snd: 'chime', trail: null },
  closer: { c: ['#ffd84a', '#ff3b3b', '#ffffff'], line: '경기를 끝내러 왔다', snd: 'lock', trail: 'gold' },
  pickoff: { c: ['#16a34a', '#86efac', '#ffffff'], line: '움직이면 잡는다', snd: 'hiss', trail: 'snake' },
  sub: { c: ['#06b6d4', '#67e8f9', '#ffffff'], line: '바닥에서 솟아오른다', snd: 'wave', trail: 'wave' },
};
const skOn = () => G.skfxOn !== false;
const TAU = Math.PI * 2;
const shade = (hex, k) => { const c = new T.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };
const rgba = (hex, a) => { const c = new T.Color(hex); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; };

/* ---------- ⑤ 효과음 ---------- */
Object.assign(AU, {
  skReady() { const t = this.now(); this.tone(t, 0.12, 988, 988, 0.08); this.tone(t + 0.09, 0.22, 1480, 1480, 0.08); this.tone(t + 0.09, 0.22, 2960, 2960, 0.02); },
  skWhoosh() { const t = this.now(); this.noise(t, 0.4, 1100, 0.7, 0.3, 'highpass', 0.1); this.tone(t, 0.3, 160, 1500, 0.09, 'sawtooth'); this.tone(t + 0.04, 0.45, 95, 55, 0.45); },
  sk(kind) {
    const c = this.ctx; if (!c || !this.on) return; const t = c.currentTime + 0.1;
    if (kind === 'boom') { this.noise(t, 1, 140, 0.7, 0.9, 'lowpass'); this.tone(t, 0.7, 120, 30, 0.75); this.noise(t + 0.02, 0.35, 2600, 0.8, 0.3, 'highpass'); }
    else if (kind === 'chime') [880, 1175, 1568, 2093].forEach((f, i) => { this.tone(t + i * 0.07, 0.55, f, f, 0.1); this.tone(t + i * 0.07, 0.55, f * 2, f * 2, 0.025); });
    else if (kind === 'zap') { for (let i = 0; i < 8; i++) this.tone(t + i * 0.032, 0.05, 500 + Math.random() * 2600, 200 + Math.random() * 900, 0.07, 'square'); this.noise(t, 0.3, 4200, 1, 0.22, 'highpass'); }
    else if (kind === 'shine') { this.tone(t, 0.8, 1100, 3600, 0.08); this.tone(t + 0.12, 0.7, 1650, 4900, 0.05); this.tone(t + 0.24, 0.6, 2200, 5200, 0.03); }
    else if (kind === 'flame') { this.noise(t, 0.9, 650, 0.5, 0.5, 'bandpass', 0.05); this.noise(t + 0.08, 0.7, 1900, 0.7, 0.2, 'bandpass', 0.1); this.tone(t, 0.55, 65, 150, 0.25, 'sawtooth'); }
    else if (kind === 'punch') { this.tone(t, 0.2, 170, 45, 0.85); this.noise(t, 0.09, 2600, 1.2, 0.55, 'bandpass', 0.001); this.tone(t + 0.1, 0.25, 900, 1400, 0.06, 'square'); }
    else if (kind === 'magnet') {
      const o = c.createOscillator(), l = c.createOscillator(), lg = c.createGain(), g = c.createGain();
      o.frequency.value = 230; l.frequency.value = 16; lg.gain.value = 70; l.connect(lg); lg.connect(o.frequency);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      o.connect(g); g.connect(this.master); o.start(t); l.start(t); o.stop(t + 0.85); l.stop(t + 0.85);
    } else if (kind === 'rock') { this.noise(t, 0.55, 240, 0.9, 0.75, 'lowpass', 0.002); this.noise(t + 0.04, 0.3, 1500, 1.5, 0.32, 'bandpass', 0.001); this.noise(t + 0.15, 0.2, 900, 1.5, 0.2, 'bandpass', 0.001); }
    else if (kind === 'magic') [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { this.tone(t + i * 0.055, 0.5, f, f * 1.01, 0.065, 'triangle'); this.tone(t + i * 0.055, 0.5, f * 1.5, f * 1.5, 0.025); });
    else if (kind === 'laser') { this.tone(t, 0.38, 2800, 280, 0.12, 'sawtooth'); this.tone(t + 0.02, 0.32, 1900, 220, 0.08); this.tone(t + 0.3, 0.12, 3200, 3200, 0.04, 'square'); }
    else if (kind === 'shield') { this.tone(t, 1, 660, 660, 0.12, 'triangle'); this.tone(t, 1, 990, 990, 0.08, 'triangle'); this.tone(t, 1, 1320, 1318, 0.05); this.noise(t, 0.15, 3000, 2, 0.15, 'bandpass'); }
    else if (kind === 'lock') { this.tone(t, 0.06, 1900, 1200, 0.2, 'square'); this.tone(t + 0.12, 0.06, 1900, 1200, 0.2, 'square'); this.tone(t + 0.24, 0.45, 130, 55, 0.65); this.noise(t + 0.24, 0.22, 500, 1, 0.45, 'lowpass'); }
    else if (kind === 'hiss') { this.noise(t, 0.75, 5200, 0.8, 0.32, 'highpass', 0.08); this.tone(t + 0.55, 0.12, 320, 90, 0.45); this.noise(t + 0.55, 0.1, 1800, 1, 0.3, 'bandpass', 0.001); }
    else if (kind === 'wave') { this.noise(t, 1.2, 480, 0.5, 0.45, 'lowpass', 0.35); this.noise(t + 0.2, 0.9, 1300, 0.6, 0.16, 'bandpass', 0.3); this.tone(t, 1, 180, 320, 0.05); }
  },
});

/* ---------- ① 컷인 ---------- */
const SKC = { q: [], busyUntil: 0, cur: null, timer: 0 };
const skHost = () => $('#skcut');
// p: 선수, tm: { t: 팀 }, o: { tag: '등판'·'발동!'…, line: 대사, pos: 'mid'|'low'|'high', side: 'L'|'R', count: 발동 횟수 셀지, preview }
function skCutIn(p, tm, o = {}) {
  const S0 = p && SKILLS[p.skill]; if (!S0) return;
  if (!skOn() && !o.preview) { showPlayText(`${S0.ico} ${p.name} · ${S0.nm} ${o.tag || '발동!'}`, 1500); if (o.count && p.g) p.g.skN = (p.g.skN || 0) + 1; return; }
  if (o.count && p.g) p.g.skN = (p.g.skN || 0) + 1;
  if (SKC.q.length >= 3) SKC.q.shift();
  SKC.q.push({ p, tm, o });
  if (!SKC.cur) skCutNext();
}
function skCutNext() {
  const it = SKC.q.shift(); SKC.cur = null; if (!it) return;
  const { p, tm, o } = it, S0 = SKILLS[p.skill], F = SKFX[p.skill], [a, b, c] = F.c;
  const dur = reduceMotion ? 1100 : 1500;
  const el = document.createElement('div');
  el.className = `skc side-${o.side || 'L'} pos-${o.pos || 'mid'}${reduceMotion ? ' rm' : ''}`;
  el.style.cssText = `--a:${a};--b:${b};--c:${c};--ad:${shade(a, 0.45)};--tc:${tm && tm.t ? tm.t.c1 : a};--dur:${dur}ms`;
  const n = FX_LITE ? 8 : 16;
  const sparks = Array.from({ length: n }, (_, i) => { const ang = (i / n) * TAU + Math.random() * 0.4, d = 70 + Math.random() * 120; return `<i style="--dx:${(Math.cos(ang) * d).toFixed(0)}px;--dy:${(Math.sin(ang) * d * 0.7).toFixed(0)}px;--d:${(0.12 + Math.random() * 0.15).toFixed(2)}s"></i>`; }).join('');
  el.innerHTML = `<div class="skc-flash"></div><div class="skc-band"><div class="skc-lines"></div><div class="skc-shine"></div></div><div class="skc-tag">SKILL</div>
    <div class="skc-row"><div class="skc-ava">${avatarHTML(p, 'lg')}</div>
    <div class="skc-txt"><small>${esc(tm && tm.t ? tm.t.city : '')} · ${esc(p.name)} · ${esc(o.tag || '스킬 발동!')}</small><b>${esc(S0.nm)}</b><em>“${esc(o.line || F.line)}”</em></div>
    <div class="skc-ico"><div class="skc-rays"></div><span>${S0.ico}</span></div></div><div class="skc-sparks">${sparks}</div>`;
  skHost().appendChild(el);
  SKC.cur = el; SKC.busyUntil = performance.now() + dur;
  AU.skWhoosh(); AU.sk(F.snd);
  if (G.T) { fxFlash(a, 0.22, 420); fxShake(0.5, 0.25); }
  clearTimeout(SKC.timer);
  SKC.timer = setTimeout(() => { el.remove(); if (SKC.cur === el) SKC.cur = null; skCutNext(); }, dur);
}
// 투구가 시작되면 (내가 칠 때) 공을 가리지 않게 컷인을 바로 치움
function skCutClear() {
  SKC.q.length = 0; clearTimeout(SKC.timer); SKC.busyUntil = 0;
  const el = SKC.cur; SKC.cur = null; if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 160); }
}
const skWait = () => Math.max(0, (SKC.busyUntil - performance.now()) / 1000) + (SKC.q.length ? SKC.q.length * 1.5 : 0);
const sideOf = (tm) => (G.T && tm === G.T[G.userSide] ? 'L' : 'R'); // 우리 팀은 왼쪽에서, 상대는 오른쪽에서

/* ---------- ④ 2D 임팩트 재료 ---------- */
function fxShock(x, y, color, maxR = 220, w = 18, life = 0.55, delay = 0) {
  fxFn((g, p, u) => { const v = Math.max(0, (p.t - delay) / (life - delay)); if (v <= 0) return; const e = 1 - (1 - v) ** 3;
    g.globalAlpha = (1 - v) ** 1.5; g.strokeStyle = color; g.lineWidth = w * (1 - v) + 1; g.shadowColor = color; g.shadowBlur = 24;
    g.beginPath(); g.arc(p.x, p.y, 10 + e * maxR, 0, TAU); g.stroke(); }, { x, y, life, add: true });
}
function fxFlames(x, y, n, colors, spread = 1, up = 1) {
  n = Math.round(n * (FX_LITE ? 0.5 : 1));
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6 * spread, sp = (160 + Math.random() * 380) * up, r0 = 8 + Math.random() * 14, col = colors[i % colors.length];
    fxFn((g, p, u, dt) => { p.vx *= 1 - 1.8 * dt; p.vy = p.vy * (1 - 1.5 * dt) - 120 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      const r = p.r0 * (1 - u * 0.7) * (0.8 + u * 0.6), gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      gr.addColorStop(0, `rgba(255,250,220,${0.95 * (1 - u)})`); gr.addColorStop(0.35, rgba(p.c, 0.8 * (1 - u))); gr.addColorStop(1, rgba(p.c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill(); },
    { x: x + (Math.random() - 0.5) * 20, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r0, c: col, life: 0.5 + Math.random() * 0.5, add: true });
  }
}
function fxStarBurst(x, y, text, fill, stroke, size = 120) {
  fxFn((g, p, u) => { const pop = u < 0.15 ? 1.35 * (u / 0.15) : u < 0.25 ? 1.35 - (u - 0.15) * 3.5 : 1; const s = size * pop;
    g.globalAlpha = u > 0.75 ? (1 - u) / 0.25 : 1; g.translate(p.x, p.y); g.rotate(-0.12 + u * 0.08);
    g.beginPath(); for (let i = 0; i < 32; i++) { const r = i % 2 ? s * 0.55 : s * (0.95 + ((i * 37) % 7) / 30); const a = (i / 32) * TAU; g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.78); }
    g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = 7; g.strokeStyle = stroke; g.stroke();
    g.font = `${Math.round(s * 0.42)}px ${FONT_DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = '#1a0a00'; g.strokeText(text, 0, 2); g.fillStyle = '#fff'; g.fillText(text, 0, 2); },
  { x, y, life: 1.1 });
}
function fxShards(x, y, n, colors) {
  n = Math.round(n * (FX_LITE ? 0.5 : 1));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, sp = 250 + Math.random() * 650, s = 6 + Math.random() * 14;
    fxFn((g, p, u, dt) => { p.vy += 900 * dt; p.vx *= 1 - 0.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      g.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1; g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-p.s, -p.s * 0.6); g.lineTo(p.s * 0.9, -p.s * 0.2); g.lineTo(-p.s * 0.2, p.s); g.closePath(); g.fill(); g.stroke(); },
    { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 200, r: Math.random() * 6, vr: (Math.random() - 0.5) * 18, s, c: colors[i % colors.length], life: 0.9 + Math.random() * 0.5 });
  }
}
function fxCracks(x, y, n, color) {
  const lines = Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU + Math.random() * 0.5; const pts = [[0, 0]]; let r = 0; while (r < 160) { r += 18 + Math.random() * 26; const j = (Math.random() - 0.5) * 0.5; pts.push([Math.cos(a + j) * r, Math.sin(a + j) * r]); } return pts; });
  fxFn((g, p, u) => { const v = Math.min(1, u / 0.25); g.globalAlpha = u > 0.6 ? (1 - u) / 0.4 : 1; g.strokeStyle = color; g.lineWidth = 3; g.shadowColor = '#000'; g.shadowBlur = 4;
    lines.forEach((pts) => { const m = Math.max(2, Math.ceil(pts.length * v)); g.beginPath(); g.moveTo(p.x, p.y); for (let i = 1; i < m; i++) g.lineTo(p.x + pts[i][0], p.y + pts[i][1]); g.stroke(); }); },
  { x, y, life: 1 });
}
function fxArcs(x, y, n, c1, c2) {
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1, r0 = 70 + i * 22;
    fxFn((g, p, u) => { const r = p.r0 * (1 - u * 0.75); g.globalAlpha = 1 - u; g.strokeStyle = p.c; g.lineWidth = 4; g.shadowColor = p.c; g.shadowBlur = 16;
      g.beginPath(); g.arc(p.x + p.side * r * 0.35, p.y, r, p.side > 0 ? -Math.PI / 2 : Math.PI / 2, p.side > 0 ? Math.PI / 2 : Math.PI * 1.5); g.stroke(); },
    { x, y, r0, side, c: side > 0 ? c2 : c1, life: 0.7, add: true });
  }
}
function fxTargets(x, y, color) {
  for (let i = 0; i < 3; i++) fxShock(x, y, color, 70 + i * 60, 6, 0.75 + i * 0.12, i * 0.1);
  fxFn((g, p, u) => { g.globalAlpha = 1 - u; g.strokeStyle = color; g.lineWidth = 3; const L = 40 + u * 90;
    g.beginPath(); g.moveTo(p.x - L, p.y); g.lineTo(p.x - 14, p.y); g.moveTo(p.x + 14, p.y); g.lineTo(p.x + L, p.y); g.moveTo(p.x, p.y - L); g.lineTo(p.x, p.y - 14); g.moveTo(p.x, p.y + 14); g.lineTo(p.x, p.y + L); g.stroke(); },
  { x, y, life: 0.8, add: true });
}
function fxGlint(x, y, color, size = 120, life = 0.8) {
  fxFn((g, p, u) => { const s = p.size * Math.sin(Math.min(1, u * 2.2) * Math.PI / 2) * (1 - u * 0.4); g.globalAlpha = 1 - u; g.translate(p.x, p.y); g.rotate(u * 1.2);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.35); gr.addColorStop(0, '#fff'); gr.addColorStop(1, rgba(p.c, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, s * 0.35, 0, TAU); g.fill();
    g.fillStyle = '#fff'; for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -4); g.lineTo(s, 0); g.lineTo(0, 4); g.closePath(); g.fill(); } },
  { x, y, size, c: color, life, add: true });
}
function fxBolt(x0, y0, x1, y1, color, life = 0.32, w = 4) {
  const pts = [], n = 9; for (let i = 0; i <= n; i++) { const t = i / n, j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 46; pts.push([x0 + (x1 - x0) * t + j, y0 + (y1 - y0) * t + j * 0.4]); }
  fxFn((g, p, u) => { g.globalAlpha = (1 - u) * (Math.random() < 0.2 ? 0.4 : 1); g.lineJoin = 'round';
    [[w * 3, p.c, 22], [w, '#fff', 0]].forEach(([lw, col, bl]) => { g.lineWidth = lw; g.strokeStyle = col; g.shadowColor = p.c; g.shadowBlur = bl; g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); }); },
  { c: color, life, add: true });
}
function fxHex(x, y, color, size = 60, life = 0.6) {
  fxFn((g, p, u) => { const s = p.size * (0.8 + u * 0.6); g.globalAlpha = (1 - u) * 0.9; g.strokeStyle = p.c; g.fillStyle = rgba(p.c, 0.12 * (1 - u)); g.lineWidth = 3; g.shadowColor = p.c; g.shadowBlur = 14;
    g.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + Math.PI / 6; g.lineTo(p.x + Math.cos(a) * s, p.y + Math.sin(a) * s); } g.closePath(); g.fill(); g.stroke(); },
  { x, y, size, c: color, life, add: true });
}
function fxRipples(x, y, color, n = 3, size = 1) {
  for (let i = 0; i < n; i++) fxFn((g, p, u) => { const v = Math.max(0, u - p.d); if (v <= 0) return; const r = (20 + v * 160) * size; g.globalAlpha = (1 - v) * 0.9; g.strokeStyle = p.c; g.lineWidth = 3; g.shadowColor = p.c; g.shadowBlur = 10;
    g.beginPath(); g.ellipse(p.x, p.y, r, r * 0.38, 0, 0, TAU); g.stroke(); }, { x, y, c: color, d: i * 0.15, life: 1, add: true });
}
function fxSparkles(x, y, n, colors, spread = 90) {
  n = Math.round(n * (FX_LITE ? 0.5 : 1));
  for (let i = 0; i < n; i++) fxFn((g, p, u) => { const s = p.s * Math.sin(u * Math.PI); g.globalAlpha = 1; g.fillStyle = p.c; g.shadowColor = p.c; g.shadowBlur = 10; g.translate(p.x, p.y - u * 30); g.rotate(u * 3);
    g.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? s * 0.28 : s; const a = (k / 8) * TAU; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); },
  { x: x + (Math.random() - 0.5) * spread * 2, y: y + (Math.random() - 0.5) * spread, s: 5 + Math.random() * 9, c: colors[i % colors.length], life: 0.5 + Math.random() * 0.6, add: true });
}
function fxBigIcon(x, y, ico, size = 90) {
  fxFn((g, p, u) => { const pop = u < 0.18 ? (u / 0.18) * 1.3 : u < 0.3 ? 1.3 - (u - 0.18) * 2.5 : 1; g.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1; g.font = `${Math.round(p.size * pop)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#fff'; g.shadowBlur = 20; g.fillText(p.ico, p.x, p.y - u * 30); }, { x, y, ico, size, life: 1.2 });
}

// 스킬별 임팩트 (배트에 맞은 순간 · 삼진 · 도루 성공 등)
function skImpact(id, x, y, big = 1) {
  if (!skOn()) return;
  const F = SKFX[id]; if (!F) return; const [a, b, c] = F.c, s = big;
  const kind = F.hit || F.trail;
  if (kind === 'blast') { fxFlash('#7c1fff', 0.5, 520); fxShake(1.8 * s, 0.65); [0, 0.07, 0.15].forEach((d, i) => fxShock(x, y, [a, b, c][i], 260 * s, 22, 0.75, d)); fxSparks(x, y, 40, [a, b, c, '#fff'], 1.3); fxText(x, y - 70, 'BOOM!', b, 64); }
  else if (kind === 'flame') { fxFlash('#ff5a1f', 0.38, 460); fxShake(1 * s, 0.4); fxFlames(x, y, 46, [a, b, c], 1.1, 1.3); fxShock(x, y, b, 180, 14); }
  else if (kind === 'pow') { fxShake(1.2 * s, 0.35); fxStarBurst(x, y - 10, 'POW!', b, a, 120 * s); fxSparks(x, y, 22, [a, b, '#fff'], 1); }
  else if (kind === 'rock') { fxShake(1.1 * s, 0.4); fxCracks(x, y, 9, '#f5f5f4'); fxShards(x, y, 22, ['#78716c', '#a8a29e', '#d6d3d1', '#57534e']); fxShock(x, y, c, 150, 10); }
  else if (kind === 'magnet') { fxArcs(x, y, 8, a, b); fxSparks(x, y, 24, [a, b, '#fff'], 0.9); fxBigIcon(x, y - 60, '🧲', 70); }
  else if (kind === 'target') { fxTargets(x, y, a); fxSparkles(x, y, 16, [a, b, '#fff']); }
  else if (kind === 'glint') { fxGlint(x, y, a, 160); fxFlash(b, 0.25, 360); fxSparkles(x, y, 14, [a, '#fff']); }
  else if (kind === 'bolt') { fxFlash(c, 0.4, 300); for (let i = 0; i < 4; i++) fxBolt(x + (Math.random() - 0.5) * 220, -10, x, y, i % 2 ? a : c, 0.35, 4); fxShock(x, y, a, 160, 12); fxSparks(x, y, 26, [a, b, '#fff'], 1.1); }
  else if (kind === 'fire') { fxFlames(x, y, 40, [a, b, c], 1.4, 1.1); fxShock(x, y, a, 170, 14); fxFlash(a, 0.3, 380); }
  else if (kind === 'magic') { fxSparkles(x, y, 34, [a, b, c], 120); for (let i = 0; i < 3; i++) fxShock(x, y, i % 2 ? b : a, 120 + i * 40, 6, 0.8, i * 0.1); fxFlash(a, 0.28, 380); }
  else if (kind === 'laser') { fxTargets(x, y, a); fxGlint(x, y, a, 110, 0.6); }
  else if (kind === 'dust') { fxShards(x, y, 18, ['#a47148', '#c08552', '#e6ccb2']); fxRipples(x, y + 20, b, 2, 1.2); }
  else if (kind === 'shield') { fxHex(x, y, a, 70, 0.8); fxHex(x, y, b, 100, 0.95); fxShock(x, y, a, 150, 10); fxFlash(a, 0.25, 380); }
  else if (kind === 'gold') { fxFlash('#ffd84a', 0.35, 420); fxSparkles(x, y, 30, [a, '#fff3b0', '#fff'], 120); fxShock(x, y, a, 200, 16); fxBigIcon(x, y - 70, '🔒', 80); }
  else if (kind === 'snake') { fxShock(x, y, a, 140, 12); fxSparkles(x, y, 18, [a, b]); fxBigIcon(x, y - 60, '🐍', 72); }
  else if (kind === 'wave') { fxRipples(x, y, a, 4, 1.4); fxRipples(x, y, b, 3, 0.9); fxSparkles(x, y, 16, [a, b, '#fff']); }
  else { fxShock(x, y, a, 160, 12); fxSparkles(x, y, 16, [a, b, c]); }
}

/* ---------- ② 3D 오라 ---------- */
const AURA = (() => {
  const rc = makeCanvas(256, 256), g = rc.getContext('2d');
  // 바닥 고리: 밝은 테두리 + 룬 같은 눈금 + 안쪽 은은한 빛
  const gr = g.createRadialGradient(128, 128, 30, 128, 128, 126); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(0.75, 'rgba(255,255,255,0.05)'); gr.addColorStop(0.86, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.92, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3;
  for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, r0 = i % 3 ? 86 : 78; g.beginPath(); g.moveTo(128 + Math.cos(a) * r0, 128 + Math.sin(a) * r0); g.lineTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96); g.stroke(); }
  g.lineWidth = 2; g.beginPath(); g.arc(128, 128, 60, 0, TAU); g.stroke();
  const ringTex = canvasTex(rc, { nomip: true });
  const bc = makeCanvas(8, 128), bg = bc.getContext('2d'), bgr = bg.createLinearGradient(0, 128, 0, 0);
  bgr.addColorStop(0, 'rgba(255,255,255,0.75)'); bgr.addColorStop(0.35, 'rgba(255,255,255,0.25)'); bgr.addColorStop(1, 'rgba(255,255,255,0)'); bg.fillStyle = bgr; bg.fillRect(0, 0, 8, 128);
  const beamTex = canvasTex(bc, { nomip: true });
  const ringGeo = new T.PlaneGeometry(2.4, 2.4), beamGeo = new T.CylinderGeometry(0.42, 0.66, 2.4, 22, 1, true); beamGeo.translate(0, 1.2, 0);
  const mk = () => {
    const grp = new T.Group(); grp.visible = false;
    const am = (map) => new T.MeshBasicMaterial({ map, color: 0xffffff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false });
    const ring = new T.Mesh(ringGeo, am(ringTex)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
    const ring2 = new T.Mesh(ringGeo, am(ringTex)); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.06; ring2.scale.setScalar(0.6);
    const beam = new T.Mesh(beamGeo, am(beamTex));
    grp.add(ring, ring2, beam);
    const motes = [];
    for (let i = 0; i < 12; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, fog: false })); s.u = Math.random(); s.a = Math.random() * TAU; s.sp = 0.35 + Math.random() * 0.4; grp.add(s); motes.push(s); }
    scene.add(grp);
    return { grp, ring, ring2, beam, motes, k: 0, pulse: 0, fig: null, id: null };
  };
  return { list: Array.from({ length: 5 }, mk), t: 0 };
})();
function skArmed(p, bat) {
  if (!p || !p.skill) return 0;
  const risp = !!(G.bases[1] || G.bases[2]);
  if (bat) return (p.skill === 'clutch' && risp) || (p.skill === 'first' && G.b === 0 && G.s === 0) || (p.skill === 'tough' && G.s === 2) ? 1 : 0.42;
  return (p.skill === 'escape' && risp) || (p.skill === 'closer' && closerOn()) ? 1 : 0.42;
}
// 타자·투수 줄의 스킬 배지: 상황 스킬이 준비되면 "해결사 준비!"처럼 빛나는 알약으로
function skBadge(p, armed) {
  const S0 = p && SKILLS[p.skill]; if (!S0) return '';
  return armed && skOn() ? ` <i class="skb on" style="--ska:${SKFX[p.skill].c[0]}" title="${S0.nm}">${S0.ico} ${S0.nm} 준비!</i>` : ` <i class="skb" title="${S0.nm}">${S0.ico}</i>`;
}
// 상황 스킬이 준비 상태로 바뀌는 순간: 배지 갱신 + 딩동 + 오라 번쩍
function skArmWatch() {
  if (!G.T || G.prac || !['ready', 'aim', 'meter'].includes(G.phase)) return;
  const b = curBatter(), p = fieldTeam().pitcher, ab = !!b && skArmed(b, true) >= 1, ap = !!p && skArmed(p, false) >= 1;
  if (ab === !!G.skArmB && ap === !!G.skArmP) return;
  const on = (ab && !G.skArmB) || (ap && !G.skArmP);
  G.skArmB = ab; G.skArmP = ap; updateLines();
  if (on && skOn()) { AU.skReady(); if (ab) skPulse(G.batFig); if (ap) skPulse(FIG.P); }
}
function skPulse(fig) { const a = AURA.list.find((x) => x.fig === fig); if (a) a.pulse = 1; }
function skAuraTick(dt) {
  AURA.t += dt;
  const want = [];
  const ph = G.phase, live = G.T && skOn() && !G.prac && ['ready', 'aim', 'meter', 'windup', 'flight', 'call', 'pko', 'intro'].includes(ph);
  if (live) {
    const b = curBatter(), p = fieldTeam().pitcher;
    if (b && b.skill && G.batFig && G.batFig.root.visible) want.push([G.batFig, b.skill, skArmed(b, true)]);
    if (p && p.skill && FIG.P.root.visible) want.push([FIG.P, p.skill, skArmed(p, false)]);
    G.runFig.forEach((f, k) => { const r = G.bases[k]; if (f && r && r.skill && f.root.visible) want.push([f, r.skill, G.steal && G.steal.who === r ? 1 : 0.4]); });
  }
  AURA.list.forEach((a) => { a.target = 0; });
  want.forEach(([fig, id, k]) => {
    let a = AURA.list.find((x) => x.fig === fig) || AURA.list.find((x) => !x.fig || x.k < 0.02 && !want.some((w) => w[0] === x.fig));
    if (!a) return;
    if (a.fig !== fig || a.id !== id) { a.fig = fig; a.id = id; const col = new T.Color(SKFX[id].c[0]), col2 = new T.Color(SKFX[id].c[1]); a.ring.material.color.copy(col); a.ring2.material.color.copy(col2); a.beam.material.color.copy(col); a.motes.forEach((m, i) => m.material.color.copy(i % 2 ? col2 : col)); }
    a.target = k;
  });
  AURA.list.forEach((a) => {
    a.k += ((a.target || 0) - a.k) * Math.min(1, dt * 5); a.pulse = Math.max(0, a.pulse - dt * 1.2);
    const vis = a.k > 0.02 && a.fig; a.grp.visible = !!vis; if (!vis) { if (a.k <= 0.02) a.fig = null; return; }
    const pos = a.fig.root.position; a.grp.position.set(pos.x, pos.y, pos.z);
    const k = Math.min(1.4, a.k + a.pulse), t = AURA.t, armed = a.target >= 1;
    a.ring.rotation.z += dt * (armed ? 2.2 : 0.8); a.ring2.rotation.z -= dt * (armed ? 3 : 1.1);
    const sc = 1 + Math.sin(t * (armed ? 6 : 2.5)) * 0.06 + a.pulse * 0.5; a.ring.scale.setScalar(sc);
    a.ring.material.opacity = 0.55 * k; a.ring2.material.opacity = 0.45 * k;
    a.beam.material.opacity = (armed ? 0.32 : 0.14) * k * (0.85 + Math.sin(t * 9) * 0.15); a.beam.scale.set(1 + a.pulse * 0.5, 1 + a.pulse * 0.6, 1 + a.pulse * 0.5);
    a.motes.forEach((m) => { m.u += dt * m.sp * (armed ? 1.6 : 1); if (m.u > 1) { m.u -= 1; m.a = Math.random() * TAU; }
      const r = 0.55 + Math.sin(m.u * 6 + m.a) * 0.15; m.position.set(Math.cos(m.a + m.u * 3) * r, 0.1 + m.u * 2.3, Math.sin(m.a + m.u * 3) * r);
      m.scale.setScalar((armed ? 0.24 : 0.16) * (1 - m.u * 0.5)); m.material.opacity = Math.sin(m.u * Math.PI) * 0.9 * k; });
  });
}

/* ---------- ③ 투구 꼬리 ---------- */
const _skv = new T.Vector3();
function ballScreen() {
  const s = toScreen(ball.m.position); if (!s.ok) return null;
  _skv.copy(ball.m.position); _skv.y += 0.05; const s2 = toScreen(_skv);
  s.r = clamp(Math.abs(s2.y - s.y), 1.5, 40); return s;
}
let _trT = 0;
function skTrailTick(dt) {
  if (!skOn()) return;
  // 투구 중 꼬리
  const P = G.pitch, kind = P && P.skfx;
  if (kind && (G.phase === 'flight') && ball.m.visible) {
    const s = ballScreen(); if (!s) return;
    const F = SKFX[P.skId], [a, b, c] = F.c, r = s.r;
    _trT += dt;
    if (kind === 'fire') fxFlames(s.x, s.y, 2, [a, b, c], 3, 0.25 * Math.max(0.5, r / 6));
    else if (kind === 'magic') { const ang = AURA.t * 18; fxSparkles(s.x + Math.cos(ang) * r * 2.4, s.y + Math.sin(ang) * r * 2.4, 1, [a, b, c], 2); fxSparkles(s.x - Math.cos(ang) * r * 2.4, s.y - Math.sin(ang) * r * 2.4, 1, [b, a], 2); }
    else if (kind === 'gold') { fxSparkles(s.x, s.y, 2, [a, '#fff3b0', '#ffffff'], r * 2); }
    else if (kind === 'wave') { if (_trT > 0.06) { _trT = 0; fxRipples(s.x, s.y, a, 1, Math.max(0.15, r / 14)); } }
    else if (kind === 'shield') { if (_trT > 0.08) { _trT = 0; fxHex(s.x, s.y, a, r * 3.2, 0.35); } }
    else if (kind === 'dust') { if (_trT > 0.05) { _trT = 0; fxFn((g, p, u) => { g.globalAlpha = (1 - u) * 0.35; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r0 * (1 + u * 2), 0, TAU); g.fill(); }, { x: s.x, y: s.y, r0: r * 1.6, c: b, life: 0.5 }); } }
    else if (kind === 'laser') { fxFn((g, p, u) => { g.globalAlpha = 1 - u; g.strokeStyle = p.c; g.lineWidth = p.w * (1 - u); g.shadowColor = p.c; g.shadowBlur = 12; g.beginPath(); g.arc(p.x, p.y, p.w, 0, TAU); g.stroke(); }, { x: s.x, y: s.y, w: Math.max(2, r * 1.3), c: a, life: 0.25, add: true }); }
  }
  // 견제 달인의 견제구: 초록 뱀 꼬리
  if (G.pko && G.pko.sk && ball.m.visible) { const s = ballScreen(); if (s) fxSparkles(s.x, s.y, 2, ['#16a34a', '#86efac'], 6); }
  // 대도 도루: 주자 뒤로 번개
  if (G.steal && G.steal.who && G.steal.who.skill === 'speed' && G.steal.fig && skOn()) {
    const f = G.steal.fig.root.position; _skv.set(f.x, f.y + 1, f.z); const s = toScreen(_skv);
    if (s.ok) { if (SKC.lastS && Math.random() < 0.7) fxBolt(SKC.lastS.x, SKC.lastS.y, s.x, s.y, Math.random() < 0.5 ? '#ffcc00' : '#6fd8ff', 0.22, 2.5); SKC.lastS = s; }
  } else SKC.lastS = null;
}
function skfxTick(dt) { skAuraTick(dt); skTrailTick(dt); skArmWatch(); }

/* ---------- 경기 이벤트에 연결 ---------- */
const HITK = { '1B': 1, '2B': 1, '3B': 1, HR: 1, IFH: 1, BUNT_HIT: 1 };
// 타석 시작: 스킬 투수 첫 등판 · 스킬 타자 첫 등장 · 해결사 득점권 준비
function skOnPA() {
  if (!G.T || G.prac) return;
  const b = curBatter(), p = fieldTeam().pitcher, bt = batTeam(), ft = fieldTeam();
  G.paRisp = !!(G.bases[1] || G.bases[2]);
  if (p.skill && !p.g.skIntro) { p.g.skIntro = 1; skCutIn(p, ft, { tag: p.skill === 'closer' && closerOn() ? '세이브 상황 등판!' : '마운드에 오른다', side: sideOf(ft), pos: 'mid' }); }
  if (b.skill) {
    const first = !b.g.skIntro; b.g.skIntro = 1;
    if (b.skill === 'clutch' && G.paRisp) skCutIn(b, bt, { tag: '해결사 모드!', line: '찬스다… 내가 끝낸다!', side: sideOf(bt), pos: 'mid' });
    else if (first) skCutIn(b, bt, { tag: '타석에 들어선다', side: sideOf(bt), pos: 'mid' });
    if (b.skill === 'tough' && G.s === 2) { /* 2스트라이크 때는 오라만 밝아짐 */ }
  }
}
// 공을 던지는 순간: 꼬리 종류 정하고, 손끝에서 작은 폭발
function skOnRelease(P, p) {
  P.skfx = null; P.skId = null;
  if (!p.skill || !skOn() || G.prac) return;
  const F = SKFX[p.skill], fast = { FB: 1, TS: 1, CT: 1 }[P.type], brk = S.PITCHES[P.type].brk, risp = !!(G.bases[1] || G.bases[2]);
  const on = (p.skill === 'heat' && fast) || (p.skill === 'magic' && brk) || p.skill === 'ctrl' || (p.skill === 'gb' && (P.type === 'TS' || P.type === 'CT' || P.type === 'FK' || P.type === 'CH'))
    || (p.skill === 'escape' && risp) || (p.skill === 'closer' && closerOn()) || p.skill === 'sub';
  if (!on || !F.trail) return;
  P.skfx = F.trail; P.skId = p.skill;
  ball.setTint(F.c[0]);
  const s = ballScreen();
  if (s) {
    if (F.trail === 'wave') fxRipples(s.x, s.y + 10, F.c[0], 3, 0.5);
    else if (F.trail === 'fire') fxFlames(s.x, s.y, 14, F.c, 2, 0.6);
    else if (F.trail === 'laser' && userPitching()) { const t = toScreen({ x: P.aim.x, y: P.aim.y, z: 0 }); if (t.ok) { fxFn((g, q, u) => { g.globalAlpha = (1 - u) * 0.9; g.strokeStyle = q.c; g.lineWidth = 3; g.shadowColor = q.c; g.shadowBlur = 16; g.setLineDash([10, 6]); g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x1, q.y1); g.stroke(); }, { x: s.x, y: s.y, x1: t.x, y1: t.y, c: F.c[0], life: 0.5, add: true }); fxTargets(t.x, t.y, F.c[0]); } }
    else fxSparkles(s.x, s.y, 8, F.c, 10);
  }
  skPulse(FIG.P);
}
// 타구 결과가 나온 순간 (startPlay): 성공한 스킬 타격이면 임팩트 + 컷인, 땅볼 유도 투수의 병살이면 투수 컷인
function skOnPlay(res, sw, b, bt) {
  if (!G.T || G.prac || res.kind === 'FOUL') return;
  const cp = G.lastCp ? toScreen(G.lastCp) : null, x = cp && cp.ok ? cp.x : FX.w / 2, y = cp && cp.ok ? cp.y : FX.h * 0.5;
  const ft = fieldTeam(), p = ft.pitcher;
  if (res.kind === 'DP' && p.skill === 'gb') { skImpact('gb', x, y, 1); later(0.5, () => skCutIn(p, ft, { tag: '병살 유도!', side: sideOf(ft), pos: 'low', count: true })); }
  const id = b.skill; if (!id) return;
  const hit = HITK[res.kind], big = res.kind === 'HR' ? 1.5 : res.kind === '2B' || res.kind === '3B' ? 1.2 : 1;
  const tagged = !!sw.sk;
  // 발동 조건: 상황 스킬은 실제로 보너스를 받은 타구(sw.sk), 항상 켜진 스킬은 안타일 때
  const success = hit && (tagged || id === 'contact' || id === 'eye' || (id === 'speed' && (res.kind === 'IFH' || res.kind === 'BUNT_HIT' || res.kind === '3B')))
    || (res.kind === 'SF' && id === 'clutch' && tagged);
  if (tagged || success) { skImpact(id, x, y, big); skPulse(G.batFig); }
  if (success && res.kind === 'HR' && skOn()) {
    G.slowT = 1.25; const z = $('#skZoom'); z.style.setProperty('--zd', '1.6s'); z.classList.remove('go'); void z.offsetWidth; z.classList.add('go');
    const cols = SKFX[id].c;
    for (let i = 0; i < (FX_LITE ? 4 : 8); i++) later(1.2 + i * 0.22, () => { burst(rnd(-60, 60), rnd(50, 82), rnd(-160, -115), cols[i % 3], 130, { kind: i % 3 === 1 ? 'ring' : null }); AU.boom(); });
  }
  if (success) {
    const tag = res.kind === 'HR' ? '홈런!' : res.kind === 'IFH' || res.kind === 'BUNT_HIT' ? '내야안타!' : res.kind === 'SF' ? '희생플라이!' : `${{ '1B': '안타', '2B': '2루타', '3B': '3루타' }[res.kind] || '안타'}!`;
    later(res.kind === 'HR' ? 1.4 : 0.45, () => skCutIn(b, bt, { tag: `${tag}`, side: sideOf(bt), pos: 'low', count: true }));
  }
}
// 삼진: 스킬 투수면 스킬색 임팩트 + 컷인
function skOnK(pit) {
  if (!pit.skill || G.prac) return;
  const ft = fieldTeam(), cr = G.pitch && G.pitch.cross, s = cr ? toScreen({ x: cr.x, y: cr.y, z: 0 }) : null;
  skImpact(pit.skill, s && s.ok ? s.x : FX.w / 2, s && s.ok ? s.y : FX.h * 0.45, 1);
  skPulse(FIG.P);
  if (['heat', 'magic', 'ctrl', 'closer', 'sub'].includes(pit.skill)) later(0.5, () => skCutIn(pit, ft, { tag: '삼진!', side: sideOf(ft), pos: 'mid', count: true }));
}
function skOnWalk(b) { if (b.skill === 'eye' && !G.prac) { const bt = batTeam(); skImpact('eye', FX.w / 2, FX.h * 0.42, 1); later(0.3, () => skCutIn(b, bt, { tag: '볼넷 골라냄!', line: '그런 공엔 안 속는다', side: sideOf(bt), pos: 'mid', count: true })); } }
function skOnSteal(r, ok, k) {
  if (G.prac) return; const bt = batTeam(), ft = fieldTeam(), p = ft.pitcher;
  const bp = S.basePos(k + 2), s = toScreen({ x: bp.x, y: 0.5, z: bp.z }), x = s.ok ? s.x : FX.w / 2, y = s.ok ? s.y : FX.h / 2;
  if (ok && r.skill === 'speed') { skImpact('speed', x, y, 1); later(0.3, () => skCutIn(r, bt, { tag: `${k + 2}루 도루 성공!`, side: sideOf(bt), pos: 'mid', count: true })); }
  else if (!ok && p.skill === 'pickoff') { skImpact('pickoff', x, y, 1); later(0.3, () => skCutIn(p, ft, { tag: '도루 저지!', side: sideOf(ft), pos: 'mid', count: true })); }
}
function skOnPickoffStart(p) { if (G.pko) G.pko.sk = p.skill === 'pickoff' && skOn(); if (p.skill === 'pickoff') skPulse(FIG.P); }
function skOnPickoffOut(p, k) {
  if (p.skill !== 'pickoff') return; const ft = fieldTeam();
  const bp = S.basePos(k + 1), s = toScreen({ x: bp.x, y: 0.5, z: bp.z }); skImpact('pickoff', s.ok ? s.x : FX.w / 2, s.ok ? s.y : FX.h / 2, 1);
  later(0.3, () => skCutIn(p, ft, { tag: '견제사!', side: sideOf(ft), pos: 'mid', count: true }));
}
// 이닝 마지막 아웃 때 득점권 주자를 남겼으면 위기관리 성공
function skOnInningEnd() {
  const ft = fieldTeam(), p = ft && ft.pitcher;
  if (p && p.skill === 'escape' && G.paRisp && !G.prac) { skImpact('escape', FX.w / 2, FX.h * 0.45, 1.2); skCutIn(p, ft, { tag: '위기 탈출!', side: sideOf(ft), pos: 'mid', count: true }); }
}
// 반 이닝 시작: 이닝이터가 3회 넘게 던지고 있으면 한마디
function skOnHalfStart() {
  const ft = fieldTeam(), p = ft && ft.pitcher;
  if (p && p.skill === 'eater' && p.g.outs >= 6 && !G.prac) later(2.4, () => { if (skOn()) { fxText(FX.w / 2, FX.h * 0.3, '⏱️ 이닝이터 · 아직 쌩쌩!', '#bbf7d0', 26); skPulse(FIG.P); } });
}
