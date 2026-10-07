/* ===================== 규칙: 폭투·포일·낫아웃·보크·피치클락 ===================== */
const FORCE = (location.hash.match(/force=([a-z,]+)/) || [0, ''])[1].split(','); // 테스트용
const BALK_P = FORCE.includes('balk') ? 0.25 : 0.0012; // 주자 있을 때 투구당 보크 확률 (드물게)
UI.pclock = $('#pclock');
const PCLOCK = { on: store.get('pclock', true) };
const _av = { x: 0, z: 0, nx: 0, nz: 0 };

/* ---------- 주자 진루 연출 (폭투/포일/낫아웃/보크 공용) ---------- */
function startAdvance(adv, done) {
  const B = G.bases.slice(), runs = [];
  if (!adv.thrownOut) for (let k = 2; k >= 0; k--) if (B[k]) { const f = G.runFig[k]; runs.push({ f, who: B[k], from: k + 1, lead: f ? f.lead || 0 : 0 }); }
  const bat = adv.batter ? { f: G.batFig, who: curBatter(), from: 0, lead: 0 } : null;
  const cr = G.lastCross || { x: 0, y: 0.3 };
  const loose = adv.kind === '폭투' || adv.kind === '포일';
  const bto = loose ? { x: clamp(cr.x * 6 + (R() - 0.5) * 5, -10, 10), z: 8 + R() * 5 } : { x: clamp(cr.x * 0.8, -0.8, 0.8), z: 2.1 };
  G.adv = { t: 0, adv, runs, bat, bto, loose, B, done, balk: adv.kind === '보크', dur: adv.thrownOut ? 2.1 : loose ? 2.7 : 1.6 };
  G.phase = 'adv';
  CAM.mode = 'adv'; camTo(loose ? [21, 12, 11] : adv.thrownOut ? [-8, 7, 9] : [16, 16, 12], loose ? [-3, 0, -5] : adv.thrownOut ? [8, 0.5, -10] : [-3, 0, -18], innerWidth < innerHeight ? 62 : 44, 2.2, 3);
  hideDocks(); UI.pclock.hidden = true; UI.meter.hidden = true;
  if (bat && bat.f) { bat.f.mode = 'play'; if (bat.f.bat) bat.f.bat.visible = false; }
  const gen = G.gen;
  later(G.adv.balk ? 0 : 0.25, () => {
    if (gen !== G.gen) return;
    showCall(adv.kind + '!', '#ffb627', 1000); showPlayText(adv.text, 2300);
    if (adv.kind !== '낫아웃') { AU.cheer(0.6, 1.4); crowdPulse(G.half ? 'H' : 'A', 0.8); }
  });
  if (G.adv.balk) umpCall();
}
function updateAdvance(dt) {
  const A = G.adv; if (!A) return;
  A.t += dt;
  const t = A.t, c = FIG.field[1];
  if (A.loose) {
    // 공이 백스톱 쪽으로 튀고, 포수가 쫓아가 줍는다
    const k = clamp(t / 0.9, 0, 1), hop = Math.abs(Math.sin(k * Math.PI * 2.2)) * 0.55 * (1 - k);
    if (t < 1.75) { ball.set(lerp(0, A.bto.x, k), 0.05 + hop, lerp(0.8, A.bto.z, k), 1.4); ball.pushTrail(false); }
    const s = clamp((t - 0.25) / 1.3, 0, 1), cx = lerp(0, A.bto.x - 0.5, s), cz = lerp(1.3, A.bto.z - 0.7, s);
    placeFig(c, cx, cz);
    if (s > 0 && s < 1) { turnTo(c, Math.atan2(A.bto.x - cx, A.bto.z - cz), 12, dt); runPose(c, 6, dt); }
    else if (s >= 1) { idleTo(c, POSE.catchLow, dt, 10); if (t >= 1.75) { c.root.updateMatrixWorld(true); gloveOf(c, _gv); ball.set(_gv.x, _gv.y, _gv.z, 1.4); } }
  } else if (A.adv.thrownOut) {
    // 원바운드 공을 앞에 떨어뜨림 → 주워서 1루 송구 → 아웃
    const b1 = S.basePos(1), f1 = FIG.field[2], h = defHome(2), s1 = clamp(t / 0.8, 0, 1);
    placeFig(f1, lerp(h.x, b1.x - 0.4, s1), lerp(h.z, b1.z + 0.5, s1));
    if (s1 < 1) runPose(f1, 5, dt); else { idleTo(f1, POSE.catchHigh, dt, 10); turnTo(f1, Math.atan2(0 - f1.root.position.x, 0 - f1.root.position.z), 10, dt); }
    if (t < 0.45) { const k = t / 0.45; ball.set(A.bto.x, 0.05 + 0.3 * (1 - k) * Math.abs(Math.sin(k * 6)), lerp(0.9, A.bto.z, k), 1.4); idleTo(c, POSE.catchLow, dt, 10); }
    else if (t < 0.75) { idleTo(c, POSE.throwBack, dt, 14); turnTo(c, Math.atan2(b1.x - c.root.position.x, b1.z - c.root.position.z), 14, dt); c.root.updateMatrixWorld(true); gloveOf(c, _gv); ball.set(_gv.x, _gv.y, _gv.z, 1.4); }
    else if (t < 1.3) { const k = (t - 0.75) / 0.55; idleTo(c, POSE.throwFwd, dt, 14); ball.set(lerp(0.2, b1.x, k), lerp(1.5, 1.3, k) + Math.sin(k * Math.PI) * 0.8, lerp(1.4, b1.z, k), 1.5); ball.pushTrail(true); }
    else {
      f1.root.updateMatrixWorld(true); gloveOf(f1, _gv); ball.set(_gv.x, _gv.y, _gv.z, 1.4); ball.pushTrail(false);
      if (!A.outCall) { A.outCall = true; AU.glove(); showCall('아웃!', '#ff4b4b', 900); umpCall(); }
    }
  }
  // 주자들: 한 베이스씩
  const home = [];
  A.runs.forEach((r) => {
    if (!r.f) return;
    const d = clamp((t - 0.3) * S.runV(r.who.spd || 60), 0, S.BASE - r.lead);
    pathPos(r.from, r.lead + d, _av); placeFig(r.f, _av.x, _av.z);
    if (r.lead + d < S.BASE - 0.05) { turnTo(r.f, Math.atan2(_av.nx - _av.x, _av.nz - _av.z), 14, dt); runPose(r.f, 7.5, dt); }
    else { idleTo(r.f, r.from === 3 ? POSE.celebrate : POSE.stand, dt, 6); if (r.from === 3) home.push(r); }
  });
  if (A.bat && A.bat.f) {
    const f = A.bat.f, lim = A.adv.thrownOut ? S.BASE * 0.72 : S.BASE;
    const d = clamp((t - 0.35) * S.runV(A.bat.who.spd || 60), 0, lim);
    pathPos(0, d, _av); placeFig(f, _av.x, _av.z);
    if (d < lim - 0.05) { turnTo(f, Math.atan2(_av.nx - _av.x, _av.nz - _av.z), 14, dt); runPose(f, 7.5, dt); }
    else idleTo(f, A.adv.thrownOut ? POSE.dejected : POSE.stand, dt, 6);
  }
  if (home.length && !A.scoredFx) { A.scoredFx = true; AU.cheer(1, 2); }
  if (t >= A.dur) finishAdvance();
}
function finishAdvance() {
  const A = G.adv; if (!A) return;
  G.adv = null;
  if (!A.adv.thrownOut) {
    const B = A.B, nb = [null, null, null], scored = [];
    for (let k = 2; k >= 0; k--) if (B[k]) { if (k === 2) scored.push(B[k]); else nb[k + 1] = B[k]; }
    if (A.bat) nb[0] = A.bat.who;
    G.bases = nb;
    if (scored.length) addRuns(scored.length, scored);
  }
  if (A.bat && A.bat.f) showFigure(A.bat.f, false);
  ball.hide(); resetField(); placeRunners(); updateBug(); drawBoard(); updateLines();
  camForPA(false);
  A.done();
}

