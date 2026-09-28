/* ===================== 화면 이펙트 (순수 연출 — 경기 결과에 영향 없음) ===================== */
// 주의: 여기서는 Math.random만 쓴다. GR(경기 난수)을 쓰면 온라인 대전에서 두 기기가 어긋남
const FX = { cv: $('#fx'), g: null, P: [], w: 0, h: 0, dpr: 1, shake: 0, shakeT: 0, shakeD: 1, dirty: false, flash: $('#fxFlash') };
FX.g = FX.cv.getContext('2d');
const rnd = (a, b) => a + Math.random() * (b - a);
const FX_LITE = lowEnd || reduceMotion;
function fxResize() {
  FX.dpr = Math.min(window.devicePixelRatio || 1, lowEnd ? 1 : 1.5);
  FX.w = innerWidth; FX.h = innerHeight;
  FX.cv.width = Math.round(FX.w * FX.dpr); FX.cv.height = Math.round(FX.h * FX.dpr);
}
fxResize(); addEventListener('resize', fxResize);
const _fxv = new T.Vector3();
function toScreen(p) {
  _fxv.set(p.x, p.y, p.z).project(camera);
  return { x: (_fxv.x + 1) / 2 * FX.w, y: (1 - _fxv.y) / 2 * FX.h, ok: _fxv.z < 1 };
}
function fxAdd(p) {
  // 파티클이 꽉 차면 색종이를 먼저 버리고 글자·불꽃·링은 꼭 보여 줌
  if (FX.P.length >= (FX_LITE ? 220 : 520)) {
    if (p.k === 'c') return;
    const i = FX.P.findIndex((q) => q.k === 'c'); if (i < 0) return;
    FX.P.splice(i, 1);
  }
  FX.P.push(p);
}

