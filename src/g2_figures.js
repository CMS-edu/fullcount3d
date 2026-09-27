/* ===================== FIGURES ===================== */
const FG = (() => {
  const cyl = (rt, rb, h, seg, ty) => { const g = new T.CylinderGeometry(rt, rb, h, seg, 1); g.translate(0, ty, 0); return g; };
  const g = {
    hips: cyl(0.165, 0.175, 0.22, 10, 0),
    torso: cyl(0.215, 0.165, 0.6, 12, 0.3),
    thigh: cyl(0.088, 0.07, 0.47, 8, -0.235),
    shin: cyl(0.066, 0.05, 0.45, 8, -0.225),
    shoe: new T.BoxGeometry(0.11, 0.08, 0.27).translate(0, -0.47, 0.06),
    upper: cyl(0.06, 0.05, 0.3, 7, -0.15),
    fore: cyl(0.05, 0.04, 0.28, 7, -0.14),
    hand: new T.SphereGeometry(0.047, 7, 5).translate(0, -0.3, 0),
    glove: new T.SphereGeometry(0.1, 8, 6).scale(1, 1.15, 0.6).translate(0, -0.33, 0.02),
    head: new T.SphereGeometry(0.118, 14, 10).translate(0, 0.12, 0),
    neck: cyl(0.055, 0.06, 0.12, 7, 0.02),
    cap: new T.SphereGeometry(0.126, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.15, 0),
    brim: new T.CylinderGeometry(0.11, 0.11, 0.014, 12, 1, false, -Math.PI / 2, Math.PI).translate(0, 0.16, 0.1),
    helmet: new T.SphereGeometry(0.135, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.62).translate(0, 0.13, 0),
    flap: new T.SphereGeometry(0.075, 8, 6).scale(0.45, 1, 1).translate(0, 0.07, 0),
    bat: cyl(0.034, 0.013, 0.86, 10, 0.43),
    mask: new T.BoxGeometry(0.2, 0.2, 0.08).translate(0, 0.11, 0.12),
    pad: new T.BoxGeometry(0.36, 0.42, 0.1).translate(0, 0.3, 0.14),
  };
  const shadowTex = (() => {
    const c = makeCanvas(64, 64), x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return canvasTex(c);
  })();
  g.shadow = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shadowMat = new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  const M = {
    skin: [new T.MeshLambertMaterial({ color: 0xd8a888 }), new T.MeshLambertMaterial({ color: 0xc58f6d }), new T.MeshLambertMaterial({ color: 0xa87556 }), new T.MeshLambertMaterial({ color: 0x7a5238 })],
    shoe: new T.MeshLambertMaterial({ color: 0x151515 }),
    glove: new T.MeshLambertMaterial({ color: 0x7b4a24 }),
    bat: new T.MeshLambertMaterial({ color: 0xd9b27a }),
    black: new T.MeshLambertMaterial({ color: 0x1b1b1f }),
    gray: new T.MeshLambertMaterial({ color: 0x6b7078 }),
    navy: new T.MeshLambertMaterial({ color: 0x1b2440 }),
  };
  return { g, M, shadowMat };
})();

const _tmpV = new T.Vector3(), _tmpV2 = new T.Vector3(), _tmpQ = new T.Quaternion(), _tmpQ2 = new T.Quaternion();
const DOWN = new T.Vector3(0, -1, 0);

function jerseyTexture(base, trim, text, num, name, pin) {
  const c = makeCanvas(256, 128), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 256, 128);
  if (pin) { x.fillStyle = hexA(trim, 0.35); for (let i = 0; i < 256; i += 9) x.fillRect(i, 0, 1.5, 128); }
  x.fillStyle = trim; x.fillRect(0, 0, 256, 7); x.fillRect(0, 121, 256, 7);
  const ink = lum(base) > 0.6 ? trim : (lum(trim) > 0.45 ? trim : '#ffffff');
  x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `26px ${FONT_DISP}`;
  for (const cx of [0, 256]) x.fillText(text, cx, 48, 110);
  x.font = `14px ${FONT_UI}`; x.fillText(name || '', 128, 30, 100);
  x.font = `58px ${FONT_DISP}`; x.fillText(String(num), 128, 76);
  if (lum(ink) > 0.6) { x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1.5; x.strokeText(String(num), 128, 76); }
  const t = canvasTex(c); return t;
}

