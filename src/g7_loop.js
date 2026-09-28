/* ===================== 카메라 ===================== */
const CAM = { mode: 'orbit', p: new T.Vector3(0, 22, 3), l: new T.Vector3(0, 2, -30), fov: 50, tp: new T.Vector3(0, 22, 3), tl: new T.Vector3(0, 2, -30), tfov: 50, kp: 2, kl: 3, a: Math.PI };
const portrait = () => innerWidth < innerHeight;
function camTo(p, l, fov, kp, kl, cut) {
  CAM.tp.set(p[0], p[1], p[2]); CAM.tl.set(l[0], l[1], l[2]); CAM.tfov = fov; CAM.kp = kp; CAM.kl = kl || kp;
  if (cut) { CAM.p.copy(CAM.tp); CAM.l.copy(CAM.tl); CAM.fov = fov; }
}
// 타격 시점: 포수 뒤 한가운데(홈에서 7m쯤)에서 투구 방향 그대로 보되, 화각을 좁혀(망원) 스트라이크 존이 예전의 2배쯤 크게.
// 각도는 예전 그대로이고 존이 아래 버튼에 가리지 않게 살짝 더 내려다보기만 함. 포수·구심은 이 시점에서 자동으로 숨김 (updateCamera)
function viewPA() {
  return userBatting() ? (portrait() ? [[0, 1.62, 7.0], [0, 0.67, -18.4], 22.4] : [[0, 1.5, 6.2], [0, 0.01, -18.4], 16]) : [[-1.0, 3.6, -36], [0, 0.9, 0.5], portrait() ? 16.5 : 11];
}
function camForPA(cut) { CAM.mode = userBatting() ? 'bat' : 'pitch'; const v = viewPA(); camTo(v[0], v[1], v[2], 4, 4, cut); }
function camIntro() {
  CAM.mode = 'intro';
  camTo([26, 15, -58], [0, 1, 0], portrait() ? 55 : 38, 1, 1, true);
  const v = viewPA(); camTo(v[0], v[1], v[2], 1.25, 1.6, false);
}
function camPlay() { CAM.mode = 'play'; CAM.kp = 2.4; CAM.kl = 6; CAM.tfov = portrait() ? 52 : 36; }
function camOrbit(cut) { CAM.mode = 'orbit'; CAM.kp = cut ? 100 : 1.2; CAM.kl = cut ? 100 : 1.5; CAM.tfov = portrait() ? 56 : 40; if (cut) CAM.fov = CAM.tfov; }
function updateCamera(dt) {
  if (CAM.mode === 'orbit') {
    CAM.a += dt * 0.045;
    CAM.tp.set(Math.sin(CAM.a) * 48, 22, -45 - Math.cos(CAM.a) * 48 * -1);
    CAM.tl.set(0, 2, -32);
  } else if (CAM.mode === 'play' && G.play) {
    const pl = G.play, b = pl.ball || { x: 0, y: 1, z: 0 };
    let lx = b.x, ly = Math.min(b.y, 34), lz = b.z;
    if (pl.hr && pl.t > pl.tr.restT + 0.5 && G.batFig) { const q = G.batFig.root.position; lx = q.x; ly = 1.2; lz = q.z; }
    const d = Math.hypot(lx, lz);
    CAM.tl.set(lx, ly * 0.55 + 0.6, lz);
    CAM.tp.set(lx * 0.3, 7 + d * 0.15 + ly * 0.25, 15 - d * 0.28);
  }
  const kp = 1 - Math.exp(-CAM.kp * dt), kl = 1 - Math.exp(-CAM.kl * dt);
  CAM.p.lerp(CAM.tp, kp); CAM.l.lerp(CAM.tl, kl); CAM.fov = lerp(CAM.fov, CAM.tfov, kp);
  camera.position.copy(CAM.p); camera.lookAt(CAM.l); fxApplyShake();
  if (Math.abs(camera.fov - CAM.fov) > 0.01) { camera.fov = CAM.fov; camera.updateProjectionMatrix(); }
  // 타격 시점에서는 포수·구심이 존을 가리지 않게 숨김
  const hideHome = CAM.mode === 'bat' && CAM.p.z > 3;
  [FIG.field[1], FIG.ump[0]].forEach((f) => { if (f.visible) { f.root.visible = !hideHome; f.shadow.visible = !hideHome; } });
}