/* ---- 파티클 종류 ---- */
function fxConfetti(n, colors, o = {}) {
  n = Math.round(n * (FX_LITE ? 0.45 : 1));
  for (let i = 0; i < n; i++) {
    const fromX = o.x != null ? o.x : rnd(0, FX.w), fromY = o.y != null ? o.y : rnd(-FX.h * 0.25, -10);
    const a = o.x != null ? rnd(-Math.PI * 0.95, -Math.PI * 0.05) : Math.PI / 2, sp = o.x != null ? rnd(260, 720) : rnd(40, 160);
    fxAdd({ k: 'c', x: fromX, y: fromY, vx: Math.cos(a) * sp + rnd(-30, 30), vy: Math.sin(a) * sp, r: rnd(0, 6.3), vr: rnd(-9, 9),
      w: rnd(6, 11), h: rnd(3, 6), c: colors[i % colors.length], life: rnd(2.6, 4.2), t: 0, wob: rnd(0, 6.3) });
  }
}
function fxSparks(x, y, n, colors, spd = 1) {
  n = Math.round(n * (FX_LITE ? 0.5 : 1));
  for (let i = 0; i < n; i++) {
    const a = rnd(0, Math.PI * 2), sp = rnd(260, 900) * spd;
    fxAdd({ k: 's', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, c: colors[i % colors.length], life: rnd(0.25, 0.6), t: 0, lw: rnd(1.5, 3.5) });
  }
}
function fxRing(x, y, color, size = 1) { fxAdd({ k: 'r', x, y, c: color, life: 0.55, t: 0, s: size }); }
function fxText(x, y, text, color, size = 34) { fxAdd({ k: 't', x, y, text, c: color, life: 1.4, t: 0, s: size }); }
function fxShake(amp, dur = 0.45) { if (reduceMotion) return; if (amp >= FX.shake * (FX.shakeT / FX.shakeD || 0)) { FX.shake = amp; FX.shakeT = FX.shakeD = dur; } }
function fxFlash(color, strength = 0.6, ms = 380) {
  if (reduceMotion) strength *= 0.4;
  const f = FX.flash; f.style.setProperty('--fc', color); f.style.setProperty('--fs', strength); f.style.setProperty('--fd', ms + 'ms');
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}
function fxApplyShake() {
  if (FX.shakeT <= 0) return;
  const k = (FX.shakeT / FX.shakeD) ** 2 * FX.shake;
  camera.position.x += rnd(-1, 1) * k * 0.35; camera.position.y += rnd(-1, 1) * k * 0.25;
  camera.rotateZ(rnd(-1, 1) * k * 0.012);
}
function fxTick(dt) {
  if (FX.shakeT > 0) FX.shakeT = Math.max(0, FX.shakeT - dt);
  const g = FX.g, P = FX.P;
  if (!P.length) { if (FX.dirty) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, FX.cv.width, FX.cv.height); FX.dirty = false; } return; }
  FX.dirty = true;
  g.setTransform(FX.dpr, 0, 0, FX.dpr, 0, 0); g.clearRect(0, 0, FX.w, FX.h);
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.t += dt;
    if (p.t >= p.life) { P.splice(i, 1); continue; }
    const u = p.t / p.life;
    if (p.k === 'c') {
      p.vy += 520 * dt; p.vx *= 1 - 1.6 * dt; p.vy *= 1 - 1.3 * dt; p.wob += dt * 7;
      p.x += (p.vx + Math.sin(p.wob) * 40) * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      g.save(); g.globalAlpha = u > 0.8 ? (1 - u) / 0.2 : 1; g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.cos(p.wob * 1.3));
      g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
    } else if (p.k === 's') {
      p.vx *= 1 - 3.5 * dt; p.vy = p.vy * (1 - 3.5 * dt) + 380 * dt;
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = 1 - u; g.strokeStyle = p.c; g.lineWidth = p.lw * (1 - u * 0.6); g.lineCap = 'round';
      g.beginPath(); g.moveTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); g.lineTo(nx, ny); g.stroke();
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      p.x = nx; p.y = ny;
    } else if (p.k === 'r') {
      const e = 1 - (1 - u) ** 3;
      g.globalAlpha = 1 - u; g.strokeStyle = p.c; g.lineWidth = 10 * (1 - u) * p.s + 1;
      g.beginPath(); g.arc(p.x, p.y, (20 + e * 150) * p.s, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    } else if (p.k === 't') {
      const e = Math.min(1, p.t / 0.18), sc = 0.6 + 0.4 * (1 - (1 - e) ** 3) + (e < 1 ? 0 : Math.max(0, 0.15 - (p.t - 0.18)) * 0.8);
      g.save(); g.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1; g.translate(p.x, p.y - p.t * 46); g.scale(sc, sc);
      g.font = `${p.s}px ${FONT_DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 6; g.strokeStyle = 'rgba(5,10,30,0.85)'; g.strokeText(p.text, 0, 0);
      g.fillStyle = p.c; g.shadowColor = p.c; g.shadowBlur = 14; g.fillText(p.text, 0, 0); g.restore();
    }
  }
}

/* ---- 경기 이벤트 연출 ---- */
const GOLD = ['#ffd84a', '#ffb627', '#fff3b0', '#ffffff', '#ff8a3d'];
function teamCols(tm) { return tm ? [tm.t.c1, tm.t.c2, '#ffffff', '#ffd84a'] : GOLD; }
// 배트에 공이 맞는 순간: 타구 속도가 빠를수록 크게
function fxContact(cp, ev, foul) {
  const s = toScreen(cp); if (!s.ok) return;
  const q = clamp((ev - 90) / 80, 0, 1);
  if (foul && ev < 100) { fxSparks(s.x, s.y, 8, ['#ffffff'], 0.5); return; }
  fxSparks(s.x, s.y, 14 + Math.round(q * 26), q > 0.6 ? GOLD : ['#ffffff', '#fff3b0', '#9fdcff'], 0.6 + q * 0.7);
  fxRing(s.x, s.y, q > 0.6 ? '#ffd84a' : '#ffffff', 0.5 + q * 0.7);
  if (q > 0.35) { fxShake(0.4 + q * 1.1, 0.3 + q * 0.25); fxFlash('#fff6d8', 0.12 + q * 0.3, 260); }
}
function fxHit(kind, tm) {
  const big = kind === '3B' ? 1.3 : kind === '2B' ? 1 : 0.6;
  fxConfetti(24 * big, teamCols(tm), { x: FX.w / 2, y: FX.h * 0.42 });
  fxText(FX.w / 2, FX.h * 0.3, kind === '3B' ? '3루타!' : kind === '2B' ? '2루타!' : '안타!', kind === '1B' || kind === 'IFH' || kind === 'BUNT_HIT' ? '#9fe8ff' : '#ffd84a', 40 + big * 10);
}
function fxHomeRun(tm) {
  const cols = teamCols(tm).concat(GOLD);
  fxFlash('#fff2c2', 0.75, 520); fxShake(2.2, 0.9);
  setTimeout(() => fxFlash('#ffd84a', 0.35, 420), 260);
  fxConfetti(160, cols);
  setTimeout(() => fxConfetti(90, cols), 900);
  fxConfetti(50, cols, { x: FX.w * 0.08, y: FX.h * 0.95 }); fxConfetti(50, cols, { x: FX.w * 0.92, y: FX.h * 0.95 });
  UI.banner.classList.add('hr'); clearTimeout(FX.hrT); FX.hrT = setTimeout(() => UI.banner.classList.remove('hr'), 3200);
  fireShowBig(tm);
}
function fxStrikeout(forPitcher) {
  fxFlash(forPitcher ? '#ffd84a' : '#ff3b3b', 0.28, 360); fxShake(0.7, 0.35);
  fxSparks(FX.w / 2, FX.h * 0.38, 26, forPitcher ? GOLD : ['#ff4b4b', '#ff9a9a', '#ffffff'], 1.1);
  fxText(FX.w / 2, FX.h * 0.52, 'K', forPitcher ? '#ffd84a' : '#ff6b6b', 76);
}
function fxScore(runs, tm) {
  const bug = $('.bug'); if (bug) { bug.classList.remove('pulse'); void bug.offsetWidth; bug.classList.add('pulse'); }
  const r = bug ? bug.getBoundingClientRect() : { left: 20, bottom: 70, width: 100 };
  fxText(r.left + r.width / 2, r.bottom + 26, `+${runs} 득점`, '#ffd84a', 26);
  fxConfetti(22, teamCols(tm), { x: r.left + r.width / 2, y: r.bottom });
}
function fxWin(tm) {
  const cols = teamCols(tm).concat(GOLD);
  fxFlash('#fff2c2', 0.5, 600); fxConfetti(200, cols);
  setTimeout(() => fxConfetti(120, cols), 1200); setTimeout(() => fxConfetti(80, cols), 2400);
}
function fireShowBig(tm) {
  const c = tm ? [tm.t.c1, tm.t.c2] : [];
  const cols = c.concat(['#ffb627', '#ff4b4b', '#37d67a', '#5aa9ff', '#ffffff', '#ff7ab8']);
  const n = FX_LITE ? 6 : 11;
  for (let i = 0; i < n; i++) later(i * 0.28, () => {
    const x = rnd(-70, 70), y = rnd(48, 85), z = rnd(-165, -115), col = cols[i % cols.length];
    const kind = i % 4 === 1 ? 'ring' : i % 4 === 3 ? 'willow' : null;
    burst(x, y, z, col, kind === 'willow' ? 150 : 120, { kind });
    if (i % 3 === 0) burst(x + rnd(-8, 8), y + rnd(-6, 6), z, '#ffffff', 40, { sp: 6, life: 0.7 });
    AU.boom();
  });
}