/* ---------- 보크 ---------- */
function balk() {
  G.pitch = null; G.meter = null; UI.meter.hidden = true;
  const gen = G.gen;
  startAdvance({ kind: '보크', batter: false, text: '보크! 모든 주자가 한 베이스씩 진루해요' }, () => later(0.5, () => { if (gen === G.gen && G.phase === 'adv') nextPitch(); }));
}

/* ---------- 견제 ---------- */
// 평소엔 잘 안 잡히지만(1루 2.5% · 좌투수 +1.5%) 주자가 도루하려던 참이면(도루 요청) 22%쯤 잡힘 → 도루 읽기 싸움.
// 견제할 때마다 주자 리드가 줄어서 이번 타석 도루 성공률 −3%p씩. 한 타석 3번째 견제가 실패하면 보크 (KBO 투수판 이탈 3회 제한)
const PK_MAX = 3;
function pickoffBase() { const s = stealBase(); if (s >= 0) return s; for (let k = 2; k >= 0; k--) if (G.bases[k]) return k; return -1; }
function canPickoff() { return !G.prac && userPitching() && (G.phase === 'aim' || G.phase === 'meter') && pickoffBase() >= 0; }
function pickoff(remote) {
  const k = pickoffBase(); if (k < 0 || !G.T) return;
  if (G.online && !remote) { flushSubsIn(); sendAct({ k: 'pko' }); } // 받은 도루 요청을 먼저 반영하고 신호 → 두 기기가 같은 조건으로 판정
  G.pk = (G.pk || 0) + 1;
  const r = G.bases[k], p = fieldTeam().pitcher, going = !!G.stealReq;
  const lf = [0.4, 1, 1.8][(G.leadT || 0) + 1]; // 주자 리드 작전: 짧게면 거의 안 걸리고, 크게면 2배 가까이
  let pr = going ? 0.22 + (G.leadT || 0) * 0.07 : [0.025, 0.015, 0.01][k] * lf;
  if (k === 0 && p.hand === 'L') pr += going ? 0.05 : 0.015 * lf;
  pr -= (r.spd - 60) * (going ? 0.003 : 0.0004);
  pr *= (r.skill === 'speed' ? 0.6 : 1) * (p.skill === 'pickoff' ? 2 : 1); // 스킬: 대도는 덜 걸리고, 견제 달인은 2배
  const out = (G.online ? onSeed(G.online.pi, 10 + G.pk)() : R()) < clamp(pr, 0.005, 0.5);
  G.stealReq = false; UI.steal.setAttribute('aria-pressed', 'false'); // 뛰려던 주자는 타이밍을 뺏김
  if (G.online && !ON.subOut.some((s) => s.t === 'st')) ON.stealWant = false;
  G.pclock = null; UI.pclock.hidden = true; G.meter = null; hideDocks();
  const f = G.runFig[k];
  G.pko = { k, out, who: r, fig: f, cover: [2, 5, 4][k], t: 0, lead: f ? f.lead || 2 : 2, balk: !out && G.pk >= PK_MAX };
  if (f) f.mode = 'pko';
  G.phase = 'pko';
  // 카메라: 투수 어깨 너머로 베이스를 보는 화면으로 바로 전환 (투수 → 베이스 송구가 화면 안쪽으로 날아감)
  const b = S.basePos(k + 1), dx = -b.x, dz = -18.44 - b.z, L = Math.hypot(dx, dz) || 1;
  CAM.mode = 'adv'; camTo([(dx / L) * 8, 4.2, -18.44 + (dz / L) * 8], [b.x, 0.6, b.z], innerWidth < innerHeight ? 44 : 32, 3, 3, true);
  showCall('견제!', '#ffb627', 700);
}
function updatePickoff(dt) {
  const K = G.pko; if (!K) return;
  K.t += dt; const t = K.t;
  const b = S.basePos(K.k + 1), P = FIG.P, cf = FIG.field[K.cover], f = K.fig;
  const fx = b.x * 0.97, fz = b.z + (-18.44 - b.z) * 0.03; // 베이스 바로 앞(투수 쪽)
  // 투수: 베이스 쪽으로 돌아서 던짐
  turnTo(P, Math.atan2(b.x - P.root.position.x, b.z - P.root.position.z), 12, dt);
  idleTo(P, t < 0.3 ? POSE.throwBack : POSE.throwFwd, dt, 14);
  // 커버 야수
  const h = defHome(K.cover), cs = clamp(t / 0.4, 0, 1);
  placeFig(cf, lerp(h.x, fx, cs), lerp(h.z, fz, cs));
  if (cs < 1) runPose(cf, 5, dt); else { idleTo(cf, POSE.catchLow, dt, 10); turnTo(cf, Math.atan2(0 - fx, -18.44 - fz), 10, dt); }
  // 공
  if (t >= 0.3 && t < 0.62) { const u = (t - 0.3) / 0.32; ball.set(lerp(P.root.position.x, fx, u), lerp(1.7, 0.9, u) + Math.sin(u * Math.PI) * 0.4, lerp(P.root.position.z, fz, u), 1.5); ball.pushTrail(true); }
  else if (t >= 0.62) { if (!K.caught) { K.caught = true; AU.glove(); } cf.root.updateMatrixWorld(true); gloveOf(cf, _gv); ball.set(_gv.x, _gv.y, _gv.z, 1.4); ball.pushTrail(false); }
  // 주자: 베이스로 귀루 (잡히는 경우는 한발 늦음)
  if (f) {
    const arrive = K.out ? 0.85 : 0.55, s = clamp((t - 0.1) / (arrive - 0.1), 0, 1);
    const p = runnerSpot(K.k, lerp(0.6 + K.lead, 0.15, s)); placeFig(f, p.x, p.z);
    if (s < 1) { turnTo(f, Math.atan2(b.x - p.x, b.z - p.z), 14, dt); runPose(f, 7.5, dt); } else idleTo(f, K.out ? POSE.dejected : POSE.stand, dt, 6);
  }
  if (t >= 0.72 && !K.called) { K.called = true; showCall(K.out ? '아웃!' : '세이프', K.out ? '#ff4b4b' : '#37d67a', 900); if (K.out) umpCall(); }
  if (t >= 1.45) finishPickoff();
}
function finishPickoff() {
  const K = G.pko; if (!K) return;
  G.pko = null;
  if (K.fig) K.fig.mode = 'idle';
  ball.hide();
  if (K.out) {
    G.bases[K.k] = null; G.outs++; fieldTeam().pitcher.g.outs++;
    K.who.g.pko = (K.who.g.pko || 0) + 1; batTeam().ro = (batTeam().ro || 0) + 1;
    showPlayText(`견제사! ${K.who.name} 아웃`, 1700); AU.cheer(userPitching() ? 0.8 : 0.3, 1.2);
  } else if (!K.balk && G.pk === PK_MAX - 1 && userPitching()) toast('다음 견제가 실패하면 보크예요 (타석당 3번까지)', 2400);
  resetField(); placeRunners(); updateBug(); drawBoard(); updateLines();
  camForPA(true);
  if (K.balk) { showPlayText('세 번째 견제 실패 — 보크', 1700); balk(); return; }
  if (G.outs >= 3) { afterPA(0.4, true); return; }
  const gen = G.gen;
  later(0.3, () => { if (gen === G.gen) nextPitch(); });
}