/* ===================== 대기 동작 ===================== */
const POSE_CALL = pose({ hipY: -0.04, spX: 0.1, rSx: -0.5, rSz: -1.45, rE: -1.7, lSz: 0.1, lSx: -0.2 });
const _ct = new T.Vector3(), _ctW = new T.Vector3(0, 0.75, 0.9);
function updateIdle(dt) {
  if (!FIG.field) return;
  const ph = G.phase, playing = ph === 'play';
  const pitching = ph === 'windup' || ph === 'flight';
  const u = G.pitch ? G.pitch.w / WIND : 0;
  // 투수
  if (!pitching && !playing) {
    if (ph === 'call' || ph === 'after') idleTo(FIG.P, POSE.stand, dt, 3);
    else pitcherPose(FIG.P, 0, G.T ? fieldTeam().pitcher.hand : 'R', G.T && fieldTeam().pitcher.slot);
  }
  // 야수
  if (!playing) {
    for (let i = 2; i < 9; i++) {
      const f = FIG.field[i];
      if (G.adv && G.adv.adv.thrownOut && i === 2) continue;
      if (G.steal && G.steal.coverF === i && clock > G.steal.throwT - 0.9) continue;
      idleTo(f, pitching && u > 0.55 ? POSE.ready : f.tp, dt, 5);
    }
    // 포수
    const c = FIG.field[1];
    if (G.adv) { /* 폭투·낫아웃 연출 중 */ }
    else if (c.tp === POSE.catcher) {
      if (G.pitch && ph === 'flight' && ball.m.visible && ball.m.position.z > -6) _ct.set(ball.m.position.x, ball.m.position.y, 0.95);
      else if (G.pitch && (ph === 'windup' || ph === 'flight')) _ct.set(G.pitch.aim.x, G.pitch.aim.y, 0.95);
      else if (ph === 'call' && ball.m.visible) _ct.copy(ball.m.position);
      else _ct.set(0, 0.72, 0.95);
      _ctW.lerp(_ct, 1 - Math.exp(-(ph === 'flight' ? 22 : 6) * dt));
      idleTo(c, POSE.catcher, dt, 10); applyPose(c, 'L'); c.root.updateMatrixWorld(true); armIK(c.lA, _ctW);
      if (ph === 'call' && ball.m.visible) { gloveOf(c, _gv); ball.set(_gv.x, _gv.y, _gv.z + 0.03, 1); ball.pushTrail(false); }
    } else idleTo(c, c.tp, dt, 10);
  }
  // 심판
  FIG.ump.forEach((f, i) => {
    if (i === 0) { const call = f.callT && clock - f.callT < 0.9; idleTo(f, call ? POSE_CALL : POSE.ump, dt, call ? 14 : 5); }
    else idleTo(f, pitching ? POSE.ready : POSE.stand, dt, 4);
  });
  // 코치
  FIG.coach.forEach((f, i) => { idleTo(f, POSE.coach, dt, 3); f.spine.rotation.y = Math.sin(clock * 0.7 + i * 2) * 0.12; });
  // 주자 리드
  if (!playing && !G.adv) {
    G.runFig.forEach((f, k) => {
      if (!f || f.mode === 'steal') return;
      const want = pitching ? (k === 0 ? 3.2 : k === 1 ? 4.2 : 2.6) : 0;
      f.lead = damp(f.lead || 0, want, 2.6, dt);
      const s = runnerSpot(k, 0.6 + f.lead); placeFig(f, s.x, s.z);
      turnTo(f, Math.atan2(0 - s.x, -18.4 - s.z), 6, dt);
      idleTo(f, f.lead > 0.8 ? POSE.lead : POSE.stand, dt, 6);
    });
  }
}

