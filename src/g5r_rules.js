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
    const b1 = S.basePos(1), f1 = FIG.field[2], h = S.FIELD_HOME[2], s1 = clamp(t / 0.8, 0, 1);
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