/* ---------- 피치클락 (2026 KBO: 주자 없음 18초 · 주자 있음 23초) ---------- */
function startPitchClock() {
  G.pclock = null; UI.pclock.hidden = true;
  if (!PCLOCK.on || G.prac || !userPitching()) return;
  const secs = G.bases.some(Boolean) ? 23 : 18;
  G.pclock = { left: secs, max: secs };
  UI.pclock.hidden = false; renderPClock();
}
function renderPClock() {
  const pc = G.pclock; if (!pc) return;
  const s = Math.max(0, Math.ceil(pc.left));
  UI.pclock.querySelector('b').textContent = s;
  UI.pclock.classList.toggle('warn', s <= 7 && s > 3);
  UI.pclock.classList.toggle('bad', s <= 3);
}
function tickPitchClock(dt) {
  const pc = G.pclock; if (!pc) return;
  if (G.phase !== 'aim' && G.phase !== 'meter') return;
  if (!$('#penModal').hidden || !$('#subModal').hidden) return;
  if (document.activeElement && document.activeElement.id === 'chatIn') return; // 채팅 입력 중엔 멈춤
  pc.left -= dt; renderPClock();
  if (pc.left <= 0) pitchClockViolation();
}
function pitchClockViolation() {
  G.pclock = null; UI.pclock.hidden = true; G.meter = null; hideDocks();
  if (G.online) sendAct({ k: 'pcv' });
  showFeedback([['피치클락 위반', 'bad'], ['자동 볼', 'm']], 1500);
  G.lastDirt = false; G.pendingWP = null;
  call('ball');
}
{
  const sw = $('#pcSw');
  sw.setAttribute('aria-checked', String(PCLOCK.on));
  sw.addEventListener('click', () => {
    PCLOCK.on = !PCLOCK.on; store.set('pclock', PCLOCK.on); sw.setAttribute('aria-checked', String(PCLOCK.on));
    if (!PCLOCK.on) { G.pclock = null; UI.pclock.hidden = true; }
  });
}