let figSerial = 0;
function makeFigure(o) {
  // o: {jersey, pants, cap, trim, helmet(bool), glove('L'|'R'|null), skin, num, name, teamText, pin, kind}
  const { g, M } = FG;
  const root = new T.Group(), body = new T.Group(), hip = new T.Group(), spine = new T.Group(), neck = new T.Group();
  const mk = (geo, mat, parent) => { const m = new T.Mesh(geo, mat); parent.add(m); return m; };
  const jerseyMat = new T.MeshLambertMaterial({ map: jerseyTexture(o.jersey, o.trim, o.teamText || '', o.num == null ? '' : o.num, o.name, o.pin) });
  const sleeveMat = new T.MeshLambertMaterial({ color: o.jersey });
  const pantsMat = new T.MeshLambertMaterial({ color: o.pants });
  const capMat = new T.MeshLambertMaterial({ color: o.cap });
  const skin = M.skin[o.skin == null ? figSerial % 3 : o.skin];
  figSerial++;
  root.add(body); body.add(hip); hip.position.y = 0.95;
  mk(g.hips, pantsMat, hip);
  hip.add(spine); spine.position.y = 0.08;
  const torso = mk(g.torso, jerseyMat, spine);
  spine.add(neck); neck.position.y = 0.6;
  mk(g.neck, skin, neck);
  mk(g.head, skin, neck);
  let hat;
  if (o.helmet) { hat = mk(g.helmet, capMat, neck); const fl = mk(g.flap, capMat, neck); fl.position.x = o.flapSide || -0.12; }
  else { hat = mk(g.cap, capMat, neck); mk(g.brim, capMat, neck); }
  if (o.mask) mk(g.mask, M.black, neck);
  if (o.pad) mk(g.pad, M.black, spine);
  const leg = (s) => {
    const L = new T.Group(); L.position.set(0.095 * s, -0.02, 0); hip.add(L);
    mk(g.thigh, pantsMat, L);
    const K = new T.Group(); K.position.y = -0.47; L.add(K);
    mk(g.shin, o.socks ? new T.MeshLambertMaterial({ color: o.socks }) : pantsMat, K); mk(g.shoe, M.shoe, K);
    return { L, K };
  };
  const arm = (s) => {
    const Sh = new T.Group(); Sh.position.set(0.235 * s, 0.52, 0); spine.add(Sh);
    mk(g.upper, sleeveMat, Sh);
    const E = new T.Group(); E.position.y = -0.3; Sh.add(E);
    mk(g.fore, skin, E);
    const isGlove = (o.glove === 'L' && s > 0) || (o.glove === 'R' && s < 0);
    const hand = mk(isGlove ? g.glove : g.hand, isGlove ? M.glove : skin, E);
    return { Sh, E, hand };
  };
  const lL = leg(1), rL = leg(-1), lA = arm(1), rA = arm(-1);
  const sh = new T.Mesh(g.shadow, FG.shadowMat); sh.scale.set(1.1, 1, 1.1); sh.renderOrder = 5;
  const f = {
    root, body, hip, spine, neck, torso, hat, lL, rL, lA, rA, shadow: sh, jerseyMat, capMat, pantsMat, sleeveMat,
    P: neutralPose(), run: 0, kind: o.kind || '', visible: true,
  };
  world.add(root); world.add(sh);
  return f;
}
function setFigureColors(f, o) {
  f.jerseyMat.map && f.jerseyMat.map.dispose();
  f.jerseyMat.map = jerseyTexture(o.jersey, o.trim, o.teamText || '', o.num == null ? '' : o.num, o.name, o.pin); f.jerseyMat.needsUpdate = true;
  f.sleeveMat.color.set(o.jersey); f.pantsMat.color.set(o.pants); f.capMat.color.set(o.cap);
}
function showFigure(f, v) { f.root.visible = v; f.shadow.visible = v; f.visible = v; }

