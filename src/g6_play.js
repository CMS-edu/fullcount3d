/* ===================== 인플레이 ===================== */
const _pv = new T.Vector3();
function contact(sw) {
  const P = G.pitch; P.launched = true;
  if (G.online) S.setRng(onSeed(P.pi, 2));
  const cp = sw.st || S.pitchPos(P.pt, P.contactU || 1, {});
  const tr = S.flyBall({ x: cp.x, y: cp.y, z: cp.z }, sw.ev, sw.la, sw.phi);
  const q = sw.q != null ? sw.q : clamp((sw.ev - 60) / 110, 0.1, 1);
  if (tr.foul && sw.ev < 80) AU.foulTip(); else AU.crack(sw.bunt ? 0.2 : q);
  if (!sw.bunt) fxContact(cp, sw.ev, tr.foul);
  G.pitchLog.push({ x: P.cross.x, y: P.cross.y, res: tr.foul ? 'strike' : 'play' });
  if (userBatting() && sw.foul) showFeedback([['파울', 'm'], [`타이밍 ${sw.tl || ''}`, 'm']], 1000);
  startPlay(tr, sw);
}
function trackPos(tr, t, out) {
  const pts = tr.pts, n = pts.length;
  if (t <= 0) { out.x = pts[0].x; out.y = pts[0].y; out.z = pts[0].z; return out; }
  if (t >= pts[n - 1].t) { const p = pts[n - 1]; out.x = p.x; out.y = p.y; out.z = p.z; return out; }
  let i = clamp(Math.floor(t * 60), 0, n - 2);
  while (i < n - 2 && pts[i + 1].t < t) i++;
  while (i > 0 && pts[i].t > t) i--;
  const a = pts[i], b = pts[i + 1], k = clamp((t - a.t) / (b.t - a.t || 1), 0, 1);
  out.x = lerp(a.x, b.x, k); out.y = lerp(a.y, b.y, k); out.z = lerp(a.z, b.z, k);
  return out;
}
function baseOfPt(p) {
  let best = 0, bd = 1e9;
  for (let k = 0; k < 4; k++) { const b = S.basePos(k), d = Math.hypot(b.x - p.x, b.z - p.z); if (d < bd) { bd = d; best = k; } }
  return best;
}
function pathPos(from, dist, out) {
  // from: 출발 루(0=홈), dist: 이동 거리(m)
  const seg = Math.min(Math.floor(dist / S.BASE), 3), f = (dist - seg * S.BASE) / S.BASE;
  const a = S.basePos((from + seg) % 4), b = S.basePos((from + seg + 1) % 4);
  out.x = lerp(a.x, b.x, clamp(f, 0, 1)); out.z = lerp(a.z, b.z, clamp(f, 0, 1));
  out.nx = b.x; out.nz = b.z;
  return out;
}

