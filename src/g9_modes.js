/* ===================== 훈련 모드 ===================== */
const PR_DEF = {
  bat: { type: 'ANY', course: 'rand', spd: 1, batter: 0 },
  pit: { pitcher: 0, swing: true },
};
function pracCfg(kind) { return Object.assign({}, PR_DEF[kind], store.get('prac_' + kind, {})); }
function startPractice(kind) {
  const c = pracCfg(kind);
  const opp = (OPTS.me + 1) % 10;
  const prac = { kind, st: { n: 0, sw: 0, con: 0, h: 0, hr: 0, maxEv: 0, maxD: 0, good: 0, str: 0, kmh: 0, err: 0, whiff: 0, bip: 0, hits: 0 } };
  Object.assign(prac, c);
  startGame({ prac, home: kind === 'bat' ? 0 : 1, opp, inn: 99, diff: OPTS.diff });
}
function pracStart() {
  const P = G.prac, me = G.T[G.userSide], op = G.T[1 - G.userSide];
  G.maxInn = 99; G.limitInn = 99; G.inning = 1;
  G.half = P.kind === 'bat' ? G.userSide : 1 - G.userSide;
  if (P.kind === 'bat') {
    op.pitcher = op.ros.rotation[0]; op.used = [op.pitcher];
    me.order = clamp(P.batter | 0, 0, 8);
  } else {
    const all = me.ros.rotation.concat(me.ros.bullpen);
    me.pitcher = all[clamp(P.pitcher | 0, 0, all.length - 1)]; me.used = [me.pitcher];
  }
  G.outs = 0; G.bases = [null, null, null];
  dressField(); resetField(); placeRunners();
  $('#pracK').textContent = P.kind === 'bat' ? '타격 훈련' : '투구 훈련';
  pracText();
  showBanner(P.kind === 'bat' ? '타격 훈련' : '투구 훈련', P.kind === 'bat' ? '공을 보고 탭! · 설정에서 구종/코스/구속 변경' : '구종 → 코스 → 게이지 · 설정에서 투수/타자 스윙 변경', 1800);
  const gen = G.gen;
  later(1.2, () => { if (gen === G.gen) pracPA(); });
}
function pracPA() {
  G.b = 0; G.s = 0; G.pitchLog = []; G.bunt = false; G.steal = null; G.bases = [null, null, null];
  setupBatter(); resetField(); placeRunners();
  setZoneGuide(S.zoneOf(curBatter().height));
  updateBug(); updateLines(); drawTracker(); drawBoard();
  camForPA(true);
  G.phase = 'ready';
  const gen = G.gen;
  later(0.4, () => { if (gen === G.gen) nextPitch(); });
}
function pracPlan(p, b) {
  const P = G.prac, z = S.zoneOf(b.height), base = S.cpuPitchPlan(p, { b: 1, s: 1 }, z);
  let type = P.type === 'ANY' ? base.type : P.type;
  let target = base.target;
  if (P.course === 'zone') target = { x: (R() * 2 - 1) * (z.half - 0.04), y: lerp(z.bot + 0.05, z.top - 0.05, R()) };
  else if (P.course === 'mid') target = { x: (R() - 0.5) * 0.08, y: (z.bot + z.top) / 2 + (R() - 0.5) * 0.08 };
  return { type, target };
}
function pracText() {
  const P = G.prac, s = P.st;
  $('#pracTxt').textContent = P.kind === 'bat'
    ? `${s.n}구 · 안타 ${s.h} · 홈런 ${s.hr}${s.maxEv ? ` · 최고 ${Math.round(s.maxEv)}km/h` : ''}${s.maxD ? ` · 최장 ${Math.round(s.maxD)}m` : ''}`
    : `${s.n}구 · 스트라이크 ${s.n ? Math.round((s.str / s.n) * 100) : 0}% · 평균 ${s.n ? Math.round(s.kmh / s.n) : 0}km/h · 오차 ${s.n ? Math.round((s.err / s.n) * 100) : 0}cm · 헛스윙 ${s.whiff}`;
}
function pracPitchStat(kind) {
  const P = G.prac, s = P.st, pt = G.pitch;
  s.n++;
  if (P.kind === 'pit' && pt) {
    s.kmh += pt.kmh;
    if (pt.aim) s.err += Math.hypot(pt.aim.x - pt.cross.x, pt.aim.y - pt.cross.y);
    if (kind === 'strike' || kind === 'swing' || kind === 'foul' || kind === 'play') s.str++;
    if (kind === 'swing') s.whiff++;
    const e = pt.aim ? Math.round(Math.hypot(pt.aim.x - pt.cross.x, pt.aim.y - pt.cross.y) * 100) : 0;
    showPlayText(`${Math.round(pt.kmh)}km/h ${S.PITCHES[pt.type].name} · 목표와 ${e}cm 차이`, 1600);
  }
  if (fieldTeam()) fieldTeam().pitcher.g.pc = 0;
  if (P.kind === 'bat') { if (kind === 'swing') s.sw++; }
}
function pracCall(kind) {
  G.phase = 'call';
  if (kind === 'ball') { G.b++; showCall(G.b >= 4 ? '볼넷' : '볼', '#37d67a', 700); }
  else if (kind === 'hbp') showCall('몸에 맞는 공', '#37d67a', 800);
  else { G.s++; showCall(G.s >= 3 ? '삼진!' : kind === 'swing' ? '헛스윙' : '스트라이크', '#ffc93c', 700); umpCall(); }
  pracPitchStat(kind);
  if (G.b >= 4 || G.s >= 3 || kind === 'hbp') { G.b = 0; G.s = 0; G.pitchLog = []; }
  updateBug(); drawTracker(); drawBoard(); pracText();
  targetMark.visible = false;
  const gen = G.gen;
  later(0.8, () => { if (gen === G.gen) { if (G.s === 0 && G.b === 0 && G.prac.kind === 'pit') pracNextBatter(); else nextPitch(); } });
}
function pracNextBatter() { const bt = batTeam(); bt.order = (bt.order + 1) % 9; pracPA(); }
function pracPlay(play) {
  const P = G.prac, s = P.st, res = play.res, tr = play.tr, sw = play.sw;
  G.play = null; ball.hide();
  const hit = ['1B', '2B', '3B', 'HR', 'IFH', 'BUNT_HIT'].includes(res.kind);
  if (res.kind === 'FOUL') { if (G.s < 2) G.s++; pracPitchStat('foul'); }
  else {
    pracPitchStat('play');
    s.bip++;
    if (hit) { s.h++; s.hits++; }
    if (res.kind === 'HR') s.hr++;
  }
  if (P.kind === 'bat' && res.kind !== 'FOUL') {
    s.con++;
    s.maxEv = Math.max(s.maxEv, sw.ev || 0);
    s.maxD = Math.max(s.maxD, tr.carry || 0);
    const nm = { '1B': '안타', '2B': '2루타', '3B': '3루타', HR: '홈런', IFH: '내야안타', BUNT_HIT: '번트안타', E: '실책 출루', FOUL_OUT: '파울플라이 아웃', GO: '땅볼 아웃', DP: '병살', FLY: '뜬공 아웃', LINE: '직선타 아웃', POP: '내야 뜬공', SF: '희생플라이', FC: '야수선택', SAC: '희생번트' }[res.kind] || res.kind;
    showPlayText(`타구 ${Math.round(sw.ev || 0)}km/h · 발사각 ${Math.round(sw.la || 0)}° · ${Math.round(tr.carry || 0)}m → ${nm}`, 2600);
  }
  if (res.kind !== 'FOUL') { G.b = 0; G.s = 0; G.pitchLog = []; }
  G.outs = 0; G.bases = [null, null, null];
  pracText(); updateBug(); drawBoard();
  resetAfterPlay(res.kind === 'FOUL' || P.kind === 'bat');
  G.phase = 'after';
  const gen = G.gen;
  later(0.5, () => {
    if (gen !== G.gen) return;
    if (P.kind === 'pit' && res.kind !== 'FOUL') pracNextBatter();
    else { if (G.batFig) { G.batFig.mode = 'bat'; G.batFig.bat.visible = true; } nextPitch(); }
  });
}
// 설정 모달
function segHTML(key, opts, cur) {
  return `<div class="seg" data-pk="${key}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${String(v) === String(cur)}">${esc(l)}</button>`).join('')}</div>`;
}
function openPracSet() {
  if (!G.prac) return;
  paused = true;
  const P = G.prac, B = $('#pracBody'), me = G.T[G.userSide];
  if (P.kind === 'bat') {
    $('#pracH').textContent = '타격 훈련 설정';
    const types = [['ANY', '랜덤'], ['FB', '직구'], ['TS', '투심'], ['SL', '슬라이더'], ['CB', '커브'], ['CH', '체인지업'], ['FK', '포크']];
    B.innerHTML = `<div class="popt"><span>구종</span>${segHTML('type', types, P.type)}</div>
      <div class="popt"><span>코스</span>${segHTML('course', [['rand', '실전처럼'], ['zone', '스트라이크만'], ['mid', '한가운데']], P.course)}</div>
      <div class="popt"><span>구속</span>${segHTML('spd', [[0.82, '느리게'], [1, '보통'], [1.06, '빠르게']], P.spd)}</div>
      <div class="popt"><span>타자</span>${segHTML('batter', me.lineup.map((b, i) => [i, `${i + 1}. ${b.name}`]), P.batter)}</div>`;
  } else {
    $('#pracH').textContent = '투구 훈련 설정';
    const all = me.ros.rotation.concat(me.ros.bullpen);
    B.innerHTML = `<div class="popt"><span>투수</span>${segHTML('pitcher', all.map((p, i) => [i, `${p.role === 'SP' ? '선발' : p.role === 'CL' ? '마무리' : '불펜'} ${p.name}`]), P.pitcher)}</div>
      <div class="popt"><span>상대 타자</span>${segHTML('swing', [['true', '실전처럼 스윙'], ['false', '안 치고 지켜보기']], String(P.swing))}</div>`;
  }
  B.querySelectorAll('.seg').forEach((sg) => sg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    sg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    AU.click();
  }));
  openModal('#pracModal');
}
$('#pracSet').addEventListener('click', () => { AU.click(); openPracSet(); });
$('#pracGo').addEventListener('click', () => {
  const P = G.prac; if (!P) { closeModal('#pracModal'); paused = false; return; }
  const cfg = {};
  $$('#pracBody .seg').forEach((sg) => {
    const b = sg.querySelector('button[aria-pressed="true"]'); if (!b) return;
    const k = sg.dataset.pk, v = b.dataset.v;
    cfg[k] = k === 'type' || k === 'course' ? v : k === 'swing' ? v === 'true' : +v;
  });
  Object.assign(P, cfg);
  store.set('prac_' + P.kind, cfg);
  closeModal('#pracModal'); paused = false;
  clearTimers(); G.gen++; G.pitch = null; G.play = null; ball.hide(); UI.skip.hidden = true; hideDocks();
  pracStart();
});
$('#pracQuit').addEventListener('click', () => { closeModal('#pracModal'); paused = false; quitToTitle(); });
$('#batPrBtn').addEventListener('click', () => startPractice('bat'));
$('#pitPrBtn').addEventListener('click', () => startPractice('pit'));

/* ===================== 시즌 · 리그 ===================== */
let SEA = null;
function seaLoad() { if (!SEA) SEA = store.get('season2', null); return SEA; }
function seaSave() { try { store.set('season2', SEA); } catch (e) { toast('저장 공간이 부족해요'); } }
function makeSchedule(len) {
  const days = [];
  const arr = [...Array(10).keys()];
  for (let d = 0; d < len; d++) {
    const r = d % 9, cyc = Math.floor(d / 9);
    const rot = [arr[0]].concat(arr.slice(1).map((_, i) => arr[1 + ((i + r) % 9)]));
    const pairs = [];
    for (let i = 0; i < 5; i++) {
      let a = rot[i], b = rot[9 - i];
      if ((i + r + cyc) % 2) [a, b] = [b, a];
      pairs.push([a, b]); // [home, away]
    }
    days.push(pairs);
  }
  return days;
}
function newSeason(len, inn) {
  const stand = {};
  for (let i = 0; i < 10; i++) stand[i] = { w: 0, l: 0, d: 0, rs: 0, ra: 0 };
  SEA = { v: 1, team: OPTS.me, len, inn, day: 0, days: makeSchedule(len), res: [], stand, bat: {}, pit: {}, over: false };
  seaSave();
}
function gp(i) { const s = SEA.stand[i]; return s.w + s.l + s.d; }
function sortedStand() {
  const a = Object.keys(SEA.stand).map((k) => Object.assign({ i: +k }, SEA.stand[k]));
  const pct = (x) => (x.w + x.l ? x.w / (x.w + x.l) : 0);
  a.sort((x, y) => pct(y) - pct(x) || (y.rs - y.ra) - (x.rs - x.ra));
  const top = a[0];
  a.forEach((x) => { x.pct = pct(x); x.gb = ((top.w - x.w) + (x.l - top.l)) / 2; });
  return a;
}
function seasonLine() {
  if (!seaLoad()) return '';
  const st = SEA.stand[SEA.team], rk = sortedStand().findIndex((x) => x.i === SEA.team) + 1;
  return `${S.TEAMS[SEA.team].city} ${st.w}승 ${st.l}패 ${st.d}무 · ${rk}위 (${SEA.day}/${SEA.len}경기)`;
}
function mergeTeam(tm, won, lost, sv) {
  const id = tm.idx;
  tm.lineup.concat(tm.out, tm.bench).forEach((b) => {
    if (!b.g.pa) return;
    const k = id + ':' + b.key, r = SEA.bat[k] || (SEA.bat[k] = { n: b.name, t: id, g: 0, pa: 0, ab: 0, h: 0, hr: 0, rbi: 0, r: 0, bb: 0, k: 0, sb: 0 });
    r.n = b.name; r.g++;
    ['pa', 'ab', 'h', 'hr', 'rbi', 'r', 'bb', 'k', 'sb'].forEach((f) => (r[f] += b.g[f] || 0));
  });
  tm.used.forEach((p) => {
    const k = id + ':' + p.key, r = SEA.pit[k] || (SEA.pit[k] = { n: p.name, t: id, g: 0, outs: 0, er: 0, h: 0, bb: 0, k: 0, w: 0, l: 0, sv: 0 });
    r.n = p.name; r.g++;
    r.outs += p.g.outs; r.er += p.g.r; r.h += p.g.h; r.bb += p.g.bb; r.k += p.g.k;
    if (p === won) r.w++; if (p === lost) r.l++; if (p === sv) r.sv++;
  });
}
function decisions(T2) {
  const [a, h] = T2, win = a.runs > h.runs ? a : h.runs > a.runs ? h : null;
  if (!win) return {};
  const lose = win === a ? h : a;
  const sp = win.used[0];
  const W = sp.g.outs >= 15 ? sp : win.used.slice(1).sort((x, y) => y.g.outs - x.g.outs)[0] || sp;
  const L = lose.used.slice().sort((x, y) => y.g.r - x.g.r)[0];
  const last = win.used[win.used.length - 1];
  const SV = last !== W && win.runs - lose.runs <= 3 && last.g.outs >= 3 ? last : null;
  return { W, L, SV };
}
function recordGame(T2) {
  const [a, h] = T2, sa = SEA.stand[a.idx], sh = SEA.stand[h.idx];
  sa.rs += a.runs; sa.ra += h.runs; sh.rs += h.runs; sh.ra += a.runs;
  if (a.runs > h.runs) { sa.w++; sh.l++; } else if (h.runs > a.runs) { sh.w++; sa.l++; } else { sa.d++; sh.d++; }
  const d = decisions(T2);
  mergeTeam(a, d.W, d.L, d.SV); mergeTeam(h, d.W, d.L, d.SV);
  (SEA.res[SEA.day] = SEA.res[SEA.day] || []).push([h.idx, a.idx, h.runs, a.runs]);
}
function rotIdx(i) { return gp(i) % 5; }

/* ---- 빠른 시뮬 (그래픽 없음) ---- */
function simGame(hi, ai, inn) {
  const T2 = [makeTeamState(ai), makeTeamState(hi)];
  T2.forEach((tm) => { tm.pitcher = tm.ros.rotation[rotIdx(tm.idx)]; tm.used = [tm.pitcher]; });
  const Fs = T2.map((tm) => S.makeFielders(fieldersOf(tm).map((p, i) => (i === 0 ? 50 : p ? p.spd : 55))));
  const maxInn = inn, limit = inn === 9 ? 11 : inn + 2;
  const D = DIFF.pro;
  for (let ing = 1; ing <= limit; ing++) {
    for (let half = 0; half < 2; half++) {
      const bt = T2[half], ft = T2[1 - half];
      if (half === 1 && ing >= maxInn && T2[1].runs > T2[0].runs) return T2;
      bt.line[ing - 1] = 0;
      let outs = 0, B = [null, null, null];
      // 투수 교체
      const avail = () => ft.ros.bullpen.filter((x) => !ft.used.includes(x));
      const lead = ft.runs - bt.runs;
      if (ing >= maxInn && lead >= 1 && lead <= 3 && ft.pitcher.role !== 'CL') { const cl = avail().find((x) => x.role === 'CL'); if (cl) { ft.pitcher = cl; ft.used.push(cl); } }
      while (outs < 3) {
        let p = ft.pitcher;
        if ((S.fatigueOf(p, p.g.pc) > 0.72 || p.g.r >= 5 || (p.role === 'RP' && p.g.outs >= 6)) && avail().length) {
          const pool = avail().filter((x) => x.role !== 'CL');
          if (pool.length) { p = ft.pitcher = pool[Math.floor(R() * pool.length)]; ft.used.push(p); }
        }
        const b = bt.lineup[bt.order]; bt.order = (bt.order + 1) % 9;
        const z = S.zoneOf(b.height), F = Fs[1 - half];
        let bb = 0, s = 0, done = false;
        b.g.pa++;
        while (!done) {
          const fat = S.fatigueOf(p, p.g.pc), plan = S.cpuPitchPlan(p, { b: bb, s }, z), sig = S.pitchSigma(p, fat, null);
          const tg = { x: plan.target.x + S.randn() * sig, y: plan.target.y + S.randn() * sig };
          const kmh = S.pitchSpeed(p, plan.type, fat, null), q = S.pitchQuality(p, fat, null);
          const P = S.makePitch(p, plan.type, tg, kmh); p.g.pc++;
          const zi = S.zoneInfo(z, tg.x, tg.y);
          const c = S.cpuSwing(b, P, zi, { b: bb, s }, D, p.hand, q);
          if (!c.swing) { if (zi.inside) s++; else bb++; }
          else if (!c.contact) s++;
          else {
            const tr = S.flyBall({ x: tg.x, y: tg.y, z: 0 }, c.ev, c.la, c.phi);
            const r = S.resolvePlay(tr, { bases: B.slice(), outs, batter: b, fielders: F });
            if (r.kind === 'FOUL') { if (s < 2) s++; continue; }
            done = true;
            if (r.kind !== 'SF' && r.kind !== 'SAC') b.g.ab++;
            const hit = ['1B', '2B', '3B', 'HR', 'IFH', 'BUNT_HIT'].includes(r.kind);
            if (hit) { b.g.h++; bt.hits++; p.g.h++; }
            if (r.kind === 'HR') { b.g.hr++; p.g.hr++; }
            if (r.kind === 'E') ft.err++;
            outs += r.outs; p.g.outs += r.outs;
            let runs = r.runs;
            if (half === 1 && ing >= maxInn && r.kind !== 'HR') { const need = T2[0].runs - T2[1].runs + 1; if (need > 0 && runs > need) runs = need; }
            if (runs > 0) {
              bt.runs += runs; bt.line[ing - 1] += runs; p.g.r += runs; b.g.rbi += Math.min(r.rbi, runs);
              r.runners.filter((x) => x.to === 4 && !x.out).slice(0, runs).forEach((x) => x.who.g.r++);
            }
            B = r.bases.slice();
            continue;
          }
          if (s >= 3) { b.g.ab++; b.g.k++; p.g.k++; outs++; p.g.outs++; done = true; }
          else if (bb >= 4) {
            b.g.bb++; bt.bb++; p.g.bb++; done = true;
            if (B[0]) { if (B[1]) { if (B[2]) { bt.runs++; bt.line[ing - 1]++; p.g.r++; b.g.rbi++; B[2].g.r++; } B[2] = B[1]; } B[1] = B[0]; }
            B[0] = b;
          }
        }
        if (half === 1 && ing >= maxInn && T2[1].runs > T2[0].runs) return T2;
      }
    }
    if (ing >= maxInn && T2[0].runs !== T2[1].runs) return T2;
  }
  return T2;
}
function simDay(skipUser) {
  const pairs = SEA.days[SEA.day];
  pairs.forEach(([h, a]) => {
    if (skipUser && (h === SEA.team || a === SEA.team)) return;
    recordGame(simGame(h, a, SEA.inn));
  });
  SEA.day++;
  if (SEA.day >= SEA.len) SEA.over = true;
}
function myPair() {
  if (!SEA || SEA.over) return null;
  return SEA.days[SEA.day].find((p) => p[0] === SEA.team || p[1] === SEA.team);
}
function playSeasonGame() {
  const pr = myPair(); if (!pr) return;
  const home = pr[0] === SEA.team ? 1 : 0, opp = home ? pr[1] : pr[0];
  closeModal('#seasonModal');
  const hi = pr[0], ai = pr[1];
  startGame({ season: true, me: SEA.team, opp, home, inn: SEA.inn, sp: [rotIdx(ai), rotIdx(hi)] });
}
function seasonAfterGame() {
  if (!seaLoad() || !G.season) return;
  const pr = myPair(); if (!pr) return;
  recordGame(G.T);
  simDay(true);
  seaSave();
}
let simBusy = false;
function simMine() {
  if (simBusy || !myPair()) return;
  simDay(false); seaSave(); renderSeason();
  const last = (SEA.res[SEA.day - 1] || []).find((g) => g[0] === SEA.team || g[1] === SEA.team);
  if (last) { const [h, a, hs, as] = last, mine = h === SEA.team; const w = mine ? hs > as : as > hs, dr = hs === as; toast(`${dr ? '무승부' : w ? '승리!' : '패배'} · ${S.TEAMS[a].city} ${as} : ${hs} ${S.TEAMS[h].city}`, 2200); }
}
function simToEnd() {
  if (simBusy || !SEA || SEA.over) return;
  simBusy = true;
  const step = () => {
    if (!simBusy || !SEA || SEA.over || $('#seasonModal').hidden) { simBusy = false; seaSave(); renderSeason(); return; }
    simDay(false);
    $('#seasonSub').textContent = `자동 진행 중… ${SEA.day}/${SEA.len}경기`;
    if (SEA.day % 6 === 0) seaSave();
    setTimeout(step, 0);
  };
  step();
}

/* ---- 시즌 화면 ---- */
let seaTab = 'home';
function openSeason() {
  seaLoad(); seaTab = 'home'; renderSeason(); openModal('#seasonModal');
}
function fmtIP(o) { return `${Math.floor(o / 3)}${o % 3 ? '.' + (o % 3) : ''}`; }
function leaders(kind) {
  const tg = Math.max(1, Math.round(SEA.day)), qPA = tg * 3.1, qIP = tg * 3;
  const list = (obj) => Object.keys(obj).map((k) => obj[k]);
  const tn = (r) => `<span style="opacity:.6;font-size:11px">${esc(S.TEAMS[r.t].city)}</span>`;
  const tbl = (title, rows, fmt) => `<div class="rhead">${title}</div><table class="stbl">${rows.map((r, i) => `<tr class="${r.t === SEA.team ? 'me' : ''}"><td>${i + 1}</td><td class="t">${esc(r.n)} ${tn(r)}</td><td>${fmt(r)}</td></tr>`).join('') || '<tr><td>아직 기록이 없어요</td></tr>'}</table>`;
  if (kind === 'bat') {
    const B = list(SEA.bat);
    return tbl(`타율 (규정타석 ${Math.round(qPA)})`, B.filter((r) => r.pa >= qPA).sort((a, b) => b.h / b.ab - a.h / a.ab).slice(0, 5), (r) => fmtAvg(r.h / Math.max(1, r.ab)))
      + tbl('홈런', B.sort((a, b) => b.hr - a.hr).slice(0, 5), (r) => r.hr)
      + tbl('타점', B.sort((a, b) => b.rbi - a.rbi).slice(0, 5), (r) => r.rbi)
      + tbl('안타', B.sort((a, b) => b.h - a.h).slice(0, 5), (r) => r.h);
  }
  const P = list(SEA.pit);
  return tbl(`평균자책점 (규정이닝 ${Math.round(qIP / 3)})`, P.filter((r) => r.outs >= qIP).sort((a, b) => a.er / a.outs - b.er / b.outs).slice(0, 5), (r) => ((r.er * 27) / Math.max(1, r.outs)).toFixed(2))
    + tbl('승리', P.sort((a, b) => b.w - a.w).slice(0, 5), (r) => r.w)
    + tbl('탈삼진', P.sort((a, b) => b.k - a.k).slice(0, 5), (r) => r.k)
    + tbl('세이브', P.sort((a, b) => b.sv - a.sv).slice(0, 5), (r) => r.sv);
}
function renderSeason() {
  const B = $('#seasonBody');
  if (!SEA) {
    $('#seasonH').textContent = '새 시즌 시작';
    $('#seasonSub').textContent = `${S.TEAMS[OPTS.me].city} ${S.TEAMS[OPTS.me].name}로 시즌을 치러요. 다른 팀 경기는 자동으로 시뮬레이션돼요.`;
    B.innerHTML = `<div class="popt"><span>팀당 경기 수</span>${segHTML('len', [[18, '18경기'], [36, '36경기'], [72, '72경기'], [144, '144경기 (실제)']], 36)}</div>
      <div class="popt"><span>내 경기 이닝</span>${segHTML('inn', [[3, '3회'], [5, '5회'], [9, '9회']], 9)}</div>
      <button class="mbtn primary" id="seaNew">시즌 시작!</button>`;
    B.querySelectorAll('.seg').forEach((sg) => sg.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; sg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
    $('#seaNew').addEventListener('click', () => {
      const v = (k) => +B.querySelector(`.seg[data-pk="${k}"] button[aria-pressed="true"]`).dataset.v;
      newSeason(v('len'), v('inn')); renderSeason(); AU.cheer(0.6, 1.2);
    });
    return;
  }
  const t = S.TEAMS[SEA.team];
  $('#seasonH').textContent = `2026 시즌 · ${t.city} ${t.name}`;
  $('#seasonSub').textContent = seasonLine();
  const tabs = `<div class="rtabs">${[['home', '홈'], ['stand', '순위'], ['bat', '타자'], ['pit', '투수']].map(([k, l]) => `<button data-st="${k}" aria-selected="${seaTab === k}">${l}</button>`).join('')}</div>`;
  let body = '';
  if (seaTab === 'home') {
    const pr = myPair();
    if (pr) {
      const home = pr[0] === SEA.team, opp = home ? pr[1] : pr[0], ot = S.TEAMS[opp];
      const os = SEA.stand[opp];
      body += `<div class="card2"><div style="font-size:12px;color:var(--ink-2);font-weight:700">${SEA.day + 1}번째 경기 · ${home ? '홈' : '원정'}</div>
        <div class="big2">vs ${esc(ot.city)} ${esc(ot.name)}</div><div style="font-size:12.5px;color:var(--ink-2);margin-bottom:10px">상대 ${os.w}승 ${os.l}패 ${os.d}무</div>
        <div class="row2"><button class="mbtn primary" id="seaPlay">▶ 경기하기</button><button class="mbtn" id="seaSim">⏩ 이 경기 자동</button></div></div>`;
    } else {
      const st = sortedStand(), champ = S.TEAMS[st[0].i], rk = st.findIndex((x) => x.i === SEA.team) + 1;
      body += `<div class="card2"><div class="big2">🏆 시즌 종료!</div><div>정규시즌 1위: <b>${esc(champ.city)} ${esc(champ.name)}</b></div><div style="margin-top:4px">우리 팀 최종 ${rk}위</div></div>`;
    }
    const recent = [];
    for (let d = SEA.day - 1; d >= 0 && recent.length < 5; d--) { const g = (SEA.res[d] || []).find((x) => x[0] === SEA.team || x[1] === SEA.team); if (g) recent.push(g); }
    if (recent.length) {
      body += `<div class="rhead">최근 경기</div><table class="stbl">${recent.map(([h, a, hs, as]) => { const mine = h === SEA.team, my = mine ? hs : as, op = mine ? as : hs, o = S.TEAMS[mine ? a : h]; return `<tr><td>${my > op ? '<b style="color:#37d67a">승</b>' : my < op ? '<b style="color:#ff4b4b">패</b>' : '무'}</td><td class="t">${mine ? 'vs' : '@'} ${esc(o.city)}</td><td>${my} : ${op}</td></tr>`; }).join('')}</table>`;
    }
    if (!SEA.over) body += `<button class="mbtn" id="seaEnd">⏭ 시즌 끝까지 자동 진행</button>`;
    body += `<button class="mbtn" id="seaReset">새 시즌 시작 (현재 시즌 삭제)</button>`;
  } else if (seaTab === 'stand') {
    body += `<table class="stbl"><tr><th>순위</th><th style="text-align:left">팀</th><th>경기</th><th>승</th><th>패</th><th>무</th><th>승률</th><th>차</th></tr>` +
      sortedStand().map((x, i) => `<tr class="${x.i === SEA.team ? 'me' : ''}"><td>${i + 1}</td><td class="t"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${S.TEAMS[x.i].c1};margin-right:5px"></span>${esc(S.TEAMS[x.i].city)}</td><td>${x.w + x.l + x.d}</td><td>${x.w}</td><td>${x.l}</td><td>${x.d}</td><td>${x.pct.toFixed(3).replace(/^0/, '')}</td><td>${x.gb ? x.gb.toFixed(1) : '-'}</td></tr>`).join('') + '</table>' +
      '<p class="sub" style="margin-top:8px">승률 = 승 ÷ (승+패), 무승부는 승률 계산에서 빠져요.</p>';
  } else body += leaders(seaTab);
  B.innerHTML = tabs + body;
  B.querySelectorAll('[data-st]').forEach((b) => b.addEventListener('click', () => { seaTab = b.dataset.st; renderSeason(); }));
  const on = (id, fn) => { const e = $(id); if (e) e.addEventListener('click', fn); };
  on('#seaPlay', playSeasonGame);
  on('#seaSim', simMine);
  on('#seaEnd', () => { if (confirmTwice('#seaEnd', '정말 끝까지? 한 번 더 누르면 시작')) simToEnd(); });
  on('#seaReset', () => { if (confirmTwice('#seaReset', '한 번 더 누르면 현재 시즌이 삭제돼요')) { SEA = null; store.set('season2', null); renderSeason(); } });
}
function confirmTwice(sel, msg) {
  const b = $(sel);
  if (b.dataset.armed) return true;
  b.dataset.armed = '1'; const old = b.textContent; b.textContent = msg;
  setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = old; } }, 3000);
  return false;
}
$('#seasonBtn').addEventListener('click', () => { AU.click(); openSeason(); });
$('#seasonClose').addEventListener('click', () => { simBusy = false; closeModal('#seasonModal'); });

if (window.__fc) Object.assign(window.__fc, { simGame, newSeason, simDay, openSeason, startPractice, gameOver, sea: () => SEA });