/* ===================== 입력 ===================== */
const ray = new T.Raycaster(), ndc = new T.Vector2(), zPlane = new T.Plane(new T.Vector3(0, 0, 1), 0), _hit = new T.Vector3();
let hoverAim = null;
function aimFromEvent(ev) {
  const r = glCanvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(zPlane, _hit) ? { x: _hit.x, y: _hit.y } : null;
}
// 탭 지점을 '지금 공이 있는 깊이'에서 비교 → 공을 직접 누르면 정확히 그 공을 겨냥
const _relPlane = new T.Plane(new T.Vector3(0, 0, 1), 0);
function aimRel(ev) {
  const P = G.pitch; if (!P || !P.released) return null;
  const bp = S.pitchPos(P.pt, Math.min(P.ft / P.pt.dur, 1), {});
  const r = glCanvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera); _relPlane.constant = -bp.z;
  if (!ray.ray.intersectPlane(_relPlane, _hit)) return null;
  return { x: P.cross.x + (_hit.x - bp.x), y: P.cross.y + (_hit.y - bp.y) };
}
function defaultAim() { const b = curBatter(), z = S.zoneOf(b ? b.height : 1.8); return { x: 0, y: (z.top + z.bot) / 2 }; }
glCanvas.addEventListener('pointerdown', (ev) => {
  AU.init();
  if (paused || !G.T) return;
  if (G.phase === 'meter') { meterTap(); return; }
  if (userBatting() && (G.phase === 'flight' || G.phase === 'windup')) {
    const a = aimFromEvent(ev);
    if (G.phase === 'windup') { if (a) showRing(a, true); return; }
    userSwingTap(a || defaultAim());
  }
});
glCanvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerType !== 'mouse' || !G.T || !userBatting()) return;
  hoverAim = aimFromEvent(ev);
});
UI.padCanvas.addEventListener('pointerdown', (ev) => { ev.preventDefault(); padPick(ev); });
document.addEventListener('keydown', (ev) => {
  if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA')) return;
  const modalOpen = !$('#menuModal').hidden || !$('#penModal').hidden || !$('#overModal').hidden || !$('#subModal').hidden;
  if (ev.key === 'Escape') { if (!$('#menuModal').hidden) closeMenu(); else if (!$('#penModal').hidden) closeModal('#penModal'); else if (G.T && G.phase !== 'over') openMenu(); return; }
  if (modalOpen || !G.T || paused) return;
  if (ev.code === 'Space' || ev.key === 'Enter') {
    if (document.activeElement && document.activeElement.tagName === 'BUTTON' && ev.key === 'Enter') return;
    ev.preventDefault();
    if (G.phase === 'meter') meterTap();
    else if (G.phase === 'aim') { G.aimTarget = G.aimTarget || defaultAim(); startMeter(); }
    else if (userBatting() && G.phase === 'flight') userSwingTap(hoverAim || defaultAim());
    else if (G.phase === 'play') skipPlay();
    return;
  }
  if (userPitching() && /^[1-6]$/.test(ev.key)) { const k = fieldTeam().pitcher.pitches[+ev.key - 1]; if (k) { selectPitchType(k); AU.click(); } }
  if (userBatting() && (ev.key === 'b' || ev.key === 'B')) UI.bunt.click();
  if (userBatting() && (ev.key === 's' || ev.key === 'S')) UI.steal.click();
});
UI.bunt.addEventListener('click', () => {
  if (G.phase !== 'ready' || !userBatting()) return;
  G.bunt = !G.bunt; UI.bunt.setAttribute('aria-pressed', String(G.bunt));
  if (G.bs) G.bs.mode = G.bunt ? 'bunt' : 'stance';
  showDocks(); AU.click();
});
UI.steal.addEventListener('click', () => {
  if (G.phase !== 'ready' || !userBatting()) return;
  if (stealBase() < 0) { toast('도루할 수 있는 주자가 없어요'); return; }
  if (G.online) { if (subBusy()) return; ON.stealWant = !ON.stealWant; UI.steal.setAttribute('aria-pressed', String(ON.stealWant)); AU.click(); requestSub({ t: 'st', on: ON.stealWant }, ON.stealWant ? `${stealBase() + 2}루 도루` : '도루 취소'); return; }
  G.stealReq = !G.stealReq; UI.steal.setAttribute('aria-pressed', String(G.stealReq)); AU.click();
  if (G.stealReq) toast(`다음 투구에 ${stealBase() + 2}루 도루!`, 1400);
});
$('#bullpenBtn').addEventListener('click', () => { AU.click(); openPen(); });
$('#penClose').addEventListener('click', () => closeModal('#penModal'));
$('#ibbBtn').addEventListener('click', () => { AU.click(); ibb(); });
function skipPlay() { if (G.play && G.play.t > 0.25) finishPlay(); }
UI.skip.addEventListener('click', skipPlay);
$('#playBtn').addEventListener('click', () => { AU.init(); AU.click(); startGame(); });
function openMenu() {
  if (!G.T || G.phase === 'over') return;
  paused = true;
  $('#sndSw').setAttribute('aria-checked', String(AU.on));
  $('#zoneSw').setAttribute('aria-checked', String(G.zoneOn));
  $('#heatSw').setAttribute('aria-checked', String(G.heatOn));
  $('#boxNow').innerHTML = `<div class="lswrap" style="margin:10px 0"><table class="lscore">${lineScoreHTML()}</table></div>` + boxHTML(G.T[G.userSide]);
  openModal('#menuModal');
}
function closeMenu() { closeModal('#menuModal'); paused = false; }
$('#menuBtn').addEventListener('click', () => { AU.click(); openMenu(); });
$('#resumeBtn').addEventListener('click', closeMenu);
$('#sndSw').addEventListener('click', (e) => { const v = !AU.on; AU.init(); AU.setOn(v); e.currentTarget.setAttribute('aria-checked', String(v)); });
$('#zoneSw').addEventListener('click', (e) => { G.zoneOn = !G.zoneOn; store.set('zone', G.zoneOn); e.currentTarget.setAttribute('aria-checked', String(G.zoneOn)); zoneGuide.visible = G.zoneOn && userBatting() && G.phase !== 'play'; });
$('#heatSw').addEventListener('click', (e) => { G.heatOn = !G.heatOn; store.set('heat', G.heatOn); e.currentTarget.setAttribute('aria-checked', String(G.heatOn)); drawZoneHeat(); });
$('#quitBtn').addEventListener('click', quitToTitle);
$('#againBtn').addEventListener('click', () => { $('#overModal').hidden = true; if (G.season) { quitToTitle(); openSeason(); } else startGame(); });
$('#homeBtn').addEventListener('click', quitToTitle);
function quitToTitle() {
  if (G.online) { if (G.phase !== 'over') { sendAct({ k: 'quit' }); onlineResult('lose'); } const q = G.online; G.online = null; setTimeout(() => { G.online = q; endOnline(); }, 1500); }
  clearTimers(); G.gen++; paused = false;
  G.T = null; G.phase = 'title'; G.prac = null; G.season = null; G.mode = 'exh'; $('#pracLine').hidden = true; G.play = null; G.pitch = null; G.steal = null; G.bases = [null, null, null]; G.runFig = [null, null, null];
  ['#menuModal', '#penModal', '#overModal', '#subModal'].forEach((s) => ($(s).hidden = true));
  UI.hud.hidden = true; UI.title.hidden = false; UI.skip.hidden = true; hideDocks();
  ball.hide(); pciRing.visible = false; targetMark.visible = false; board.flash = 0; board.msg = '';
  renderTitle(); dressTitle(); drawBoard(); camOrbit();
  showTab(TAB.cur, true);
}
// 앱 전환 시 일시정지 메뉴 — 온라인은 상대가 기다리고 있으니 메뉴 없이 돌아오자마자 이어서 (화면이 꺼진 동안엔 어차피 멈춤)
document.addEventListener('visibilitychange', () => { if (document.hidden && G.T && G.phase !== 'over' && !paused && !G.online) openMenu(); });