function startPlay(tr, sw) {
  const bt = batTeam(), ft = fieldTeam(), b = curBatter();
  const fl = fieldersOf(ft);
  const F = S.makeFielders(fl.map((pl, i) => (i === 0 ? 50 : pl ? pl.spd : 55)), defHomes()); // 수비 작전 위치
  const res = S.resolvePlay(tr, { bases: G.bases.slice(), outs: G.outs, batter: b, fielders: F, bunt: !!sw.bunt, def: G.defT, lead: G.leadT || 0 });
  const hr = res.kind === 'HR';
  const sc = hr ? 0.42 : 1;
  if (hr) res.runners.forEach((r) => { r.t0 = 1.6 + (r.t0 - 0.6) * sc; r.t1 = 1.6 + (r.t1 - 0.6) * sc; });
  const who = new Map();
  G.bases.forEach((p, k) => { if (p && G.runFig[k]) who.set(p, G.runFig[k]); });
  who.set(b, G.batFig);
  const play = G.play = { tr, res, t: 0, F, sw, who, done: false, ev: {}, hr, foul: res.kind === 'FOUL', movers: [], throwers: [], bunt: !!sw.bunt };
  play.dur = hr ? Math.max(res.dur, Math.max(...res.runners.map((r) => r.t1)) + 0.8) : res.kind === 'FOUL' ? Math.min(Math.max(tr.restT, 1.2), 2.4) : res.dur;
  // 야수 이동 계획
  const pos = (i) => { const f = fig(i); return { x: f.root.position.x, z: f.root.position.z }; };
  if (res.fielder >= 0) {
    const i = res.fielder, p0 = pos(i);
    play.movers.push({ i, from: p0, to: res.fieldPos, t0: F[i].react * 0.8, t1: Math.max(res.fieldT, F[i].react + 0.1), role: 'field' });
  }
  res.cover.forEach((c) => {
    if (c.f === res.fielder || play.movers.some((m) => m.i === c.f)) return;
    const p0 = pos(c.f), bp = S.basePos(c.base === 4 ? 0 : c.base);
    const to = { x: bp.x + (c.base === 1 ? 0.5 : 0), z: bp.z + (c.base === 4 ? 0.9 : 0.4) };
    const d = Math.hypot(to.x - p0.x, to.z - p0.z);
    const t0 = 0.25, need = d / F[c.f].speed;
    play.movers.push({ i: c.f, from: p0, to, t0, t1: Math.max(t0 + 0.2, Math.min(c.t - 0.1, t0 + need)), role: 'cover' });
  });
  // 송구자/수신자
  res.throws.forEach((th, j) => {
    const toK = baseOfPt(th.to), cov = res.cover.find((c) => (c.base === 4 ? 0 : c.base) === toK);
    th.recv = cov ? cov.f : -1;
    th.thrower = j === 0 ? res.fielder : res.throws[j - 1].recv;
    if (res.errType === 'throw' && j === 0) {
      // 악송구: 1루수 키를 넘겨 파울 지역으로 굴러감
      const dx = th.to.x - th.from.x, dz = th.to.z - th.from.z, L = Math.hypot(dx, dz) || 1;
      th.to = { x: th.to.x + (dx / L) * 2.5 + 1.2, z: th.to.z + (dz / L) * 2.5 + 1.8 }; th.recv = -1; th.wild = true;
    }
  });
  // 타자 / 주자
  res.runners.forEach((r) => {
    r.fig = who.get(r.who) || null;
    if (r.fig && r.fig !== G.batFig) r.fig.mode = 'play';
  });
  G.phase = 'play';
  hideDocks(); pciRing.visible = false; targetMark.visible = false;
  UI.skip.hidden = false;
  camPlay(tr, res);
  play.side = bt === G.T[1] ? 'H' : 'A';
  if (!play.foul) { cheerU.uT.value += 0; AU.cheer(clamp(sw.ev / 150, 0.4, 1), 1.6); crowdPulse(play.side, clamp((sw.ev - 90) / 60, 0.2, 1)); }
}

function moveFig(f, from, to, t0, t1, t, dt) {
  const s = clamp((t - t0) / Math.max(0.01, t1 - t0), 0, 1);
  const x = lerp(from.x, to.x, s), z = lerp(from.z, to.z, s);
  const moving = t > t0 && s < 1;
  if (moving) {
    const d = Math.hypot(to.x - from.x, to.z - from.z), v = d / Math.max(0.01, t1 - t0);
    placeFig(f, x, z);
    if (d > 0.3) turnTo(f, Math.atan2(to.x - from.x, to.z - from.z), 12, dt);
    runPose(f, clamp(v, 2, 8), dt);
  } else placeFig(f, x, z);
  return moving;
}
function idleTo(f, P, dt, k = 8) { blendPose(f.P, f.P, P, 1 - Math.exp(-k * dt)); applyPose(f); }