/* ---------- 포즈 ---------- */
const JK = ['hipY', 'spX', 'spY', 'spZ', 'hdX', 'hdY', 'lLx', 'lLz', 'lK', 'rLx', 'rLz', 'rK', 'lSx', 'lSy', 'lSz', 'lE', 'rSx', 'rSy', 'rSz', 'rE'];
function neutralPose() { const p = {}; for (const k of JK) p[k] = 0; p.lE = -0.15; p.rE = -0.15; p.lSz = 0.08; p.rSz = -0.08; return p; }
function pose(over) { return Object.assign(neutralPose(), over); }
function blendPose(out, a, b, t) { for (const k of JK) out[k] = a[k] + (b[k] - a[k]) * t; return out; }
function applyPose(f, noArms) {
  const p = f.P;
  f.body.position.y = p.hipY;
  f.spine.rotation.set(p.spX, p.spY, p.spZ);
  f.neck.rotation.set(p.hdX, p.hdY, 0);
  f.lL.L.rotation.set(p.lLx, 0, p.lLz); f.lL.K.rotation.x = p.lK;
  f.rL.L.rotation.set(p.rLx, 0, p.rLz); f.rL.K.rotation.x = p.rK;
  if (noArms !== 'L' && noArms !== 'both') { f.lA.Sh.rotation.set(p.lSx, p.lSy, p.lSz); f.lA.E.rotation.set(p.lE, 0, 0); }
  if (noArms !== 'R' && noArms !== 'both') { f.rA.Sh.rotation.set(p.rSx, p.rSy, p.rSz); f.rA.E.rotation.set(p.rE, 0, 0); }
}
// 2본 IK: 어깨(Sh) → 월드 목표점까지 손 도달
function armIK(A, targetW, reach = 0.6) {
  const L1 = 0.3, L2 = 0.3;
  const parent = A.Sh.parent;
  parent.updateMatrixWorld(true);
  const t = parent.worldToLocal(_tmpV.copy(targetW));
  t.sub(A.Sh.position);
  let d = t.length(); d = clamp(d, 0.05, reach - 0.001);
  const dir = t.normalize();
  const cosInner = clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1);
  const bend = Math.PI - Math.acos(cosInner);
  const a1 = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  // 팔꿈치가 아래/바깥을 향하도록: dir을 '아래' 쪽으로 a1만큼 회전한 방향이 위팔
  const side = _tmpV2.set(0, -1, 0).cross(dir); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
  const upperDir = dir.clone().applyAxisAngle(side, -a1);
  A.Sh.quaternion.setFromUnitVectors(DOWN, upperDir);
  // 트위스트: 목표가 로컬 +z 평면에 오도록
  const inv = _tmpQ.copy(A.Sh.quaternion).invert();
  const tl = dir.clone().multiplyScalar(d).applyQuaternion(inv);
  const psi = Math.atan2(tl.x, tl.z);
  A.Sh.quaternion.multiply(_tmpQ2.setFromAxisAngle(new T.Vector3(0, 1, 0), psi));
  A.E.rotation.set(-bend, 0, 0);
}
function groundY(x, z) {
  const r = Math.hypot(x, z + 18.44);
  if (r > 2.74) return 0;
  return r < 1.1 ? 0.25 : 0.25 * (1 - (r - 1.1) / 1.64);
}
function placeFig(f, x, z, rotY) {
  f.root.position.set(x, groundY(x, z), z);
  if (rotY != null) f.root.rotation.y = rotY;
  f.shadow.position.set(x, f.root.position.y + 0.02, z);
}
function faceTo(f, x, z) { f.root.rotation.y = Math.atan2(x - f.root.position.x, z - f.root.position.z); }
function angTo(f, x, z) { return Math.atan2(x - f.root.position.x, z - f.root.position.z); }
function turnTo(f, target, k, dt) {
  let a = f.root.rotation.y, d = target - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  f.root.rotation.y = a + d * (1 - Math.exp(-k * dt));
}