/* ===================== 루프 ===================== */
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); syncDockH();
  if ((CAM.mode === 'bat' || CAM.mode === 'pitch') && G.T) { const v = viewPA(); camTo(v[0], v[1], v[2], 4, 4, true); }
  else if (CAM.mode === 'orbit') CAM.tfov = portrait() ? 56 : 40;
}
addEventListener('resize', resize);

const HASH = location.hash || '';
const AUTO = /auto/.test(HASH) ? { speed: +(HASH.match(/speed=([\d.]+)/) || [0, 1])[1], busy: false } : null;
const FASTTEST = /fast/.test(HASH); let fastN = 0;
let flashTick = -1, perfT = 0, perfN = 0, last = performance.now();
function cosmetics(dt) {
  cheerU.uT.value += dt;
  cheerU.uCH.value = Math.max(0.06, cheerU.uCH.value - dt * 0.32);
  cheerU.uCA.value = Math.max(0.06, cheerU.uCA.value - dt * 0.32);
  if (ledRibbon.tex) ledRibbon.tex.offset.x = (ledRibbon.tex.offset.x + dt * 0.012) % 1;
  if (zoneGuide.visible && zoneGuide.heat.visible && zoneGuide.heatNums !== (G.phase !== 'flight')) drawZoneHeat(); // 공이 날아오는 동안엔 타율 숫자 숨김
  if (board.flash > 0) {
    board.flash -= dt;
    const k = Math.floor(board.flash * 4);
    if (k !== flashTick) { flashTick = k; drawBoard(); }
    if (board.flash <= 0) { board.msg = ''; drawBoard(); }
  }
  updateFireworks(dt); fxTick(dt);
  if (pciRing.visible) {
    if (pciRing.flash) { if (clock > pciRing.flash) { pciRing.visible = false; pciRing.flash = 0; } }
    pciRing.material.opacity = 0.55 + Math.sin(clock * 10) * 0.2;
  }
  if (!isTouch && hoverAim && userBatting() && (G.phase === 'ready' || G.phase === 'windup' || G.phase === 'flight') && !(pciRing.flash)) showRing(hoverAim, false);
  else if (!pciRing.flash && pciRing.visible && G.phase !== 'flight') pciRing.visible = false;
}
function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.min(0.05, (now - last) / 1000); last = now;
  let dt = real;
  if (AUTO) dt *= AUTO.speed;
  if (!paused) {
    clock += dt; runTimers();
    if (G.phase === 'windup' || G.phase === 'flight') updatePitch(dt);
    if (G.phase === 'meter') updateMeter(dt);
    if (G.phase === 'play') updatePlay(dt);
    if (G.adv) updateAdvance(dt);
    if (G.pclock) tickPitchClock(dt);
    updateIdle(dt);
    if (G.steal) updateSteal(dt);
    updateBatter(dt);
    if (AUTO) autoPlay();
    if (G.online) onlineTick();
  }
  updateCamera(paused ? real : Math.min(dt, 0.1));
  cosmetics(real);
  if (!FASTTEST || (++fastN % 12) === 0) renderer.render(scene, camera);
  // 적응형 해상도
  perfT += real; perfN++;
  if (perfT > 3) {
    const avg = perfT / perfN;
    if (avg > 1 / 38 && pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); }
    perfT = 0; perfN = 0;
  }
}