function updatePlay(dt) {
  const play = G.play; if (!play || play.done) return;
  play.t += dt;
  const t = play.t, { tr, res } = play;
  // --- 공 ---
  let bx, by, bz, held = null;
  if (play.hr || play.foul || res.fielder < 0 || t < res.fieldT) {
    trackPos(tr, t, _bp); bx = _bp.x; by = _bp.y; bz = _bp.z;
    if (play.hr && t > tr.restT + 0.3) ball.hide();
  } else {
    let th = null, last = null;
    for (const w of res.throws) { if (t >= w.t0 && t < w.t1) th = w; if (t >= w.t1) last = w; }
    if (th) {
      const k = (t - th.t0) / (th.t1 - th.t0), d = Math.hypot(th.to.x - th.from.x, th.to.z - th.from.z);
      bx = lerp(th.from.x, th.to.x, k); bz = lerp(th.from.z, th.to.z, k);
      by = lerp(1.7, 1.3, k) + 4 * clamp(d * 0.018, 0.15, 2.6) * k * (1 - k);
      if (!th.sent) { th.sent = true; AU.whistle && 0; }
    } else if (last) {
      held = last.recv >= 0 ? fig(last.recv) : null;
      bx = last.to.x; bz = last.to.z; by = 1.2;
      if (last.wild) { const r = Math.min(9, (t - last.t1) * 6), dx = last.to.x - last.from.x, dz = last.to.z - last.from.z, L = Math.hypot(dx, dz) || 1; bx += (dx / L) * r; bz += (dz / L) * r; by = 0.05 + Math.max(0, 0.8 - (t - last.t1) * 2); }
      if (!last.got) { last.got = true; AU.glove(); onThrowArrive(play, last); }
    } else {
      held = fig(res.fielder);
      if (!play.ev.caught) { play.ev.caught = true; AU.glove(); onFielded(play); }
    }
    if (held) { held.root.updateMatrixWorld(true); gloveOf(held, _gv); bx = _gv.x; by = _gv.y; bz = _gv.z; }
    if (res.errType === 'drop' && held === fig(res.fielder) && t < res.fieldT + 0.55 && !last0(res, t)) {
      // 공이 글러브를 맞고 떨어짐
      if (!play.dropFrom) play.dropFrom = { x: bx, y: by, z: bz };
      const k = (t - res.fieldT) / 0.55, d = play.dropFrom;
      bx = d.x + k * 0.9; bz = d.z + k * 0.6; by = Math.max(0.05, d.y + 1.2 * k - 3.6 * k * k);
      if (!play.ev.drop) { play.ev.drop = true; showCall('실책!', '#ff8a8a', 900); }
    }
  }
  if (bx != null && !(play.hr && t > tr.restT + 0.3)) {
    _pv.set(bx, by, bz);
    const cd = camera.position.distanceTo(_pv);
    ball.set(bx, by, bz, clamp(cd * 0.03, 1.2, 7)); ball.pushTrail(!held && cd > 8);
  }
  play.ball = { x: bx || 0, y: by || 0, z: bz || 0 };
  // --- 야수 ---
  const moved = new Set();
  play.movers.forEach((m) => {
    const f = fig(m.i); moved.add(m.i);
    const mv = moveFig(f, m.from, m.to, m.t0, m.t1, t, dt);
    if (!mv) {
      const thr = res.throws.find((w) => w.thrower === m.i && t > w.t0 - 0.35 && t < w.t0 + 0.35);
      if (thr) { idleTo(f, t < thr.t0 ? POSE.throwBack : POSE.throwFwd, dt, 14); turnTo(f, Math.atan2(thr.to.x - f.root.position.x, thr.to.z - f.root.position.z), 12, dt); }
      else if (m.role === 'field' && Math.abs(t - res.fieldT) < 0.5 && !play.hr) idleTo(f, (tr.firstLand && t < tr.firstLand.t + 0.1) || res.kind === 'FLY' || res.kind === 'SF' || res.kind === 'LINE' || res.kind === 'POP' || res.kind === 'FOUL_OUT' || res.kind === 'LDP' ? POSE.catchHigh : POSE.catchLow, dt, 12);
      else if (m.role === 'cover') { idleTo(f, POSE.ready, dt); turnTo(f, Math.atan2(play.ball.x - f.root.position.x, play.ball.z - f.root.position.z), 8, dt); }
      else idleTo(f, POSE.stand, dt);
    }
  });
  for (let i = 0; i < 9; i++) {
    if (moved.has(i)) continue;
    const f = fig(i);
    if (i === 0 && t < 0.6) continue;
    if (i === 1 && t < 0.5) continue;
    idleTo(f, i === 1 ? POSE.stand : POSE.ready, dt, 4);
    turnTo(f, Math.atan2(play.ball.x - f.root.position.x, play.ball.z - f.root.position.z), 5, dt);
  }
  // --- 주자 ---
  res.runners.forEach((r) => {
    const f = r.fig; if (!f) return;
    if (f === G.batFig && t < r.t0) return; // 아직 스윙 중
    if (f === G.batFig && f.mode === 'bat') { f.mode = 'play'; f.bat.visible = false; }
    const total = (r.to - r.from) * S.BASE;
    let dist;
    if (r.abort) dist = Math.min(S.BASE, Math.max(0, t - r.t0) * S.runV(r.who.spd || 60));
    else dist = clamp((t - r.t0) / Math.max(0.01, r.t1 - r.t0), 0, 1) * total;
    if (t < r.t0) dist = 0;
    const lead = G.runFig.indexOf(f) >= 0 && r.from > 0 ? (f.lead || 0) : 0;
    let d2 = r.from > 0 ? Math.max(dist, Math.min(lead, total)) : dist;
    if (r.doubled) { d2 = Math.max(0.6, lead * (1 - 0.75 * clamp((t - r.t0) / Math.max(0.01, r.t1 - r.t0), 0, 1))); }
    pathPos(r.from, d2, _pp);
    placeFig(f, _pp.x, _pp.z);
    const running = t >= r.t0 && (r.abort ? t < r.t1 && dist < S.BASE : t < r.t1);
    if (r.doubled && running) { turnTo(f, Math.atan2(_pp.nx - _pp.x, _pp.nz - _pp.z) + Math.PI, 14, dt); runPose(f, 7, dt); return; }
    if (running) { turnTo(f, Math.atan2(_pp.nx - _pp.x, _pp.nz - _pp.z), 14, dt); runPose(f, play.hr ? 5.5 : 7.5, dt); }
    else if (t >= r.t1) {
      if (r.out && !r.called) { r.called = true; if (!play.ev.outCall) { play.ev.outCall = true; } }
      if (r.out) { idleTo(f, POSE.dejected, dt, 5); if (t > r.t1 + 1.6) showFigure(f, false); }
      else if (r.to >= 4) { idleTo(f, POSE.celebrate, dt, 6); if (!r.scored) { r.scored = true; onScore(play, r); } if (t > r.t1 + 1.4) showFigure(f, false); }
      else idleTo(f, POSE.stand, dt, 6);
    } else idleTo(f, POSE.lead, dt, 6);
  });
  // 타자가 주자가 아닌 경우(파울 등) 스윙 계속
  // --- 이벤트 ---
  if (!play.ev.text && ((play.hr && t > 1.0) || (!play.hr && !play.foul && (t > Math.min(res.fieldT + 0.1, 2.2) || t > 1.4)))) {
    play.ev.text = true; showPlayText(res.text, 2600);
    if (res.kind === 'E') { boardFlash('실책!', fieldTeam().t.city, 2.5); AU.cheer(0.8, 1.6); crowdPulse(play.side, 1); }
    if (['1B', '2B', '3B', 'IFH', 'BUNT_HIT'].includes(res.kind)) { boardFlash(res.kind === '2B' ? '2루타!' : res.kind === '3B' ? '3루타!' : '안타!', curBatter().name, 3); fxHit(res.kind, batTeam()); }
  }
  if (play.hr && !play.ev.hr && t > 0.9) {
    play.ev.hr = true;
    showBanner('홈런!', res.text.split('!')[0] + '!', 2600);
    boardFlash('HOME RUN', curBatter().name, 6);
    fxHomeRun(batTeam()); AU.cheer(1.3, 4); crowdPulse(play.side, 2.5); AU.drum('x.x.xxx.x.x.xxx.', 170);
  }
  if (play.foul && !play.ev.foul) { play.ev.foul = true; showCall('파울', '#ffffff', 700); }
  if (t >= play.dur) finishPlay();
}
const _pp = { x: 0, z: 0, nx: 0, nz: 0 };
function last0(res, t) { return res.throws.some((w) => t >= w.t0); }
function onFielded(play) {
  const { res } = play;
  if (res.iff) { showCall('인필드 플라이!', '#ffb627', 1100); umpCall(); return; }
  if (res.errType === 'drop') return;
  if (['FLY', 'POP', 'LINE', 'SF', 'FOUL_OUT', 'LDP'].includes(res.kind)) {
    showCall('아웃', '#ff4b4b', 900); umpCall();
    if (userPitching()) AU.cheer(0.5, 1.2); else AU.groan();
  }
}
function onThrowArrive(play, th) {
  const { res } = play;
  const outAt = res.runners.find((r) => r.out && !r.abort && Math.abs(r.t1 - th.t1) < 0.6 && baseOfPt(th.to) === r.to % 4);
  const batAt1 = baseOfPt(th.to) === 1;
  if (outAt || (batAt1 && res.kind === 'GO') || (batAt1 && res.kind === 'SAC') || (batAt1 && res.kind === 'DP')) { showCall('아웃', '#ff4b4b', 800); umpCall(); }
  else if (batAt1 && (res.kind === 'IFH' || res.kind === 'BUNT_HIT' || res.kind === 'E')) showCall('세이프', '#37d67a', 800);
}
function onScore(play, r) {
  void r;
  if (!play.ev.run) { play.ev.run = true; AU.cheer(1, 2.2); crowdPulse(play.side, 1.4); }
  play.ev.nRun = (play.ev.nRun || 0) + 1; const n = play.ev.nRun;
  setTimeout(() => { if (play.ev.nRun === n) fxScore(n, batTeam()); }, 250);
}