const POSE = {
  stand: pose({}),
  ready: pose({ hipY: -0.13, spX: 0.38, lLx: -0.35, rLx: -0.35, lLz: 0.18, rLz: -0.18, lK: 0.62, rK: 0.62, lSx: -0.55, rSx: -0.55, lE: -0.8, rE: -0.8, lSz: 0.15, rSz: -0.15, hdX: -0.3 }),
  catcher: pose({ hipY: -0.52, spX: 0.28, lLx: -1.45, rLx: -1.45, lLz: 0.42, rLz: -0.42, lK: 2.3, rK: 2.3, rSx: -0.3, rE: -1.2, hdX: -0.2 }),
  ump: pose({ hipY: -0.28, spX: 0.62, lLx: -0.75, rLx: -0.75, lLz: 0.3, rLz: -0.3, lK: 1.1, rK: 1.1, lSx: -0.5, rSx: -0.5, lE: -0.4, rE: -0.4, lSz: 0.3, rSz: -0.3, hdX: -0.5 }),
  coach: pose({ lSz: 0.12, rSz: -0.12, lSx: -0.1, rSx: -0.1, lE: -1.2, rE: -1.2 }),
  lead: pose({ hipY: -0.15, spX: 0.3, lLz: 0.4, rLz: -0.4, lK: 0.6, rK: 0.6, lLx: -0.2, rLx: -0.2, lSx: -0.35, rSx: -0.35, lE: -0.7, rE: -0.7, lSz: 0.4, rSz: -0.4 }),
  catchHigh: pose({ spX: -0.1, lSx: -2.9, lE: -0.2, rSx: -2.4, rE: -0.6, hdX: -0.6 }),
  catchLow: pose({ hipY: -0.35, spX: 0.9, lLx: -0.9, rLx: 0.2, lK: 1.2, rK: 0.8, lSx: -1.1, lE: -0.2, rSx: -0.9, rE: -0.4 }),
  throwBack: pose({ spY: 0.6, spX: 0.05, rSx: 0.2, rSz: -1.4, rE: -1.6, lSx: -1.2, lSz: 0.4, lE: -0.3, lLx: -0.5, lK: 0.3 }),
  throwFwd: pose({ spY: -0.5, spX: 0.5, rSx: -2.2, rSz: 0.2, rE: -0.2, lSx: -0.3, lE: -1.4, lLx: -0.6, rLx: 0.5, rK: 0.5 }),
  celebrate: pose({ lSx: -2.6, rSx: -2.6, lSz: 0.5, rSz: -0.5, lE: -0.3, rE: -0.3, hdX: -0.3 }),
  dejected: pose({ spX: 0.35, hdX: 0.5, lSz: 0.05, rSz: -0.05 }),
};
// 투구 동작 키프레임 (우투 기준; 좌투는 좌우 반전)
const PITCH_KF = [
  { u: 0.0, rot: -1.57, dz: 0, p: pose({ lSx: -0.55, rSx: -0.55, lE: -1.9, rE: -1.9, lSz: -0.25, rSz: 0.25, hdY: 1.3 }) },
  { u: 0.32, rot: -1.62, dz: 0, p: pose({ spX: -0.1, lLx: -1.35, lK: 1.7, rK: 0.25, lSx: -0.6, rSx: -0.6, lE: -1.9, rE: -1.9, lSz: -0.2, rSz: 0.2, hdY: 1.35, hipY: -0.03 }) },
  { u: 0.58, rot: -1.35, dz: 0.45, p: pose({ hipY: -0.17, spZ: -0.12, lLz: 0.95, lLx: -0.35, lK: 0.55, rK: 0.55, rLz: -0.25, rSx: 0.3, rSz: -1.35, rE: -1.5, lSz: 1.35, lSx: -0.2, lE: -0.3, hdY: 1.2 }) },
  { u: 0.78, rot: -0.05, dz: 0.95, p: pose({ hipY: -0.2, spX: 0.5, lLx: -0.8, lK: 0.45, rLx: 0.6, rK: 0.55, rSx: -2.75, rSz: 0.05, rE: -0.25, lSx: -0.7, lE: -1.9, lSz: 0.2, hdX: -0.25 }) },
  { u: 1.0, rot: 0.28, dz: 1.15, p: pose({ hipY: -0.16, spX: 0.75, lLx: -0.55, lK: 0.5, rLx: -0.2, rK: 1.3, rSx: -0.9, rSz: 0.75, rE: -0.7, lSx: -0.5, lE: -1.7, hdX: -0.35 }) },
];
const MIRROR_K = { lLx: 'rLx', rLx: 'lLx', lK: 'rK', rK: 'lK', lSx: 'rSx', rSx: 'lSx', lE: 'rE', rE: 'lE', lSy: 'rSy', rSy: 'lSy' };
function mirrorPose(p) {
  const o = {};
  for (const k of JK) o[k] = p[k];
  for (const k in MIRROR_K) o[k] = p[MIRROR_K[k]];
  o.lLz = -p.rLz; o.rLz = -p.lLz; o.lSz = -p.rSz; o.rSz = -p.lSz; o.spY = -p.spY; o.spZ = -p.spZ; o.hdY = -p.hdY;
  return o;
}
const PITCH_KF_L = PITCH_KF.map((k) => ({ u: k.u, rot: -k.rot, dz: k.dz, p: mirrorPose(k.p) }));
function pitcherPose(f, u, hand) {
  const K = hand === 'L' ? PITCH_KF_L : PITCH_KF;
  u = clamp(u, 0, 1);
  let i = 0; while (i < K.length - 2 && u > K[i + 1].u) i++;
  const a = K[i], b = K[i + 1], t = smooth((u - a.u) / (b.u - a.u));
  blendPose(f.P, a.p, b.p, t);
  applyPose(f);
  const z = -18.2 + lerp(a.dz, b.dz, t);
  placeFig(f, 0, z, lerp(a.rot, b.rot, t));
}
function runPose(f, spd, dt) {
  f.run += dt * spd * 2.6;
  const s = Math.sin(f.run), c = Math.cos(f.run), a = clamp(spd / 7, 0.3, 1);
  const p = f.P;
  Object.assign(p, POSE.stand);
  p.spX = 0.22 * a; p.hipY = -0.03 - Math.abs(c) * 0.05 * a;
  p.lLx = -s * 0.95 * a; p.rLx = s * 0.95 * a;
  p.lK = 0.25 + Math.max(0, s) * 1.4 * a; p.rK = 0.25 + Math.max(0, -s) * 1.4 * a;
  p.lSx = s * 0.9 * a; p.rSx = -s * 0.9 * a; p.lE = -1.5; p.rE = -1.5; p.lSz = 0.12; p.rSz = -0.12;
  applyPose(f);
}