/* ---------- 자동 플레이 (테스트용: #auto) ---------- */
function autoPlay() {
  if (G.phase === 'aim' && !AUTO.busy) {
    AUTO.busy = true;
    later(0.25, () => {
      AUTO.busy = false;
      if (G.phase !== 'aim') return;
      const p = fieldTeam().pitcher, b = curBatter(), plan = S.cpuPitchPlan(p, { b: G.b, s: G.s }, S.zoneOf(b.height));
      selectPitchType(plan.type); G.aimTarget = plan.target; drawPad(); startMeter();
    });
  }
  if (G.phase === 'meter' && G.meter && Math.abs(G.meter.u - 0.5) < 0.08 + R() * 0.3) meterTap();
  if (G.phase === 'flight' && userBatting() && G.pitch && !G.pitch.swung) {
    const P = G.pitch;
    if (P.autoT == null) {
      const zi = S.zoneInfo(S.zoneOf(curBatter().height), P.cross.x, P.cross.y);
      P.autoSkip = !zi.inside && R() < 0.75;
      P.autoT = P.pt.dur - SW_TC + S.randn() * 0.035;
    }
    if (!P.autoSkip && P.ft >= P.autoT) userSwingTap({ x: P.cross.x + S.randn() * 0.05, y: P.cross.y + S.randn() * 0.06 });
  }
  if (G.phase === 'over') window.__over = true;
}

/* ---------- 시작 ---------- */
initFigures();
renderTitle(); dressTitle(); drawBoard();
resize(); camOrbit(true); updateCamera(0.016);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
  const h = G.T ? G.T[1].t : S.TEAMS[OPTS.home ? OPTS.me : OPTS.opp], a = G.T ? G.T[0].t : S.TEAMS[OPTS.home ? OPTS.opp : OPTS.me];
  paintLed(h, a); drawBoard();
  FIG.all.forEach((f) => (f.dressKey = null));
  if (G.T) { dressField(); placeRunners(); if (G.batFig && curBatter()) dress(G.batFig, batTeam().t, batTeam() === G.T[1], curBatter()); } else dressTitle();
});
requestAnimationFrame((t) => { last = t; frame(t); });
setTimeout(() => { $('#loading').classList.add('gone'); window.__done = true; }, 250);
window.__fc = { G, S, OPTS, CAM, startGame, finishPlay, quitToTitle, FIG, startAdvance, placeRunners, balk, call, curBatter, batTeam };
if (AUTO) {
  const m = (k, d) => (HASH.match(new RegExp(k + '=(\\w+)')) || [0, d])[1];
  OPTS.inn = +m('inn', 1); OPTS.home = +m('home', 1); OPTS.diff = m('diff', 'pro'); OPTS.time = m('time', OPTS.time);
  const pm = m('prac', ''), sm = m('mode', '');
  setTimeout(() => { renderTitle(); if (pm) startPractice(pm); else if (sm !== 'none') startGame(); }, 300);
}

