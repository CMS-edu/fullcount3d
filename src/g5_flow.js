/* ===================== GAME FLOW ===================== */
const POS_K = { C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수', DH: '지명' };
const POS_LIST = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
/* ---------- 실제 기록 → 게임 능력치 ---------- */
// 표본이 작으면 리그 평균 쪽으로 당김 (w = 신뢰도)
const POS_SPD = { C: 38, '1B': 42, DH: 42, '3B': 50, LF: 52, RF: 52, '2B': 56, SS: 58, CF: 60 };
function hashN(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rateHitter(r) {
  const pa = Math.max(1, r.pa), w = pa / (pa + 120), w2 = pa / (pa + 60);
  const kp = r.so != null ? r.so / pa : 0.19, bbp = r.bb != null ? r.bb / pa : 0.085, iso = r.slg - r.avg;
  const rnd = (v, lo, hi) => Math.round(clamp(v, lo, hi));
  return {
    name: r.n, eng: r.e, num: r.num, pos: r.pos, posK: POS_K[r.pos], hand: r.b === 'S' ? 'R' : r.b, sw: r.b === 'S', foreign: /[a-z]/i.test(r.e) && !/-/.test(r.e),
    height: 1.8, avg: r.avg, obp: r.obp, slg: r.slg, hr: r.hr, sb: r.sb, pa: r.pa,
    con: rnd(60 + ((r.avg - 0.265) * 330 - (kp - 0.19) * 70) * w, 30, 99),
    pow: rnd(58 + ((iso - 0.13) * 210 + (r.hr / pa - 0.022) * 150) * w, 25, 99),
    eye: rnd(58 + ((bbp - 0.09) * 280 - (kp - 0.19) * 60) * w, 25, 99),
    spd: rnd((POS_SPD[r.pos] || 50) + Math.min(38, (r.sb / pa) * 380) * w2, 25, 97),
  };
}
const ARSENAL = ['SL', 'CB', 'CH', 'FK', 'TS'];
function ratePitcher(r) {
  const ip = Math.max(1, r.ip), w = ip / (ip + 25), k9 = (r.k / ip) * 9, bb9 = (r.bb / ip) * 9;
  const rnd = (v, lo, hi) => Math.round(clamp(v, lo, hi));
  const h = hashN(r.e), n = r.role === 'SP' ? 3 : 2, pitches = ['FB'];
  for (let i = 0; pitches.length < n + 1; i++) { const k = ARSENAL[(h >>> (i * 3)) % ARSENAL.length]; if (!pitches.includes(k)) pitches.push(k); if (i > 20) break; }
  return {
    name: r.n, eng: r.e, num: r.num, role: r.role, hand: r.t, foreign: /[a-z]/i.test(r.e) && !/-/.test(r.e), pitches,
    era: r.era, ip: r.ip, k: r.k, bb: r.bb, whip: r.whip, sv: r.sv,
    vel: rnd(143 + (k9 - 7.6) * 1.6 + (r.role === 'SP' ? 0 : 2), 136, 157),
    ctl: rnd(60 + (3.6 - bb9) * 9 * w, 30, 96),
    stf: rnd(60 + ((k9 - 7.6) * 4.2 + (4.4 - r.era) * 3 + (1.4 - r.whip) * 18) * w, 35, 96),
    sta: r.role === 'SP' ? Math.round(88 + Math.min(18, r.ip / 9)) : r.role === 'CL' ? 30 : (r.ip > 50 ? 30 : 24),
  };
}
// 실제 구종 (tools/pitch_mix.js로 모은 문자중계 투구 기록): 구종 목록·구사율·구종별 평균 구속. 기록이 없으면 기존 추정 구종 그대로
function applyPitchMix(p) {
  const mx = p.kbo && PITCH_MIX[p.kbo];
  if (!mx) return;
  p.mix = mx[1].map(([t, sh]) => [t, sh]);
  p.pitches = mx[1].map((x) => x[0]);
  p.spd = {}; mx[1].forEach(([t, , v]) => { if (v) p.spd[t] = v; });
  const fb = p.spd.FB || p.spd.TS || (p.spd.CT && p.spd.CT / 0.955);
  if (fb) p.vel = Math.round(fb * 10) / 10;
  p.mixN = mx[0];
  // 실제 무브먼트: 리그 평균보다 몇 인치 더/덜 휘고 떨어지는지 → 게임 기본 휘어짐에 그만큼(1인치 = 2.54cm) 더함
  p.mv = {}; p.mvIn = {};
  mx[1].forEach(([t, , , hb, vb]) => {
    const L = PITCH_MV_AVG[t], base = S.PITCHES[t];
    if (hb == null || !L || !base) return;
    p.mv[t] = [base.arm + (hb - L[0]) * 0.0254, base.drop - (vb - L[1]) * 0.0254];
    p.mvIn[t] = [hb - L[0], vb - L[1]];
  });
  // 팔 높이: 실제 릴리스 높이(ft)로 오버핸드(0) · 사이드암(1) · 언더핸드(2)
  //   리그 가운데값이 5.9ft쯤, 사이드암 4.6ft쯤, 잠수함(고영표) 2.9ft
  if (mx[2]) { const z = mx[2][1]; p.relH = z; p.slot = z >= 4.6 ? clamp(5.6 - z, 0, 1) : clamp(1 + (4.6 - z) / 1.6, 1, 2); }
}
// 실제 타자 성향 (tools/batter_tend.js): 코스별 스윙·헛스윙·타율, 당겨치기, 땅볼 → CPU 타자의 스윙·컨택·타구 방향에 반영
function applyBatTend(b) {
  const t = b.kbo && BAT_TEND[b.kbo];
  if (!t) return;
  const [pa, spray, gb, cells] = t;
  b.tz = cells; b.spray = spray; b.gb = gb; b.tzN = pa;
  // 리그 평균만큼 당겨치면 기존 기본값 7°, 더 당기면 더 크게
  b.pullDeg = clamp(7 + ((spray[0] - spray[2]) - (BAT_LG.pull - BAT_LG.oppo)) * 45, -8, 22);
  b.laAdj = clamp((BAT_LG.gb - gb) * 30, -5, 5); // 땅볼 타자는 발사각 낮게
  // 코스별 [스윙 배율, 컨택 배율, 타율 차이]. 얼마나 잘 치는 타자인지는 능력치(컨택·파워·선구)에 이미 들어 있으니
  // 두 번 세지 않도록 13칸 평균을 빼서 "어느 코스가 상대적으로 강하고 약한지" 모양만 남김
  const raw = cells.map(([sw, wh, avg], i) => { const L = BAT_LG.cells[i]; return [sw / L[0], (1 - wh) / (1 - L[1]), avg - L[2]]; });
  const mean = [0, 1, 2].map((k) => raw.reduce((s, r) => s + r[k], 0) / raw.length);
  b.zm = raw.map((r) => [r[0] / mean[0], r[1] / mean[1], r[2] - mean[2]]);
}
// "사이드암" 같은 투구 폼 이름 (오버핸드·스리쿼터는 따로 안 붙임)
function armSlotName(p) { return !p.slot || p.slot < 0.8 ? '' : p.slot < 1.6 ? '사이드암' : '언더핸드'; }
const LEAGUE = REAL.map((t, ti) => {
  const r = { lineup: t.lineup.map(rateHitter), bench: t.bench.map(rateHitter), rotation: t.rotation.map(ratePitcher), bullpen: t.bullpen.map(ratePitcher), date: t.date };
  r.lineup.concat(r.bench).forEach((b, i) => (b.key = 'B' + i));
  r.rotation.concat(r.bullpen).forEach((p, i) => (p.key = 'P' + i));
  // 팀 번호·사진 (이름을 바꿔도 사진은 원래 선수 것 그대로)
  r.lineup.concat(r.bench, r.rotation, r.bullpen).forEach((p) => { p.ti = ti; p.kbo = KBO_PH[ti + '|' + p.name] || null; p.ph = PHOTO_DB[ti + '|' + p.name] || null; });
  r.rotation.concat(r.bullpen).forEach(applyPitchMix);
  r.lineup.concat(r.bench).forEach(applyBatTend);
  return r;
});

const WIND = 1.1, REL_U = 0.78, SW_TC = 0.035, BAT_X = 0.95;
const POS_IDX = { C: 1, '1B': 2, '2B': 3, '3B': 4, SS: 5, LF: 6, CF: 7, RF: 8 };

const G = {
  phase: 'title', T: null, inning: 1, half: 0, outs: 0, b: 0, s: 0, bases: [null, null, null],
  maxInn: 9, limitInn: 11, userSide: 1, pitchLog: [], selType: 'FB', aimTarget: null, lastSpeed: 0,
  diff: DIFF.rookie, zoneOn: store.get('zone', true), heatOn: store.get('heat', true), bunt: false, stealReq: false, steal: null, pitch: null, play: null,
  runFig: [null, null, null], batFig: null, bs: null, meter: null, gen: 0, cpuBunt: false,
};
function batTeam() { return G.T ? G.T[G.half] : null; }
function fieldTeam() { return G.T ? G.T[1 - G.half] : null; }
function curBatter() { const t = batTeam(); return t ? t.lineup[t.order] : null; }
function userBatting() { return !!G.T && G.half === G.userSide; }
function userPitching() { return !!G.T && G.half !== G.userSide; }
const R = Math.random;
let GR = Math.random; // 경기 결과에 영향을 주는 난수 (온라인에서는 시드 고정)

function makeTeamState(idx) {
  const ros = JSON.parse(JSON.stringify(LEAGUE[idx]));
  ros.lineup.concat(ros.bench).forEach((b) => (b.g = { pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, r: 0, bb: 0, k: 0, sb: 0, d2: 0, d3: 0 }));
  ros.rotation.concat(ros.bullpen).forEach((p) => (p.g = { pc: 0, outs: 0, h: 0, r: 0, bb: 0, k: 0, hr: 0 }));
  const sp = ros.rotation[Math.floor(GR() * ros.rotation.length)];
  const tm = { idx, t: S.TEAMS[idx], ros, lineup: ros.lineup.slice(), bench: ros.bench.slice(), out: [], order: 0, pitcher: sp, used: [sp], runs: 0, hits: 0, bb: 0, err: 0, line: [], warned: null };
  applyRoster(tm);
  return tm;
}
function fieldersOf(tm) {
  const a = [tm.pitcher];
  tm.lineup.forEach((b) => { if (POS_IDX[b.pos]) a[POS_IDX[b.pos]] = b; });
  return a;
}

/* ---------- 유니폼 ---------- */
function uni(t, home) {
  if (home) { const tr = lum(t.c1) > 0.55 ? t.c2 : t.c1; return { jersey: '#f3f3ee', trim: tr, pants: '#f3f3ee', cap: tr, socks: tr, belt: tr, pin: true }; }
  return { jersey: t.c1, trim: t.c2, pants: '#9aa0a9', cap: t.c1, socks: t.c1, belt: '#16161a', pin: false };
}
function dress(f, t, home, pl) {
  const key = t.id + home + (pl ? pl.name + pl.num : '-');
  if (f.dressKey === key) return;
  f.dressKey = key;
  setFigureColors(f, Object.assign(uni(t, home), { teamText: t.name, capText: t.city, num: pl ? pl.num : '', name: pl ? pl.name : '' }));
  if (f.kind !== 'U') setFigureLooks(f, pl);
}

/* ---------- 인물 배치 ---------- */
const FIG = {};
function ghostable(f) {
  f.ghostMats = [];
  const own = f.ownMats;
  f.root.traverse((o) => {
    if (!o.isMesh) return;
    if (!own.includes(o.material)) o.material = o.material.clone();
    if (!f.ghostMats.includes(o.material)) f.ghostMats.push(o.material);
  });
  f.ghostA = 1;
}
function setGhost(f, a) {
  if (f.ghostA === a) return;
  f.ghostA = a;
  f.ghostMats.forEach((m) => { m.transparent = a < 1; m.opacity = a; m.depthWrite = a >= 1; m.needsUpdate = true; });
}
function initFigures() {
  const base = { jersey: '#f3f3ee', trim: '#1f3d8f', pants: '#f3f3ee', cap: '#1f3d8f' };
  FIG.field = [];
  for (let i = 0; i < 9; i++) FIG.field.push(makeFigure(Object.assign({}, base, { glove: 'L', kind: 'F', mask: i === 1, pad: i === 1 })));
  FIG.pitL = makeFigure(Object.assign({}, base, { glove: 'R', kind: 'F' }));
  FIG.P = FIG.field[0];
  FIG.batR = makeFigure(Object.assign({}, base, { helmet: true, flapSide: 0.12, kind: 'B' }));
  FIG.batL = makeFigure(Object.assign({}, base, { helmet: true, flapSide: -0.12, kind: 'B' }));
  [FIG.batR, FIG.batL].forEach((f) => { f.bat = new T.Mesh(FG.g.bat, FG.M.bat); f.root.add(f.bat); });
  FIG.run = [0, 1, 2].map(() => makeFigure(Object.assign({}, base, { helmet: true, flapSide: 0.12, kind: 'R' })));
  FIG.coach = [0, 1].map(() => makeFigure(Object.assign({}, base, { kind: 'CO' })));
  const um = { jersey: '#1b2440', trim: '#1b2440', pants: '#3a3d45', cap: '#111318', socks: '#111318', kind: 'U' };
  FIG.ump = [makeFigure(Object.assign({}, um, { mask: true }))];
  if (!lowEnd) FIG.ump.push(makeFigure(um), makeFigure(um));
  ghostable(FIG.field[1]); ghostable(FIG.ump[0]);
  FIG.all = [...FIG.field, FIG.pitL, FIG.batR, FIG.batL, ...FIG.run, ...FIG.coach, ...FIG.ump];
  FIG.all.forEach((f) => { f.tp = POSE.stand; f.mode = 'idle'; });
}
function fig(i) { return i === 0 ? FIG.P : FIG.field[i]; }
const COACH_SPOT = [{ x: 21.1, z: -13.4 }, { x: -21.1, z: -13.4 }];
const UMP_SPOT = [{ x: 0.12, z: 2.25 }, { x: 22.2, z: -20.8 }, { x: -22.2, z: -20.8 }];

function dressTitle() {
  const home = S.TEAMS[OPTS.home ? OPTS.me : OPTS.opp], away = S.TEAMS[OPTS.home ? OPTS.opp : OPTS.me];
  for (let i = 0; i < 9; i++) dress(FIG.field[i], home, true, null);
  FIG.coach.forEach((c) => dress(c, away, false, null));
  FIG.P = FIG.field[0]; showFigure(FIG.pitL, false);
  [FIG.batR, FIG.batL, ...FIG.run].forEach((f) => showFigure(f, false));
  resetField();
}
function dressField() {
  const tm = fieldTeam(), home = tm === G.T[1], fl = fieldersOf(tm);
  for (let i = 1; i < 9; i++) dress(FIG.field[i], tm.t, home, fl[i]);
  const left = tm.pitcher.hand === 'L';
  FIG.P = left ? FIG.pitL : FIG.field[0];
  showFigure(FIG.pitL, left); showFigure(FIG.field[0], !left);
  dress(FIG.P, tm.t, home, tm.pitcher);
  const bt = batTeam();
  FIG.coach.forEach((c) => dress(c, bt.t, bt === G.T[1], null));
}
function resetField() {
  for (let i = 1; i < 9; i++) {
    const f = FIG.field[i], h = S.FIELD_HOME[i];
    showFigure(f, true); placeFig(f, h.x, h.z);
    if (i === 1) { f.root.rotation.y = Math.PI; f.tp = POSE.catcher; } else { faceTo(f, 0, -2); f.tp = POSE.stand; }
    f.mode = 'idle'; Object.assign(f.P, f.tp); applyPose(f);
  }
  const pp = G.T ? fieldTeam().pitcher : null;
  showFigure(FIG.P, true); FIG.P.mode = 'pitch'; pitcherPose(FIG.P, 0, pp ? pp.hand : 'R', pp && pp.slot);
  FIG.coach.forEach((c, i) => { showFigure(c, true); placeFig(c, COACH_SPOT[i].x, COACH_SPOT[i].z); faceTo(c, 0, -8); c.tp = POSE.coach; c.mode = 'idle'; Object.assign(c.P, c.tp); applyPose(c); });
  FIG.ump.forEach((u, i) => { showFigure(u, true); placeFig(u, UMP_SPOT[i].x, UMP_SPOT[i].z); if (i === 0) u.root.rotation.y = Math.PI; else faceTo(u, 0, -12); u.tp = i === 0 ? POSE.ump : POSE.ready; u.mode = 'idle'; Object.assign(u.P, u.tp); applyPose(u); });
}
function runnerSpot(k, lead) {
  // k: 0=1루,1=2루,2=3루 ; lead: 리드 거리(m)
  const a = S.basePos(k + 1), b = S.basePos((k + 2) % 4);
  const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz);
  let x = a.x + (dx / L) * lead, z = a.z + (dz / L) * lead;
  if (k === 2) { x -= 0.9; z += 0.9 * 0; } // 3루 주자는 파울 지역 쪽
  return { x, z };
}
function placeRunners() {
  const bt = batTeam(), home = bt === G.T[1];
  const free = FIG.run.slice();
  G.runFig = [null, null, null];
  for (let k = 0; k < 3; k++) {
    const p = G.bases[k]; if (!p) continue;
    let f = free.find((x) => x.who === p) || free[0];
    free.splice(free.indexOf(f), 1);
    f.who = p; dress(f, bt.t, home, p); showFigure(f, true);
    const s = runnerSpot(k, 0.6); placeFig(f, s.x, s.z); faceTo(f, 0, -18);
    f.tp = POSE.stand; f.mode = 'idle'; f.lead = 0; f.base = k; Object.assign(f.P, POSE.stand); applyPose(f);
    G.runFig[k] = f;
  }
  free.forEach((f) => { showFigure(f, false); f.who = null; });
}

/* ---------- 타자 애니메이션 ---------- */
const BKF = {
  stance: { p: pose({ hipY: -0.07, spX: 0.12, spY: -0.1, lLz: 0.22, rLz: -0.22, lK: 0.3, rK: 0.3, hdY: 1.55, hdX: 0.05 }), H: [-0.1, 1.32, 0.2], D: [-0.3, 0.9, -0.3] },
  load: { p: pose({ hipY: -0.1, spX: 0.16, spY: -0.35, lLz: 0.12, rLz: -0.22, lLx: -0.3, lK: 0.75, rK: 0.4, hdY: 1.75, hdX: 0.05 }), H: [-0.22, 1.36, 0.12], D: [-0.55, 0.65, -0.52] },
  contact: { p: pose({ hipY: -0.13, spX: 0.2, spY: 0.35, lLz: 0.4, rLz: -0.15, lK: 0.18, rK: 0.6, rLx: 0.15, hdY: 1.1, hdX: 0.15 }) },
  follow: { p: pose({ hipY: -0.08, spX: 0.1, spY: 0.95, lLz: 0.36, rLz: -0.1, rK: 0.65, rLx: 0.25, hdY: 0.7 }), H: [0.22, 1.25, 0.25], D: [0.85, 0.2, 0.2] },
  finish: { p: pose({ hipY: -0.05, spX: 0.02, spY: 1.2, lLz: 0.3, rLz: -0.05, rK: 0.7, rLx: 0.3, hdY: 0.5 }), H: [0.12, 1.45, 0.02], D: [-0.25, 0.35, -0.9] },
  bunt: { p: pose({ hipY: -0.2, spX: 0.35, spY: 0.85, lK: 0.6, rK: 0.6, lLz: 0.25, rLz: -0.25, hdY: 0.75, hdX: 0.1 }), H: [0.16, 1.05, 0.32], D: [0.06, 0.07, 1] },
};
const BKF_L = {};
for (const k in BKF) BKF_L[k] = { p: mirrorPose(BKF[k].p), H: BKF[k].H && [-BKF[k].H[0], BKF[k].H[1], BKF[k].H[2]], D: BKF[k].D && [-BKF[k].D[0], BKF[k].D[1], BKF[k].D[2]] };
const _bH = new T.Vector3(), _bD = new T.Vector3(), _bH2 = new T.Vector3(), _bD2 = new T.Vector3(), _bW = new T.Vector3(), _bW2 = new T.Vector3();
const Y_UP = new T.Vector3(0, 1, 0);
function setupBatter() {
  const b = curBatter(), bt = batTeam(), L = b.hand === 'L';
  const f = L ? FIG.batL : FIG.batR, other = L ? FIG.batR : FIG.batL;
  showFigure(other, false); showFigure(f, true); f.bat.visible = true;
  dress(f, bt.t, bt === G.T[1], b);
  G.batFig = f;
  G.bs = { mode: 'stance', t: 0, load: 0, K: L ? BKF_L : BKF, cH: new T.Vector3(), cD: new T.Vector3(), buntMix: 0 };
  placeFig(f, L ? BAT_X : -BAT_X, 0.05, L ? -Math.PI / 2 : Math.PI / 2);
  f.mode = 'bat';
}
function kfHD(k, H, D) { H.set(k.H[0], k.H[1], k.H[2]); D.set(k.D[0], k.D[1], k.D[2]).normalize(); }
// 스윙 시작: 월드 컨택 지점 → 로컬 H/D 계산
function batterSwing(pW) {
  const bs = G.bs, f = G.batFig;
  f.root.updateMatrixWorld(true);
  const pL = f.root.worldToLocal(pW.clone());
  const C = new T.Vector3(0, 1.28, 0.06);
  bs.cD.copy(pL).sub(C).normalize();
  bs.cH.copy(pL).addScaledVector(bs.cD, -0.64);
  bs.mode = 'swing'; bs.t = 0;
}
function updateBatter(dt) {
  const f = G.batFig, bs = G.bs;
  if (!f || !bs || f.mode !== 'bat') return;
  const K = bs.K;
  let pA, pB, t, HA = _bH, DA = _bD, HB = _bH2, DB = _bD2;
  const idle = Math.sin(clock * 2.2) * 0.04;
  if (bs.mode === 'swing') {
    bs.t += dt;
    const tc = SW_TC, t1 = tc + 0.1, t2 = tc + 0.34;
    if (bs.t < tc) { pA = K.load.p; pB = K.contact.p; t = bs.t / tc; kfHD(K.load, HA, DA); HB.copy(bs.cH); DB.copy(bs.cD); }
    else if (bs.t < t1) { pA = K.contact.p; pB = K.follow.p; t = smooth((bs.t - tc) / (t1 - tc)); HA.copy(bs.cH); DA.copy(bs.cD); kfHD(K.follow, HB, DB); }
    else { pA = K.follow.p; pB = K.finish.p; t = smooth((bs.t - t1) / (t2 - t1)); kfHD(K.follow, HA, DA); kfHD(K.finish, HB, DB); }
  } else {
    // stance ↔ load ↔ bunt
    bs.buntMix = damp(bs.buntMix, bs.mode === 'bunt' ? 1 : 0, 10, dt);
    const ld = bs.load;
    if (bs.buntMix > 0.02) { pA = K.stance.p; pB = K.bunt.p; t = bs.buntMix; kfHD(K.stance, HA, DA); kfHD(K.bunt, HB, DB); }
    else { pA = K.stance.p; pB = K.load.p; t = smooth(ld); kfHD(K.stance, HA, DA); kfHD(K.load, HB, DB); DA.x += idle; DA.normalize(); }
  }
  blendPose(f.P, pA, pB, t);
  applyPose(f, 'both');
  HA.lerp(HB, t); DA.lerp(DB, t).normalize();
  f.bat.position.copy(HA); f.bat.quaternion.setFromUnitVectors(Y_UP, DA);
  f.root.updateMatrixWorld(true);
  const Lh = f === FIG.batL;
  const bottom = Lh ? f.rA : f.lA, top = Lh ? f.lA : f.rA;
  const off = bs.mode !== 'swing' && bs.buntMix > 0.5 ? 0.34 : 0.1;
  armIK(bottom, f.root.localToWorld(_bW.copy(HA)));
  armIK(top, f.root.localToWorld(_bW2.copy(HA).addScaledVector(DA, off)));
}

/* ---------- 경기 시작 ---------- */
function startGame(ov) {
  ov = ov || {};
  if (!ov.online && G.online) endOnline();
  AU.init();
  clearTimers(); G.gen++;
  const o = Object.assign({}, OPTS, ov);
  G.season = ov.season || null; G.prac = ov.prac || null;
  G.mode = G.season ? 'season' : G.prac ? 'prac' : 'exh';
  if (G.mode === 'exh') store.set('opts', OPTS);
  G.diff = DIFF[o.diff] || DIFF.rookie;
  G.maxInn = o.inn; G.limitInn = o.inn === 9 ? 11 : o.inn + 2;
  G.userSide = o.home ? 1 : 0;
  const away = o.home ? o.opp : o.me, home = o.home ? o.me : o.opp;
  G.T = [makeTeamState(away), makeTeamState(home)];
  if (ov.sp) G.T.forEach((tm, i) => { if (ov.sp[i] != null) { tm.pitcher = tm.ros.rotation[ov.sp[i] % tm.ros.rotation.length]; tm.used = [tm.pitcher]; } });
  G.inning = 1; G.half = 0; G.play = null; G.pitch = null; G.steal = null; G.paId = 0;
  paintCrowd(G.T[1].t, G.T[0].t); paintLed(G.T[1].t, G.T[0].t);
  UI.title.hidden = true; UI.hud.hidden = false; $('#overModal').hidden = true;
  $('#pracLine').hidden = !G.prac;
  if (G.prac) { pracStart(); return; }
  startHalf();
}
function startHalf() {
  G.outs = 0; G.b = 0; G.s = 0; G.bases = [null, null, null];
  const bt = batTeam();
  if (bt.line[G.inning - 1] == null) bt.line[G.inning - 1] = 0;
  dressField(); resetField(); placeRunners();
  [FIG.batR, FIG.batL].forEach((f) => showFigure(f, false));
  ball.hide(); hideDocks();
  G.phase = 'intro';
  const nm = `${G.inning}회${G.half ? '말' : '초'}`;
  showBanner(nm, `${bt.t.city} ${bt.t.name} 공격${userBatting() ? ' · 우리 팀 차례!' : ''}`, 2000);
  camIntro();
  updateBug(); drawBoard(); updateLines();
  AU.cheer(0.5, 1.8); if (bt === G.T[1]) AU.drum('x.x.xxx.', 150);
  const gen = G.gen;
  later(2.3, () => { if (gen === G.gen) startPA(); });
}

/* ---------- 타석 ---------- */
function startPA() {
  if (G.phase === 'over') return;
  if (G.prac) return pracPA();
  G.paId = (G.paId || 0) + 1;
  G.awaitPitch = false;
  G.b = 0; G.s = 0; G.pitchLog = []; G.bunt = false; G.stealReq = false; G.cpuBunt = false; G.steal = null;
  UI.bunt.setAttribute('aria-pressed', 'false'); UI.steal.setAttribute('aria-pressed', 'false');
  const ft = fieldTeam(), bt = batTeam();
  if (G.online) { /* 사람 대 사람: CPU 작전 없음 */ }
  else if (userBatting()) cpuManagerPitch(ft, bt);
  else { cpuPinchHit(bt); cpuBuntDecision(bt); }
  { const sb0 = curBatter(); if (sb0.sw) sb0.hand = ft.pitcher.hand === 'R' ? 'L' : 'R'; } // 스위치히터: 투수 반대편 타석
  setupBatter();
  resetField(); placeRunners();
  const b = curBatter();
  setZoneGuide(S.zoneOf(b.height));
  updateBug(); updateLines(); drawTracker(); drawBoard();
  if (bt.lastCard !== b) { bt.lastCard = b; later(0.15, () => { if (curBatter() === b) playerCard(b, bt); }); }
  UI.speedBox.hidden = true;
  camForPA(true);
  if (!userBatting() && G.cpuBunt) G.bs.mode = 'bunt';
  // CPU 고의4구
  if (userBatting() && !G.online && cpuWantsIBB()) {
    G.phase = 'call';
    later(0.9, () => { showCall('고의4구', '#37d67a', 1300); toast(`상대 벤치, ${b.name} 고의4구`); walk('IBB'); });
    return;
  }
  G.phase = 'ready';
  const gen = G.gen;
  later(0.5, () => { if (gen === G.gen) nextPitch(); });
}
function cpuManagerPitch(ft, bt) {
  const p = ft.pitcher, fat = S.fatigueOf(p, p.g.pc);
  const lead = ft.runs - bt.runs;
  const avail = ft.ros.bullpen.filter((x) => !ft.used.includes(x));
  if (!avail.length) return;
  let want = null;
  const cl = avail.find((x) => x.role === 'CL');
  if (cl && G.inning >= G.maxInn && lead >= 1 && lead <= 3 && p.role !== 'CL' && G.outs === 0 && G.b === 0) want = cl;
  else if (fat > 0.72 || p.g.r >= 5 || (p.role !== 'SP' && p.g.outs >= 6 && fat > 0.3)) {
    const pool = avail.filter((x) => x.role !== 'CL' || G.inning >= G.maxInn);
    if (pool.length) want = pool.sort((a, b) => b.stf + b.ctl - (a.stf + a.ctl))[Math.floor(R() * Math.min(2, pool.length))];
  }
  if (want) {
    ft.pitcher = want; ft.used.push(want);
    dressField();
    toast(`상대 투수 교체: ${want.name} (${want.role === 'CL' ? '마무리' : '불펜'})`);
    boardFlash('투수 교체', want.name, 2.2);
  }
}
function cpuBuntDecision(bt) {
  const b = curBatter();
  if (G.outs >= 2 || (!G.bases[0] && !G.bases[1]) || G.bases[2]) return;
  const close = Math.abs(G.T[0].runs - G.T[1].runs) <= 1 && G.inning >= G.maxInn - 1;
  const p = (b.con < 58 ? 0.25 : 0.08) + (close ? 0.25 : 0) - (b.pow > 70 ? 0.2 : 0);
  G.cpuBunt = R() < p;
}
function cpuWantsIBB() {
  const b = curBatter();
  if (G.bases[0] || (!G.bases[1] && !G.bases[2]) || G.outs >= 2) return false;
  const close = Math.abs(G.T[0].runs - G.T[1].runs) <= 1 && G.inning >= G.maxInn;
  return close && b.pow >= 76 && R() < 0.55;
}

/* ---------- 투구 ---------- */
function nextPitch() {
  if (G.phase === 'over' || !G.T) return;
  G.pitch = null; ball.hide(); targetMark.visible = false; pciRing.visible = false;
  const p = fieldTeam().pitcher;
  if (G.bs) { G.bs.mode = (G.bunt || (!userBatting() && G.cpuBunt)) ? 'bunt' : 'stance'; G.bs.load = 0; }
  if (userPitching()) {
    G.phase = 'aim'; G.aimTarget = null;
    startPitchClock();
    if (!p.pitches.includes(G.selType)) G.selType = p.pitches[0];
    buildPitchButtons(); drawPad(); showDocks();
    const fat = S.fatigueOf(p, p.g.pc);
    if (fat > 0.55 && fieldTeam().warned !== p) { fieldTeam().warned = p; toast(`${p.name} 체력이 떨어졌어요 — 투수 교체를 고려해 보세요`, 3000); }
  } else {
    G.phase = 'ready'; G.awaitPitch = true; showDocks();
    if (G.online) return;
    const b = curBatter(), plan = G.prac ? pracPlan(p, b) : S.cpuPitchPlan(p, { b: G.b, s: G.s }, S.zoneOf(b.height));
    const gen = G.gen;
    later(0.8 + R() * 0.7, () => { if (gen === G.gen && G.phase === 'ready') windup(plan.type, plan.target, null); });
  }
}
function padPick(ev) {
  if (G.phase !== 'aim' && G.phase !== 'meter') return;
  G.aimTarget = padToWorld(ev); drawPad();
  if (G.phase === 'aim') startMeter();
  AU.click();
}
function startMeter() {
  G.phase = 'meter';
  const p = fieldTeam().pitcher, fat = S.fatigueOf(p, p.g.pc);
  G.meter = { u: R() < 0.5 ? 0.02 : 0.98, dir: 1, v: 1.6 * G.diff.meter * (1 + fat * 0.6) };
  if (G.meter.u > 0.5) G.meter.dir = -1;
  UI.meter.hidden = false; UI.pad.hidden = true;
}
function updateMeter(dt) {
  const m = G.meter; if (!m) return;
  m.u += m.dir * m.v * dt;
  if (m.u > 1) { m.u = 2 - m.u; m.dir = -1; } else if (m.u < 0) { m.u = -m.u; m.dir = 1; }
  UI.needle.style.left = (m.u * 100).toFixed(2) + '%';
}
function meterTap() {
  if (G.phase !== 'meter' || !G.meter) return;
  const m = clamp(1 - Math.abs(G.meter.u - 0.5) * 2, 0, 1);
  G.meter = null;
  showFeedback([[m > 0.86 ? '완벽한 제구!' : m > 0.6 ? '좋은 제구' : m > 0.35 ? '살짝 흔들림' : '제구 실패', m > 0.6 ? 'good' : 'bad']], 900);
  windup(G.selType, G.aimTarget, m);
}
function windup(type, target, meter) {
  let pi = 0; G.awaitPitch = false;
  if (G.online) {
    target = { x: r4(target.x), y: r4(target.y) }; meter = meter == null ? null : r4(meter);
    if (userPitching()) flushSubsIn();
    pi = ++G.online.pi; S.setRng(onSeed(pi, 1));
    if (userPitching()) sendAct({ k: 'p', pi, t: type, x: target.x, y: target.y, m: meter });
  }
  G.pclock = null; UI.pclock.hidden = true;
  if (!G.prac && G.bases.some(Boolean) && (G.online ? onSeed(pi, 4)() : R()) < BALK_P) { balk(); return; }
  const p = fieldTeam().pitcher, fat = S.fatigueOf(p, p.g.pc), sig = S.pitchSigma(p, fat, meter);
  const tgt = { x: target.x + S.randn() * sig, y: target.y + S.randn() * sig };
  const kmh = S.pitchSpeed(p, type, fat, meter) * ((G.prac && G.prac.spd) || 1), q = S.pitchQuality(p, fat, meter);
  G.pitch = { pt: S.makePitch(p, type, tgt, kmh), type, kmh, q, meter, aim: target, w: 0, ft: 0, released: false, swung: false, launched: false, done: false, cross: tgt, uEnd: 1.06, hand: p.hand, slot: p.slot || 0, pi };
  G.phase = 'windup';
  hideDocks(); if (userBatting()) showDocks();
  if (userPitching()) { targetMark.position.set(target.x, target.y, 0.02); targetMark.visible = true; }
  // 도루 결정
  let k = -1;
  if (G.online) { if (G.stealReq) k = stealBase(); }
  else if (userBatting() && G.stealReq) k = stealBase();
  else if (userPitching()) {
    const sb = stealBase();
    if (sb >= 0) { const r = G.bases[sb]; const pr = sb === 0 ? (r.spd >= 68 ? 0.14 : r.spd >= 60 ? 0.05 : 0) : (r.spd >= 75 ? 0.06 : 0); if (G.s < 2 && G.outs < 2 && R() < pr) k = sb; }
  }
  G.stealReq = false; UI.steal.setAttribute('aria-pressed', 'false');
  if (G.online && !ON.subOut.some((s) => s.t === 'st')) ON.stealWant = false; // 아직 전달 중인 도루 요청이 있으면 버튼 유지
  if (k >= 0) startSteal(k);
}
function stealBase() {
  if (G.bases[1] && !G.bases[2]) return 1;
  if (G.bases[0] && !G.bases[1]) return 0;
  return -1;
}
function startSteal(k) {
  const r = G.bases[k], ft = fieldTeam(), cat = fieldersOf(ft)[1];
  const pSucc = clamp(0.45 + (r.spd - 55) * 0.012 - ((cat && cat.spd) ? 0 : 0) - (k === 1 ? 0.05 : 0), 0.25, 0.92);
  G.steal = { k, who: r, fig: G.runFig[k], ok: (G.online && G.pitch ? onSeed(G.pitch.pi, 5)() : R()) < pSucc, t0: clock + 0.1, arrive: 0, throwT: 0, throwArr: 0, phase: 'run' };
}
function handPos(f, left, out) { return (left ? f.lA : f.rA).hand.localToWorld(out.set(0, -0.3, 0)); }
function gloveOf(f, out) { return f.lA.hand.localToWorld(out.set(0, -0.33, 0.02)); }
const _hp = new T.Vector3(), _bp = { x: 0, y: 0, z: 0 }, _gv = new T.Vector3();
function release() {
  const P = G.pitch, p = fieldTeam().pitcher;
  FIG.P.root.updateMatrixWorld(true);
  handPos(FIG.P, P.hand === 'L', _hp);
  P.pt.rel = { x: _hp.x, y: _hp.y, z: _hp.z };
  P.pt.dur = Math.abs(_hp.z) / (P.kmh / 3.6);
  P.uEnd = 1 + 1.0 / Math.abs(_hp.z);
  P.released = true; G.phase = 'flight';
  p.g.pc++;
  G.lastSpeed = P.kmh;
  ball.hot = clamp((P.kmh - 138) / 14, 0, 1);
  if (P.kmh >= 150) { UI.speedBox.classList.remove('fire'); void UI.speedBox.offsetWidth; UI.speedBox.classList.add('fire'); } else UI.speedBox.classList.remove('fire');
  UI.speedV.textContent = Math.round(P.kmh); UI.speedT.textContent = S.PITCHES[P.type].name; UI.speedBox.hidden = false;
  if (userPitching() && !G.online) {
    const b = curBatter(), zi = S.zoneInfo(S.zoneOf(b.height), P.cross.x, P.cross.y);
    if (G.cpuBunt) {
      const ok = zi.inside || zi.out < 0.06;
      if (!ok && G.b < 3) P.cpu = { swing: false };
      else if (R() < 0.8) P.cpu = { swing: true, contact: true, bunt: true, ev: 30 + R() * 18, la: -15 + R() * 10, phi: (R() < 0.5 ? -1 : 1) * (8 + R() * 26) };
      else if (R() < 0.6) P.cpu = { swing: true, contact: true, bunt: true, foul: true, ev: 40, la: 20, phi: (R() < 0.5 ? -1 : 1) * 62 };
      else P.cpu = { swing: true, contact: false, bunt: true };
    } else P.cpu = S.cpuSwing(b, P.pt, zi, { b: G.b, s: G.s }, G.diff, p.hand, P.q);
    if (G.prac && G.prac.kind === 'pit' && !G.prac.swing) P.cpu = { swing: false };
  }
  if (G.steal) planSteal();
}
function timeScale() { return userBatting() ? G.diff.ts : 0.9; }
function updatePitch(dt) {
  const P = G.pitch; if (!P) return;
  const left = P.hand === 'L';
  if (G.phase === 'windup') {
    P.w += dt;
    const u = P.w / WIND;
    pitcherPose(FIG.P, u, P.hand, P.slot);
    if (G.bs && G.bs.mode === 'stance') G.bs.load = clamp((u - 0.35) / 0.4, 0, 1);
    FIG.P.root.updateMatrixWorld(true);
    handPos(FIG.P, left, _hp); ball.set(_hp.x, _hp.y, _hp.z, 1); ball.pushTrail(false);
    if (u >= REL_U) release();
    return;
  }
  if (G.phase !== 'flight') return;
  // 투수 팔로스루
  P.w += dt; pitcherPose(FIG.P, Math.min(P.w / WIND, 1), P.hand, P.slot);
  const ts = timeScale();
  P.ft += dt * ts;
  const dur = P.pt.dur;
  // CPU 타자
  if (P.cpu && P.cpu.swing && !P.swung && P.ft >= dur - SW_TC - (P.cpu.bunt ? 0.3 : 0)) {
    P.swung = true;
    if (P.cpu.bunt) { G.bs.mode = 'bunt'; }
    else {
      const cp = S.pitchPos(P.pt, 1, {});
      const off = P.cpu.contact ? 0 : 0.12 + R() * 0.12;
      batterSwing(new T.Vector3(cp.x + (R() - 0.5) * off, cp.y + (R() < 0.5 ? -off : off), cp.z));
      AU.swish();
    }
    P.contactT = dur; P.contactU = 1;
  }
  if (P.cpu && P.cpu.contact && !P.launched && P.ft >= dur) { contact(P.cpu); return; }
  if (P.user && !P.user.miss && !P.launched && P.ft >= P.contactT) { contact(P.user); return; }
  const u = Math.min(P.ft / dur, P.uEnd);
  S.pitchPos(P.pt, u, _bp);
  ball.set(_bp.x, _bp.y, _bp.z, userBatting() ? 1.25 : 1.5); ball.pushTrail(true);
  if (P.ft / dur >= P.uEnd && !P.done && (!G.online || userBatting() || P.remoteIn)) { P.done = true; pitchArrived(); }
}
// 유저 스윙 (탭)
function userSwingTap(aim) {
  const P = G.pitch;
  if (!P || G.phase !== 'flight' || P.swung || !userBatting() || !aim) return;
  P.swung = true;
  const e = P.ft - (P.pt.dur - SW_TC - 0.005);
  const b = curBatter();
  const res = S.userSwing(b, aim, P.cross, e, G.diff, G.bunt, fieldTeam().pitcher.hand);
  P.user = res;
  const uc = clamp((P.ft + SW_TC) / P.pt.dur, 0.88, 1.05);
  P.contactU = uc; P.contactT = uc * P.pt.dur;
  const cp = S.pitchPos(P.pt, uc, {});
  if (G.online) {
    if (!res.miss) { res.ev = r4(res.ev); res.la = r4(res.la); res.phi = r4(res.phi); res.q = r4(res.q || 0); res.st = { x: r4(cp.x), y: r4(cp.y), z: r4(cp.z) }; }
    res.bunt = !!G.bunt;
    sendAct(res.miss ? { k: 'sw', pi: P.pi, miss: 1, bunt: res.bunt ? 1 : 0 } : { k: 'sw', pi: P.pi, foul: res.foul ? 1 : 0, bunt: res.bunt ? 1 : 0, ev: res.ev, la: res.la, phi: res.phi, q: res.q, st: res.st, tl: res.tl });
  }
  if (!G.bunt) {
    batterSwing(res.miss ? new T.Vector3(aim.x, aim.y, cp.z) : new T.Vector3(cp.x, cp.y, cp.z));
    AU.swish();
  }
  showRing(aim, true);
  if (res.miss) showFeedback([[G.bunt ? '번트 실패' : '헛스윙', 'bad'], [res.tl === '굿' ? '코스가 빗나감' : `타이밍 ${res.tl}`, 'm']], 1100);
  else if (!res.foul && !res.bunt) showFeedback([[`타이밍 ${res.tl}`, res.tl === '굿' ? 'good' : 'm'], [res.cl, res.q > 0.6 ? 'good' : 'm']], 1300);
}
function isHBP(cr, b) {
  const s = b.hand === 'R' ? -1 : 1;
  return cr.x * s > 0.62 && cr.y > 0.25 && cr.y < 1.75;
}
function pitchArrived() {
  const P = G.pitch, b = curBatter(), z = S.zoneOf(b.height), cr = P.cross;
  if (G.online) { if (userBatting() && !P.swung) sendAct({ k: 'sw', pi: P.pi, take: 1 }); GR = onSeed(P.pi, 3); }
  AU.mitt();
  let kind;
  const swung = (P.user && P.user.miss) || (P.cpu && P.cpu.swing && !P.cpu.contact);
  if (swung) kind = 'swing';
  else if (isHBP(cr, b)) kind = 'hbp';
  else kind = S.inZone(z, cr.x, cr.y) ? 'strike' : 'ball';
  G.pitchLog.push({ x: cr.x, y: cr.y, res: kind === 'ball' || kind === 'hbp' ? 'ball' : 'strike' });
  // 폭투·포일: 원바운드(존 아래로 크게 떨어진 공), 크게 빠진 공일수록 확률↑  (주자 없으면 낫아웃 때만 의미)
  const zi = S.zoneInfo(z, cr.x, cr.y), brk = S.PITCHES[P.type].brk, dirt = cr.y < z.bot - 0.12;
  G.pendingWP = null; G.lastCross = { x: cr.x, y: cr.y }; G.lastDirt = dirt;
  if (!G.steal && kind !== 'hbp') {
    const pwp = FORCE.includes('wp') ? 0.35 : (dirt ? (brk ? 0.05 : 0.025) : 0) + (zi.out > 0.35 ? 0.03 : 0) + 0.0015;
    if (GR() < pwp) G.pendingWP = zi.inside ? '포일' : '폭투';
  }
  G.dropRoll = GR(); // 원바운드 공을 포수가 깔끔하게 잡았는지 (낫아웃)
  const gen = G.gen;
  if (!G.pendingWP) later(0.35, () => { if (gen === G.gen && !G.adv) ball.hide(); });
  call(kind);
}

/* ---------- 판정 ---------- */
function call(kind) {
  if (G.prac) return pracCall(kind);
  G.phase = 'call';
  const pit = fieldTeam().pitcher, b = curBatter(), outsBefore = G.outs, basesBefore = G.bases.slice();
  let end = null;
  if (kind === 'ball') { G.b++; if (G.b >= 4) end = 'BB'; else showCall('볼', '#37d67a', 800); }
  else if (kind === 'hbp') { end = 'HBP'; }
  else { G.s++; if (G.s >= 3) end = 'K'; else showCall(kind === 'swing' ? '헛스윙' : '스트라이크', '#ffc93c', 800); umpCall(); }
  updateBug(); drawTracker(); drawBoard(); updateLines();
  targetMark.visible = false;
  const gen = G.gen;
  const go = (d, fn) => later(d, () => { if (gen === G.gen) fn(); });
  const st = G.steal;
  if (end === 'BB' || end === 'HBP') {
    G.pendingWP = null;
    if (st) { st.phase = 'cancel'; }
    showCall(end === 'BB' ? '볼넷' : '몸에 맞는 공', '#37d67a', 1200);
    go(0.5, () => walk(end));
    return;
  }
  if (end === 'K') {
    b.g.pa++; b.g.ab++; b.g.k++; pit.g.k++; G.outs++; pit.g.outs++;
    showCall(kind === 'swing' ? '헛스윙 삼진!' : '루킹 삼진!', '#ff4b4b', 1300); fxStrikeout(userPitching());
    AU.cheer(userPitching() ? 0.8 : 0.3, 1.4); crowdPulse(G.half === 0 ? 'H' : 'A', 0.8);
    if (G.batFig) G.batFig.mode = 'bat';
    showPlayText(`${b.name}, ${kind === 'swing' ? '헛스윙' : '루킹'} 삼진`, 1600);
    updateBug();
  }
  let wp = G.pendingWP; G.pendingWP = null;
  // 낫아웃(스트라이크 낫아웃): 1루가 비었거나 2아웃이면 타자가 1루로 뛸 수 있다
  const kEligible = end === 'K' && (!basesBefore[0] || outsBefore === 2);
  let adv = null;
  if (end === 'K' && wp && kEligible) {
    G.outs--; pit.g.outs--; // 삼진은 기록되지만 아웃은 아님
    adv = { kind: wp, batter: true, text: `낫아웃 ${wp}! ${b.name} 1루 세이프` };
  } else if (wp && G.outs < 3 && basesBefore.some(Boolean)) {
    adv = { kind: wp, batter: false, text: `${wp}! 주자들이 한 베이스씩 진루` };
  } else if (end === 'K' && !wp && G.lastDirt && kind === 'swing' && kEligible && G.dropRoll < 0.55) {
    adv = { kind: '낫아웃', batter: true, thrownOut: true, text: `낫아웃! 포수가 1루로 던져 ${b.name} 아웃` };
  }
  const after = () => {
    if (checkWalkoff()) return;
    if (end === 'K') { advanceOrder(); afterPA(0.6); }
    else if (G.outs >= 3) { afterPA(0.4, true); }
    else go(0.2, nextPitch);
  };
  if (adv) {
    if (st) { st.phase = 'cancel'; G.steal = null; }
    startAdvance(adv, () => go(0.35, after));
    return;
  }
  if (st && st.phase !== 'cancel') {
    const wait = Math.max(0.6, st.done - clock + 0.1);
    go(wait, () => { finishSteal(); after(); });
  } else go(end === 'K' ? 1.3 : 0.75, after);
}
function umpCall() {
  const u = FIG.ump[0]; u.callT = clock;
}
function advanceOrder() { const bt = batTeam(); bt.order = (bt.order + 1) % 9; }
function afterPA(delay, noAdvance) {
  void noAdvance;
  const gen = G.gen;
  if (G.phase === 'over') return;
  if (checkWalkoff()) return;
  if (G.outs >= 3) { G.phase = 'after'; later(delay + 0.6, () => { if (gen === G.gen) endHalf(); }); return; }
  G.phase = 'after';
  later(delay, () => { if (gen === G.gen) startPA(); });
}
function addRuns(n, scorers) {
  if (n <= 0) return;
  const bt = batTeam(), pit = fieldTeam().pitcher;
  bt.runs += n; bt.line[G.inning - 1] = (bt.line[G.inning - 1] || 0) + n; pit.g.r += n;
  (scorers || []).slice(0, n).forEach((r) => r && r.g && r.g.r++);
  const homeScores = bt === G.T[1];
  crowdPulse(homeScores ? 'H' : 'A', 1.2);
  AU.cheer(1, 2.6); AU.drum('x.x.xxx.x.x.xxx.', 170);
  boardFlash(n > 1 ? `${n}점!` : '득점!', `${bt.t.city} ${bt.runs} : ${fieldTeam().runs} ${fieldTeam().t.city}`, 3);
  updateBug(); drawBoard();
}
function walk(kind) {
  const b = curBatter(), pit = fieldTeam().pitcher, bt = batTeam();
  b.g.pa++; b.g.bb++; bt.bb++;
  if (kind !== 'HBP') pit.g.bb++;
  const B = G.bases, scored = [];
  if (B[0]) { if (B[1]) { if (B[2]) scored.push(B[2]); B[2] = B[1]; } B[1] = B[0]; }
  B[0] = b;
  // 도루 중이던 비포스 주자
  if (G.steal && G.steal.phase === 'cancel') {
    const st = G.steal, k = st.k;
    if (G.bases[k] === st.who && !G.bases[k + 1] && k < 2) { G.bases[k + 1] = st.who; G.bases[k] = null; }
    G.steal = null;
  }
  if (scored.length) { b.g.rbi += scored.length; addRuns(scored.length, scored); showPlayText('밀어내기 득점!', 1800); }
  else showPlayText(kind === 'HBP' ? `${b.name}, 몸에 맞는 공으로 출루` : kind === 'IBB' ? `${b.name} 고의4구로 출루` : `${b.name}, 볼넷으로 출루`, 1600);
  if (G.batFig) showFigure(G.batFig, false);
  placeRunners();
  updateBug(); drawBoard();
  advanceOrder();
  afterPA(1.1);
}
function ibb() {
  if (!userPitching() || G.phase !== 'aim') return;
  if (G.online) sendAct({ k: 'ibb' });
  G.phase = 'call'; hideDocks();
  showCall('고의4구', '#37d67a', 1200);
  walk('IBB');
}

/* ---------- 도루 ---------- */
function planSteal() {
  const st = G.steal, P = G.pitch;
  const plate = clock + (P.pt.dur * (P.uEnd)) / timeScale();
  const to = S.basePos(st.k + 2);
  st.throwT = plate + 0.65;
  st.throwArr = st.throwT + Math.hypot(to.x - 0, to.z - 1) / 31;
  st.arrive = st.throwArr + (st.ok ? -0.14 : 0.28);
  st.done = st.arrive + 0.35;
  st.coverF = st.k === 0 ? (curBatter().hand === 'L' ? 5 : 3) : 4;
  if (G.runFig[st.k]) G.runFig[st.k].mode = 'steal';
  showCall('도루!', '#ffb627', 800);
}
function updateSteal(dt) {
  const st = G.steal; if (!st || !st.arrive) return;
  const f = st.fig; if (!f) return;
  const a = runnerSpot(st.k, f.lead || 3), b = S.basePos(st.k + 2);
  const s = clamp((clock - st.t0) / (st.arrive - st.t0), 0, 1);
  const x = lerp(a.x, b.x, s), z = lerp(a.z, b.z, s);
  placeFig(f, x, z); faceTo(f, b.x, b.z);
  if (s < 1) runPose(f, 7.5, dt); else { f.P = f.P || {}; blendPose(f.P, f.P, POSE.stand, 0.2); applyPose(f); }
  // 커버 야수
  const cf = FIG.field[st.coverF], cs = clamp((clock - (st.throwT - 0.9)) / 0.9, 0, 1);
  if (cs > 0 && cs <= 1) { const h = S.FIELD_HOME[st.coverF]; placeFig(cf, lerp(h.x, b.x + 0.6, cs), lerp(h.z, b.z + 0.6, cs)); faceTo(cf, 0, 0); if (cs < 1) runPose(cf, 5, dt); }
  // 송구
  if (clock >= st.throwT && clock < st.throwArr) {
    const k = (clock - st.throwT) / (st.throwArr - st.throwT), d = Math.hypot(b.x, b.z - 1);
    ball.set(lerp(0, b.x, k), lerp(1.6, 0.9, k) + Math.sin(k * Math.PI) * d * 0.02, lerp(1, b.z, k), 1.6);
    ball.pushTrail(true);
    if (!st.thrown) { st.thrown = true; const c = FIG.field[1]; c.tp = POSE.throwFwd; }
  } else if (clock >= st.throwArr && !st.caught) { st.caught = true; AU.glove(); ball.set(b.x + 0.4, 0.5, b.z + 0.4, 1.4); ball.pushTrail(false); cf.tp = POSE.catchLow; }
}
function finishSteal() {
  const st = G.steal; if (!st) return;
  G.steal = null;
  const pit = fieldTeam().pitcher;
  if (G.bases[st.k] !== st.who) { placeRunners(); return; }
  G.bases[st.k] = null;
  if (st.ok) {
    G.bases[st.k + 1] = st.who; st.who.g.sb++;
    showCall('세이프!', '#37d67a', 1000); showPlayText(`${st.who.name}, ${st.k + 2}루 도루 성공!`, 1600);
    AU.cheer(0.7, 1.5); crowdPulse(G.half ? 'H' : 'A', 0.7);
  } else {
    G.outs++; pit.g.outs++;
    showCall('아웃!', '#ff4b4b', 1000); showPlayText(`${st.who.name}, 도루 실패`, 1600);
  }
  ball.hide(); placeRunners(); resetField(); updateBug(); drawBoard();
}

/* ---------- 이닝 / 경기 종료 ---------- */
function checkWalkoff() {
  if (G.half === 1 && G.inning >= G.maxInn && G.T[1].runs > G.T[0].runs) {
    G.phase = 'over';
    const gen = G.gen;
    showBanner('끝내기!', `${G.T[1].t.city} ${G.T[1].t.name} 승리`, 3000);
    later(1.2, () => { if (gen === G.gen) gameOver(); });
    return true;
  }
  return false;
}
function endHalf() {
  const A = G.T[0].runs, H = G.T[1].runs;
  hideDocks(); G.phase = 'after';
  if (G.half === 0) {
    if (G.inning >= G.maxInn && H > A) return gameOver();
    G.half = 1;
  } else {
    if (G.inning >= G.maxInn && A !== H) return gameOver();
    if (G.inning >= G.limitInn) return gameOver();
    G.half = 0; G.inning++;
    if (G.inning > G.maxInn) toast(`연장 ${G.inning}회 — 최대 ${G.limitInn}회까지!`, 2600);
  }
  showCall('공수교대', '#ffffff', 1200);
  const gen = G.gen;
  later(1.3, () => { if (gen === G.gen) startHalf(); });
}
function gameOver() {
  if (G.online) { const on = G.online; on.done = 1; setTimeout(() => { if (G.online === on) endOnline(); }, 9000); }
  G.phase = 'over'; hideDocks(); UI.skip.hidden = true;
  const me = G.T[G.userSide], op = G.T[1 - G.userSide];
  const r = me.runs > op.runs ? 'win' : me.runs < op.runs ? 'lose' : 'draw';
  if (G.online) onlineResult(r);
  const rec = store.get('rec', {}), id = me.t.id;
  rec[id] = rec[id] || { w: 0, l: 0, d: 0 };
  rec[id][r === 'win' ? 'w' : r === 'lose' ? 'l' : 'd']++;
  store.set('rec', rec);
  if (G.season) seasonAfterGame();
  boardFlash('게임 셋', `${G.T[0].t.city} ${G.T[0].runs} : ${G.T[1].runs} ${G.T[1].t.city}`, 60);
  drawBoard(); updateBug();
  if (r === 'win') { AU.cheer(1.2, 3.5); AU.drum('x.x.xxx.x.x.xxx.', 170); fireShowBig(me); later(1.8, () => fxWin(me)); crowdPulse(me === G.T[1] ? 'H' : 'A', 2.5); }
  else if (r === 'lose') { AU.groan(); crowdPulse(op === G.T[1] ? 'H' : 'A', 2.5); }
  camOrbit();
  const gen = G.gen;
  later(r === 'win' ? 2.4 : 1.6, () => { if (gen === G.gen) showOver(r); });
}
function mvpOf(tm) {
  let best = null, bs = -1e9;
  tm.lineup.concat(tm.out).forEach((b) => { const s = b.g.h * 1 + b.g.hr * 2.5 + b.g.rbi * 1.2 + b.g.r * 0.6 + b.g.bb * 0.4 + b.g.sb * 0.5 - b.g.k * 0.2; if (s > bs) { bs = s; best = { p: b, bat: true }; } });
  tm.used.forEach((p) => { const s = (p.g.outs / 3) * 0.9 + p.g.k * 0.35 - p.g.r * 1.2 - p.g.bb * 0.2; if (s > bs) { bs = s; best = { p, bat: false }; } });
  return best;
}
function showOver(r) {
  const me = G.T[G.userSide], op = G.T[1 - G.userSide];
  const el = $('#overRes'); el.className = 'result ' + r;
  el.textContent = r === 'win' ? '승리!' : r === 'lose' ? '패배' : '무승부';
  $('#overH').textContent = G.inning > G.maxInn ? `경기 종료 · 연장 ${G.inning}회` : '경기 종료';
  $('#overLS').innerHTML = lineScoreHTML();
  const win = r === 'lose' ? op : me;
  const m = mvpOf(win);
  if (m) {
    const g = m.p.g;
    const line = m.bat ? `${g.ab}타수 ${g.h}안타${g.hr ? ` ${g.hr}홈런` : ''}${g.rbi ? ` ${g.rbi}타점` : ''}${g.sb ? ` ${g.sb}도루` : ''}`
      : `${Math.floor(g.outs / 3)}${g.outs % 3 ? '⅓⅔'[g.outs % 3 - 1] : ''}이닝 ${g.k}K ${g.r}실점`;
    $('#overMvp').innerHTML = `${avatarHTML(m.p, 'md')}<span class="tagm">MVP</span><div><b>${esc(m.p.name)}</b> <span style="opacity:.7">${esc(win.t.city)} · ${m.bat ? m.p.posK : '투수'}</span><br><span style="font-size:13px">${line}</span></div>`;
  } else $('#overMvp').innerHTML = '';
  const hr = me.lineup.concat(me.out).reduce((a, b) => a + b.g.hr, 0), k = op.lineup.concat(op.out).reduce((a, b) => a + b.g.k, 0);
  const rec = recOf(OPTS.me);
  $('#overStats').innerHTML = `<div><b>${me.hits}</b>우리 안타</div><div><b>${hr}</b>우리 홈런</div><div><b>${k}</b>탈삼진</div>` +
    `<div style="grid-column:1/-1"><b style="font-size:15px">${esc(me.t.city)} ${esc(me.t.name)} · ${rec.w}승 ${rec.l}패 ${rec.d}무</b>통산 전적</div>`;
  $('#againBtn').textContent = G.season ? '시즌 화면으로' : '같은 매치업 다시';
  if (G.season) $('#overStats').innerHTML += `<div style="grid-column:1/-1"><b style="font-size:15px">${esc(seasonLine())}</b>시즌 성적</div>`;
  $('#overModal').hidden = false;
  $('#againBtn').focus();
}
function lineScoreHTML() {
  const n = Math.max(G.maxInn, G.inning);
  let h = '<tr><th></th>';
  for (let i = 1; i <= n; i++) h += `<th>${i}</th>`;
  h += '<th class="sep">R</th><th>H</th><th>E</th><th>B</th></tr>';
  G.T.forEach((tm, ti) => {
    h += `<tr><td class="t" style="border-left:4px solid ${tm.t.c1}">${esc(tm.t.city)}</td>`;
    for (let i = 0; i < n; i++) {
      const v = tm.line[i];
      h += `<td>${v == null ? (ti === 1 && i === G.inning - 1 && G.half === 0 ? 'X' : '') : v}</td>`;
    }
    h += `<td class="R sep">${tm.runs}</td><td>${tm.hits}</td><td>${tm.err}</td><td>${tm.bb}</td></tr>`;
  });
  return h;
}

/* ---------- 불펜 ---------- */
function openPen() {
  if (!userPitching() || (G.phase !== 'aim' && G.phase !== 'meter')) { toast('투구 준비 중에만 교체할 수 있어요'); return; }
  const tm = fieldTeam(), cur = tm.pitcher;
  $('#penSub').textContent = `현재 ${cur.name} · ${cur.g.pc}구 · 체력 ${Math.round((1 - S.fatigueOf(cur, cur.g.pc)) * 100)}%`;
  const list = $('#penList'); list.innerHTML = '';
  tm.ros.bullpen.forEach((p) => {
    const used = tm.used.includes(p);
    const b = document.createElement('button'); b.className = 'pcard'; b.disabled = used;
    b.innerHTML = `<b>${avatarHTML(p, 'xs2')} ${esc(p.name)} <span style="font-weight:500;opacity:.7">${p.hand === 'L' ? '좌' : '우'}투</span></b><span class="role">${p.role === 'CL' ? '마무리' : '불펜'}</span>` +
      `<span class="r">${used ? '이미 등판' : pitInfo(p)}</span>`;
    b.addEventListener('click', () => { changePitcher(tm, p); closeModal('#penModal'); });
    list.appendChild(b);
  });
  openModal('#penModal');
}
function changePitcher(tm, p, remote) {
  if (G.online && !remote) sendAct({ k: 'pc', key: p.key });
  tm.pitcher = p; tm.used.push(p);
  dressField(); pitcherPose(FIG.P, 0, p.hand, p.slot);
  G.selType = p.pitches[0]; buildPitchButtons(); drawPad(); updateLines(); drawBoard();
  toast(`투수 교체: ${p.name}`); boardFlash('투수 교체', p.name, 2.2); AU.whistle(); playerCard(p, tm, true);
  if (G.phase === 'meter') { G.phase = 'aim'; G.meter = null; UI.meter.hidden = true; G.aimTarget = null; }
  if (!remote && G.phase === 'aim') { showDocks(); drawPad(); } // 존 패드 다시 표시 (미터 중 교체 시 패드가 숨겨진 채 멈추던 버그)
}

/* ---------- 도크 / HUD ---------- */
function showDocks() {
  if (G.phase === 'adv') { hideDocks(); return; }
  const bat = userBatting(); pracChips();
  UI.dockBat.hidden = !bat; UI.dockPit.hidden = bat;
  UI.pad.hidden = bat || G.phase !== 'aim';
  UI.meter.hidden = G.phase !== 'meter';
  if (bat) {
    const canPre = G.phase === 'ready';
    UI.bunt.disabled = !canPre; UI.steal.disabled = !canPre || stealBase() < 0 || G.outs >= 2 && false;
    $('#phBtn').hidden = $('#prBtn').hidden = UI.steal.hidden = !!G.prac;
    if (G.online) UI.steal.setAttribute('aria-pressed', String(!!ON.stealWant));
    $('#phBtn').disabled = !canPre || !batTeam().bench.length; $('#prBtn').disabled = !canPre || !batTeam().bench.length || !G.bases.some(Boolean);
    $('#batHint').textContent = (G.bunt ? '번트 자세! 공이 오면 탭해서 갖다 대기' : isTouch ? '공이 오면 칠 곳을 탭!' : '공이 오면 칠 곳을 클릭 (조준 후 스페이스)') + (G.zoneOn && zoneGuide.heat.visible ? ' · 빨강 = 강한 코스' : '');
  }
  zoneGuide.visible = bat && G.zoneOn;
}
function pracChips() { const pr = !!G.prac; $('#ibbBtn').hidden = pr; $('#defBtn').hidden = pr; }
function hideDocks() {
  UI.dockBat.hidden = true; UI.dockPit.hidden = true; UI.pad.hidden = true; UI.meter.hidden = true;
  zoneGuide.visible = false;
}
function showRing(aim, flash) {
  const b = curBatter(); if (!b) return;
  const r0 = (0.1 + b.con * 0.0006) * G.diff.pci * 1.35;
  pciRing.scale.setScalar(r0); pciRing.position.set(aim.x, aim.y, 0.03); pciRing.visible = true;
  pciRing.flash = flash ? clock + 0.35 : 0;
}
function crowdPulse(side, amt) {
  if (side === 'H') cheerU.uCH.value = Math.max(cheerU.uCH.value, amt);
  else cheerU.uCA.value = Math.max(cheerU.uCA.value, amt);
}
function fireShow(n) {
  for (let i = 0; i < n; i++) later(i * 0.35, () => { burst((R() - 0.5) * 120, 50 + R() * 30, -120 - R() * 40, ['#ffb627', '#ff4b4b', '#37d67a', '#5aa9ff', '#ffffff'][i % 5]); AU.boom(); });
}
function openModal(sel) { $(sel).hidden = false; const b = $(sel).querySelector('button'); if (b) b.focus(); }
function closeModal(sel) { $(sel).hidden = true; }