function finishPlay() {
  const play = G.play;
  if (!play || play.done) return;
  play.done = true; UI.skip.hidden = true;
  if (G.prac) return pracPlay(play);
  const { res } = play;
  const b = curBatter(), pit = fieldTeam().pitcher, bt = batTeam();
  ball.hide();
  if (res.kind === 'FOUL') {
    if (play.bunt && G.s >= 2) {
      G.s = 3; b.g.pa++; b.g.ab++; b.g.k++; pit.g.k++; G.outs++; pit.g.outs++;
      showCall('스리번트 삼진', '#ff4b4b', 1300);
      G.play = null; resetAfterPlay(); updateBug(); drawBoard(); advanceOrder(); afterPA(1.2);
      return;
    }
    if (G.s < 2) G.s++;
    G.play = null; resetAfterPlay(true); updateBug(); drawTracker(); drawBoard();
    if (G.steal) { G.steal = null; }
    G.phase = 'after';
    const gen = G.gen; later(0.5, () => { if (gen === G.gen) nextPitch(); });
    return;
  }
  G.steal = null;
  b.g.pa++;
  const hit = ['1B', '2B', '3B', 'HR', 'IFH', 'BUNT_HIT'].includes(res.kind);
  if (res.kind !== 'SF' && res.kind !== 'SAC') b.g.ab++;
  if (hit) { b.g.h++; bt.hits++; pit.g.h++; }
  if (res.kind === '2B') b.g.d2++;
  if (res.kind === '3B') b.g.d3++;
  if (res.kind === 'HR') { b.g.hr++; pit.g.hr++; }
  if (res.kind === 'E') fieldTeam().err++;
  G.outs += res.outs; pit.g.outs += res.outs;
  let runs = res.runs;
  // 끝내기: 홈런 외에는 결승점까지만 인정
  if (G.half === 1 && G.inning >= G.maxInn && res.kind !== 'HR' && runs > 0) {
    const need = G.T[0].runs - G.T[1].runs + 1;
    if (need > 0 && runs > need) runs = need;
  }
  b.g.rbi += Math.min(res.rbi, runs);
  const scorers = res.runners.filter((r) => r.to >= 4 && !r.out).map((r) => r.who);
  G.bases = res.bases.slice();
  if (G.outs >= 3) G.bases = [null, null, null];
  G.play = null;
  if (runs > 0) addRuns(runs, scorers);
  resetAfterPlay();
  updateBug(); drawBoard(); updateLines();
  advanceOrder();
  afterPA(0.5);
}
function resetAfterPlay(keepBatter) {
  resetField();
  if (keepBatter && G.batFig) { showFigure(G.batFig, true); G.batFig.bat.visible = true; G.batFig.mode = 'bat'; const L = G.batFig === FIG.batL; placeFig(G.batFig, L ? BAT_X : -BAT_X, 0.05, L ? -Math.PI / 2 : Math.PI / 2); G.bs.mode = G.bunt ? 'bunt' : 'stance'; G.bs.load = 0; }
  else [FIG.batR, FIG.batL].forEach((f) => showFigure(f, false));
  placeRunners();
  camForPA(true);
}