/* ---------- 공 ---------- */
const ball = (() => {
  const m = new T.Mesh(new T.SphereGeometry(S.BALL_R, 14, 10), new T.MeshBasicMaterial({ color: 0xfbfbf6 }));
  m.renderOrder = 10; scene.add(m);
  const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
  halo.scale.set(0.3, 0.3, 1); m.add(halo);
  const sh = new T.Mesh(FG.g.shadow, new T.MeshBasicMaterial({ map: FG.shadowMat.map, transparent: true, depthWrite: false, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 }));
  sh.renderOrder = 6; scene.add(sh);
  const N = 14, tp = new Float32Array(N * 3), tc = new Float32Array(N * 3);
  const tg = new T.BufferGeometry(); tg.setAttribute('position', new T.BufferAttribute(tp, 3)); tg.setAttribute('color', new T.BufferAttribute(tc, 3));
  const trail = new T.Line(tg, new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
  trail.frustumCulled = false; scene.add(trail);
  const hist = [];
  return {
    m, sh, halo, trail, hist, N, tp, tc,
    set(x, y, z, big) {
      m.position.set(x, y, z); m.visible = true;
      const s = big || 1; m.scale.setScalar(s); halo.scale.setScalar(0.18 * s + 0.12);
      sh.visible = y < 30; sh.position.set(x, groundY(x, z) + 0.03, z); const k = 0.28 + Math.min(y, 20) * 0.03; sh.scale.set(k, 1, k);
      sh.material.opacity = clamp(0.9 - y * 0.04, 0.15, 0.9);
    },
    hide() { m.visible = false; sh.visible = false; trail.visible = false; hist.length = 0; },
    pushTrail(on) {
      trail.visible = on;
      if (!on) { hist.length = 0; return; }
      hist.unshift(m.position.clone()); if (hist.length > N) hist.pop();
      for (let i = 0; i < N; i++) {
        const p = hist[Math.min(i, hist.length - 1)] || m.position;
        tp[i * 3] = p.x; tp[i * 3 + 1] = p.y; tp[i * 3 + 2] = p.z;
        const f = (1 - i / N) * 0.8; tc[i * 3] = f; tc[i * 3 + 1] = f; tc[i * 3 + 2] = f * 0.95;
      }
      tg.attributes.position.needsUpdate = true; tg.attributes.color.needsUpdate = true;
    },
  };
})();
ball.hide();

/* PCI(타격 조준) 링 & 투구 목표 마커 */
const pciRing = (() => {
  const m = new T.Mesh(new T.RingGeometry(0.9, 1, 40), new T.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.85, depthTest: false, side: T.DoubleSide }));
  const dot = new T.Mesh(new T.CircleGeometry(0.12, 16), new T.MeshBasicMaterial({ color: 0xffe07a, transparent: true, opacity: 0.9, depthTest: false, side: T.DoubleSide }));
  m.add(dot); m.renderOrder = 30; dot.renderOrder = 30; m.visible = false; scene.add(m); return m;
})();
const targetMark = (() => {
  const m = new T.Mesh(new T.RingGeometry(0.045, 0.06, 28), new T.MeshBasicMaterial({ color: 0x37d67a, transparent: true, opacity: 0.95, depthTest: false, side: T.DoubleSide }));
  m.renderOrder = 30; m.visible = false; scene.add(m); return m;
})();

