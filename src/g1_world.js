/* ===================== WORLD ===================== */
const FC = {
  grass: '#2b7a37', grassL: '#348742', grassD: '#256d31', dirt: '#a6643e', dirtD: '#94583a', mound: '#ad6a43',
  track: '#7a4f35', chalk: '#f3efe6', outer: '#22682f',
};
const world = new T.Group(); scene.add(world);

/* ---------- 하늘 ---------- */
const skyU = { top: { value: new T.Color() }, hor: { value: new T.Color() }, glow: { value: new T.Color() } };
const sky = new T.Mesh(new T.SphereGeometry(900, 32, 16), new T.ShaderMaterial({
  uniforms: skyU, side: T.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 hor; uniform vec3 glow; varying vec3 vP; void main(){ float h = max(vP.y, 0.0); vec3 c = mix(hor, top, pow(h, 0.5)); c += glow * pow(1.0 - h, 8.0) * 0.55; gl_FragColor = vec4(c, 1.0); }',
}));
sky.renderOrder = -10; scene.add(sky);

const stars = (() => {
  const n = 700, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = Math.pow(Math.random(), 0.7) * 1.35 + 0.12, r = 850;
    p[i * 3] = Math.cos(a) * Math.cos(e) * r; p[i * 3 + 1] = Math.sin(e) * r; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3));
  const m = new T.Points(g, new T.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.8, depthWrite: false }));
  m.renderOrder = -9; scene.add(m); return m;
})();

/* ---------- 조명 ---------- */
const hemi = new T.HemisphereLight(0xcfd8ff, 0x1d2b1d, 0.6); scene.add(hemi);
const sun = new T.DirectionalLight(0xffffff, 0.8); sun.position.set(30, 90, 45); scene.add(sun);
const fill = new T.DirectionalLight(0xffffff, 0.3); fill.position.set(-40, 60, -90); scene.add(fill);
scene.fog = new T.Fog(0x000000, 260, 1300);

/* ---------- 외곽 지면 ---------- */
const outerGround = new T.Mesh(new T.CircleGeometry(1400, 48), new T.MeshLambertMaterial({ color: 0x151a17 }));
outerGround.rotation.x = -Math.PI / 2; outerGround.position.y = -0.4; world.add(outerGround);

/* ---------- 구장 경계(관중석 앞선) ---------- */
const FOUL_OFF = 17;
const U1 = { x: Math.SQRT1_2, z: -Math.SQRT1_2 }, N1 = { x: Math.SQRT1_2, z: Math.SQRT1_2 };
const U3 = { x: -Math.SQRT1_2, z: -Math.SQRT1_2 }, N3 = { x: -Math.SQRT1_2, z: Math.SQRT1_2 };
const EYE = 8; // 백스크린(φ) 반폭
function buildBoundary() {
  // 백스크린 오른쪽 끝(φ=EYE)에서 시작 → 우측 외야 → 1루 코너 → 1루 파울라인 → 홈 뒤 → 3루 → 좌측 외야 → φ=-EYE
  const P = [];
  const push = (x, z, w) => P.push({ x, z, w });
  for (let f = EYE; f <= 45; f += 1.5) { const p = S.polar(f, S.fenceDist(f) + 0.4); push(p.x, p.z, 0); }
  const pole = S.polar(45, S.fenceDist(45) + 0.4);
  for (let k = 1; k <= 4; k++) { const o = (FOUL_OFF * k) / 4; push(pole.x + N1.x * o, pole.z + N1.z * o, k / 4); }
  for (let s = 92; s >= 6; s -= 6) push(U1.x * s + N1.x * FOUL_OFF, U1.z * s + N1.z * FOUL_OFF, 1);
  for (let a = 45; a <= 135; a += 7.5) { const r = a * D2R; push(Math.cos(r) * FOUL_OFF, Math.sin(r) * FOUL_OFF, 1); }
  for (let s = 6; s <= 92; s += 6) push(U3.x * s + N3.x * FOUL_OFF, U3.z * s + N3.z * FOUL_OFF, 1);
  const pole3 = S.polar(-45, S.fenceDist(-45) + 0.4);
  for (let k = 3; k >= 1; k--) { const o = (FOUL_OFF * k) / 4; push(pole3.x + N3.x * o, pole3.z + N3.z * o, k / 4); }
  for (let f = -45; f <= -EYE + 0.01; f += 1.5) { const p = S.polar(f, S.fenceDist(f) + 0.4); push(p.x, p.z, 0); }
  // 바깥 방향 노멀(마이터)
  const C = { x: 0, z: -45 };
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    let tx = b.x - a.x, tz = b.z - a.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    let nx = tz, nz = -tx;
    if (nx * (P[i].x - C.x) + nz * (P[i].z - C.z) < 0) { nx = -nx; nz = -nz; }
    P[i].nx = nx; P[i].nz = nz;
  }
  // 코너 마이터 보정: 인접 법선 평균
  for (let pass = 0; pass < 2; pass++) {
    const nn = P.map((p, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      let x = a.nx + 2 * p.nx + b.nx, z = a.nz + 2 * p.nz + b.nz; const l = Math.hypot(x, z); return { x: x / l, z: z / l };
    });
    P.forEach((p, i) => { p.nx = nn[i].x; p.nz = nn[i].z; });
  }
  return P;
}
const BOUND = buildBoundary();

/* ---------- 필드 페인팅 (월드 좌표로 그림) ---------- */
function grassPattern(g, x0, z0, x1, z1) {
  g.fillStyle = FC.grass; g.fillRect(x0, z0, x1 - x0, z1 - z0);
  g.save(); g.rotate(-Math.PI / 4);
  const w = 4.57, R = 260;
  g.globalAlpha = 0.55; g.fillStyle = FC.grassL;
  for (let k = -60; k < 60; k += 2) g.fillRect(k * w, -R, w, 2 * R);
  g.globalAlpha = 0.45; g.fillStyle = FC.grassD;
  for (let k = -60; k < 60; k += 2) g.fillRect(-R, k * w, 2 * R, w);
  g.restore(); g.globalAlpha = 1;
}
function pathArc(g, f0, f1, rf, step = 1) {
  for (let f = f0; f <= f1 + 1e-6; f += step) { const p = S.polar(f, rf(f)); if (f === f0) g.moveTo(p.x, p.z); else g.lineTo(p.x, p.z); }
}
function paintField(g, x0, z0, x1, z1, W, H, detail) {
  const sx = W / (x1 - x0), sz = H / (z1 - z0);
  g.setTransform(sx, 0, 0, sz, -x0 * sx, -z0 * sz);
  grassPattern(g, x0, z0, x1, z1);
  // 펜스 바깥
  g.fillStyle = FC.outer; g.beginPath(); pathArc(g, -50, 50, (f) => S.fenceDist(f) + 1.5); g.lineTo(400, -400); g.lineTo(-400, -400); g.closePath(); g.fill();
  // 워닝트랙 (바깥 호 → 안쪽 호 역순)
  g.fillStyle = FC.track; g.beginPath(); pathArc(g, -47, 47, (f) => S.fenceDist(f) + 1.5);
  for (let f = 47; f >= -47; f -= 1) { const q = S.polar(f, S.fenceDist(f) - 4.6); g.lineTo(q.x, q.z); }
  g.closePath(); g.fill();
  // 파울지역 관중석 앞 트랙
  g.strokeStyle = FC.track; g.lineWidth = 5.5; g.lineJoin = 'round'; g.beginPath();
  BOUND.forEach((p, i) => (i ? g.lineTo(p.x, p.z) : g.moveTo(p.x, p.z))); g.stroke();
  // 내야 흙
  g.save(); g.beginPath(); g.moveTo(0, 5); let p = S.polar(47.5, 70); g.lineTo(p.x, p.z); p = S.polar(0, 70); g.lineTo(p.x, p.z); p = S.polar(-47.5, 70); g.lineTo(p.x, p.z); g.closePath(); g.clip();
  g.fillStyle = FC.dirt; g.beginPath(); g.arc(0, -18.44, 29, 0, Math.PI * 2); g.fill();
  g.restore();
  // 잔디/흙 경계 짙은 테두리
  g.save(); g.beginPath(); g.moveTo(0, 5); p = S.polar(47.5, 70); g.lineTo(p.x, p.z); p = S.polar(0, 70); g.lineTo(p.x, p.z); p = S.polar(-47.5, 70); g.lineTo(p.x, p.z); g.closePath(); g.clip();
  g.strokeStyle = 'rgba(40,25,10,0.28)'; g.lineWidth = 0.35; g.beginPath(); g.arc(0, -18.44, 29, 0, Math.PI * 2); g.stroke(); g.restore();
  // 내야 잔디 (다이아몬드 안쪽)
  const c = -19.4, k = 0.918, B = S.BASE * Math.SQRT1_2;
  g.save(); g.beginPath();
  g.moveTo(0, c + (0 - c) * k); g.lineTo(B * k, c); g.lineTo(0, c + (-2 * B - c) * k); g.lineTo(-B * k, c); g.closePath(); g.clip();
  grassPattern(g, -30, -45, 30, 5); g.restore();
  // 홈 원, 마운드, 베이스 컷아웃
  g.fillStyle = FC.dirt;
  g.beginPath(); g.arc(0, -0.25, 3.96, 0, Math.PI * 2); g.fill();
  for (const bk of [1, 3]) { const bp = S.basePos(bk); g.beginPath(); g.arc(bp.x, bp.z, 2.1, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = FC.mound; g.beginPath(); g.arc(0, -18.44, 2.74, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(60,35,15,0.25)'; g.lineWidth = 0.12; g.stroke();
  // 흙 결 (디테일)
  if (detail) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * (d[i] > d[i + 1] ? 18 : 10); d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8; }
    g.putImageData(img, 0, 0); g.restore();
  }
  // 대기 타석 원
  g.setTransform(sx, 0, 0, sz, -x0 * sx, -z0 * sz);
  for (const s of [-1, 1]) {
    g.fillStyle = 'rgba(160,100,60,0.9)'; g.beginPath(); g.arc(s * 11.5, 6.5, 0.8, 0, Math.PI * 2); g.fill();
    g.strokeStyle = FC.chalk; g.lineWidth = 0.06; g.stroke();
  }
  // 초크 라인
  g.strokeStyle = FC.chalk; g.lineCap = 'butt';
  g.lineWidth = 0.1;
  for (const s of [1, -1]) {
    const a = S.polar(45 * s, 1.95), b = S.polar(45 * s, S.fenceDist(45));
    g.beginPath(); g.moveTo(a.x, a.z); g.lineTo(b.x, b.z); g.stroke();
  }
  // 1루 러닝 레인
  { const a = S.polar(45, S.BASE / 2), b = S.polar(45, S.BASE), o = 0.91; g.beginPath(); g.moveTo(a.x + N1.x * o, a.z + N1.z * o); g.lineTo(b.x + N1.x * o, b.z + N1.z * o); g.lineTo(b.x, b.z); g.stroke(); g.beginPath(); g.moveTo(a.x, a.z); g.lineTo(a.x + N1.x * o, a.z + N1.z * o); g.stroke(); }
  // 타석 박스 & 포수 박스
  g.lineWidth = 0.075;
  for (const s of [-1, 1]) g.strokeRect(s * 0.976 - 0.61, -0.2 - 0.915, 1.22, 1.83);
  g.beginPath(); g.moveTo(-0.545, 0.715); g.lineTo(-0.545, 3.15); g.lineTo(0.545, 3.15); g.lineTo(0.545, 0.715); g.stroke();
  // 코치 박스
  g.lineWidth = 0.08;
  for (const s of [-1, 1]) { const bp = S.basePos(s > 0 ? 1 : 3); g.strokeRect(bp.x + s * 5.5, bp.z + 3.2, s * 3, 6); }
}
function fieldLayer(x0, z0, x1, z1, W, H, y, order, detail) {
  const c = makeCanvas(W, H), g = c.getContext('2d');
  paintField(g, x0, z0, x1, z1, W, H, detail);
  const tex = canvasTex(c, { aniso: 16 });
  const m = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0), new T.MeshLambertMaterial({ map: tex, polygonOffset: order > 0, polygonOffsetFactor: -order, polygonOffsetUnits: -order * 2 }));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.renderOrder = order;
  world.add(m); return m;
}
const bigTex = !lowEnd;
fieldLayer(-150, -175, 150, 35, bigTex ? 2048 : 1024, bigTex ? 2048 : 1024, 0, 0, false);
fieldLayer(-36, -54, 36, 18, 1024, 1024, 0.012, 1, true);
fieldLayer(-5, -6, 5, 4, 512, 512, 0.024, 2, true);

/* ---------- 홈플레이트, 베이스, 마운드 ---------- */
const whiteMat = new T.MeshLambertMaterial({ color: 0xffffff });
{
  const sh = new T.Shape();
  sh.moveTo(-0.216, 0.432); sh.lineTo(0.216, 0.432); sh.lineTo(0.216, 0.216); sh.lineTo(0, 0); sh.lineTo(-0.216, 0.216); sh.closePath();
  const plate = new T.Mesh(new T.ShapeGeometry(sh), whiteMat);
  plate.rotation.x = -Math.PI / 2; plate.position.y = 0.04; world.add(plate);
  const bg = new T.BoxGeometry(0.38, 0.09, 0.38);
  for (const k of [1, 2, 3]) { const bp = S.basePos(k); const b = new T.Mesh(bg, whiteMat); b.position.set(bp.x, 0.045, bp.z); b.rotation.y = Math.PI / 4; world.add(b); }
  const mound = new T.Mesh(new T.CylinderGeometry(1.1, 2.74, 0.25, 32, 1), new T.MeshLambertMaterial({ color: FC.mound }));
  mound.position.set(0, 0.125, -18.44); world.add(mound);
  const rubber = new T.Mesh(new T.BoxGeometry(0.61, 0.04, 0.15), whiteMat); rubber.position.set(0, 0.27, -18.44); world.add(rubber);
}

/* ---------- 스트라이크존 가이드 (타격 시점) ---------- */
const zoneGuide = (() => {
  const g = new T.BufferGeometry().setFromPoints([new T.Vector3(-1, -1, 0), new T.Vector3(1, -1, 0), new T.Vector3(1, 1, 0), new T.Vector3(-1, 1, 0), new T.Vector3(-1, -1, 0)]);
  const l = new T.Line(g, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthTest: false }));
  l.renderOrder = 20; l.visible = false; scene.add(l); return l;
})();
function setZoneGuide(z) { zoneGuide.scale.set(0.216, (z.top - z.bot) / 2, 1); zoneGuide.position.set(0, (z.top + z.bot) / 2, -0.2); }

/* ---------- 펜스 & 광고 ---------- */
const ADS = [['홈런통신', '#e8412c', '#fff'], ['구름우유', '#f7f7f2', '#1f5fbf'], ['번개택배', '#ffcf1a', '#1b1b1b'], ['도루모터스', '#1c2f6b', '#fff'], ['스윙전자', '#0f9d7a', '#fff'], ['만루라면', '#d8261d', '#ffe36b'], ['직구은행', '#233a8c', '#ffd23f'], ['커브카드', '#161616', '#ff7ab8']];
function adCanvas(n, pw, ph, ads, teamPad) {
  const c = makeCanvas(n * pw, ph), g = c.getContext('2d');
  for (let i = 0; i < n; i++) {
    const a = ads[i % ads.length], x = i * pw;
    if (!a) { g.fillStyle = teamPad || '#14365a'; g.fillRect(x, 0, pw, ph); continue; }
    g.fillStyle = a[1]; g.fillRect(x, 0, pw, ph);
    g.fillStyle = a[2]; g.font = `${Math.round(ph * 0.46)}px ${FONT_DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(a[0], x + pw / 2, ph * 0.54, pw * 0.86);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + pw - 2, 0, 2, ph);
  }
  return c;
}
const fencePath = []; for (let f = -45; f <= 45.001; f += 1) fencePath.push(S.polar(f, S.fenceDist(f)));
{
  const tex = canvasTex(adCanvas(8, 256, 128, [ADS[0], null, ADS[1], ADS[2], null, ADS[3], ADS[4], null]), { repeat: true });
  const geo = ribbonGeo(fencePath, () => 0, () => S.FENCE_H, { x: 0, z: 0 }, 1 / 51.2);
  const wall = new T.Mesh(geo, new T.MeshLambertMaterial({ map: tex })); world.add(wall);
  const top = new T.Mesh(ribbonGeo(fencePath, () => S.FENCE_H - 0.02, () => S.FENCE_H + 0.16, { x: 0, z: 0 }), new T.MeshBasicMaterial({ color: 0xffd23f }));
  world.add(top);
  // 코너 짧은 벽 (폴 → 파울 관중석)
  for (const s of [1, -1]) {
    const pole = S.polar(45 * s, S.fenceDist(45)), N = s > 0 ? N1 : N3;
    const path = [pole, { x: pole.x + N.x * FOUL_OFF, z: pole.z + N.z * FOUL_OFF }];
    world.add(new T.Mesh(ribbonGeo(path, () => 0, () => S.FENCE_H, { x: 0, z: 0 }), new T.MeshLambertMaterial({ color: 0x14365a })));
  }
  // 거리 표시
  for (const f of [-45, -22.5, 0, 22.5, 45]) {
    const d = Math.round(S.fenceDist(f));
    const c = makeCanvas(128, 64), g = c.getContext('2d');
    g.fillStyle = '#fff'; g.font = `56px ${FONT_DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d + 'm', 64, 36);
    const m = new T.Mesh(new T.PlaneGeometry(2.6, 1.3), new T.MeshBasicMaterial({ map: canvasTex(c), transparent: true }));
    const p = S.polar(f + (f === 45 ? -1.2 : f === -45 ? 1.2 : 0), S.fenceDist(f) - 0.08);
    m.position.set(p.x, 3.2 + 0.9, p.z); m.rotation.y = Math.atan2(-p.x, -p.z); world.add(m);
    const back = new T.Mesh(new T.PlaneGeometry(2.9, 1.2), new T.MeshLambertMaterial({ color: 0x0f2a48 }));
    back.position.set(p.x * 1.0006, 3.2 + 0.9, p.z * 1.0006); back.rotation.y = m.rotation.y; world.add(back);
  }
  // 폴
  for (const s of [1, -1]) {
    const p = S.polar(45 * s, S.fenceDist(45) + 0.2);
    const pole = new T.Mesh(new T.CylinderGeometry(0.16, 0.2, 26, 10), new T.MeshBasicMaterial({ color: 0xffd23f }));
    pole.position.set(p.x, 13, p.z); world.add(pole);
    const screen = new T.Mesh(new T.PlaneGeometry(0.9, 18), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.55, side: T.DoubleSide }));
    const q = S.polar(45 * s - s * 0.35, S.fenceDist(45) + 0.2); screen.position.set(q.x, 16, q.z); screen.rotation.y = Math.atan2(q.x, q.z) + Math.PI / 2; world.add(screen);
  }
  // 백스크린
  const eye = []; for (let f = -EYE - 1; f <= EYE + 1.001; f += 1) eye.push(S.polar(f, S.fenceDist(f) + 1.2));
  world.add(new T.Mesh(ribbonGeo(eye, () => 0, (i) => 13, { x: 0, z: 0 }), new T.MeshLambertMaterial({ color: 0x0d1712 })));
  const eyeRoof = new T.Mesh(ribbonGeo(eye.map((p) => ({ x: p.x * 1.2, z: p.z * 1.2 })), () => 0, () => 14, { x: 0, z: 0 }), new T.MeshLambertMaterial({ color: 0x0d1712 }));
  world.add(eyeRoof);
}

/* ---------- 관중석 ---------- */
const seatTex = (() => {
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#2a3346'; g.fillRect(0, 0, 256, 256);
  for (let r = 0; r < 8; r++) {
    const y = r * 32;
    g.fillStyle = '#1b2130'; g.fillRect(0, y, 256, 8);
    for (let s = 0; s < 16; s++) { g.fillStyle = s % 8 === 7 ? '#3b3f47' : '#8e96a8'; g.fillRect(s * 16 + 2, y + 10, 12, 18); }
  }
  return canvasTex(c, { repeat: true, repeatT: true });
})();
// 단면 프로파일: w(0=외야,1=내야)에 따라
function standProfile(w) {
  return {
    h0: lerp(3.0, 2.3, w), d1: lerp(26, 22, w), s1: lerp(0.55, 0.5, w),
  };
}
const standMeshes = [];
function buildStandSurface(path, prof, sectionColor) {
  // prof(i) => {d0, d1, y0, y1}
  const pos = [], uv = [], col = [], idx = [];
  let L = 0;
  const rowsV = 8;
  for (let i = 0; i < path.length; i++) {
    const p = path[i]; if (i) L += Math.hypot(p.x - path[i - 1].x, p.z - path[i - 1].z);
    const q = prof(i);
    for (let j = 0; j <= 1; j++) {
      const d = j ? q.d1 : q.d0, y = j ? q.y1 : q.y0;
      pos.push(p.x + p.nx * d, y, p.z + p.nz * d);
      uv.push(L / 12, ((q.d1 - q.d0) * j) / (0.85 * rowsV));
      const c = sectionColor(i); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < path.length - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals();
  // 법선이 아래를 향하면 뒤집기
  if (g.attributes.normal.getY(0) < 0) { const ii = g.index.array; for (let t = 0; t < ii.length; t += 3) { const a = ii[t + 1]; ii[t + 1] = ii[t + 2]; ii[t + 2] = a; } g.computeVertexNormals(); }
  const m = new T.Mesh(g, new T.MeshLambertMaterial({ map: seatTex, vertexColors: true }));
  world.add(m); standMeshes.push(m); return m;
}
const secA = new T.Color('#5d6f9e'), secB = new T.Color('#9a5b5b'), secC = new T.Color('#5f8a73'), secD = new T.Color('#b39a55');
function secColor(i) {
  const p = BOUND[i], ph = S.phiOf(p.x, p.z);
  if (p.w < 0.5) return Math.abs(ph) < 25 ? secC : secD;
  return Math.abs(ph) > 95 ? secB : secA;
}
// 하단 스탠드
const LOW = BOUND.map((p) => standProfile(p.w));
buildStandSurface(BOUND, (i) => ({ d0: 0, d1: LOW[i].d1, y0: LOW[i].h0, y1: LOW[i].h0 + LOW[i].d1 * LOW[i].s1 }), secColor);
// 앞벽
const frontWallTex = { tex: null, canvas: null };
{
  const c = adCanvas(16, 256, 64, [null, ADS[5], null, ADS[6], null, ADS[7], null, ADS[0], null, ADS[2], null, ADS[4], null, ADS[1], null, ADS[3]], '#12305a');
  frontWallTex.canvas = c; frontWallTex.tex = canvasTex(c, { repeat: true });
  const geo = ribbonGeo(BOUND, () => 0, (i) => LOW[i].h0, { x: 0, z: -45 }, 1 / 64);
  world.add(new T.Mesh(geo, new T.MeshLambertMaterial({ map: frontWallTex.tex })));
}
// 상단 스탠드 (내야만) + LED 리본
const upIdx = BOUND.map((p, i) => i).filter((i) => BOUND[i].w >= 0.99);
const UPATH = upIdx.map((i) => BOUND[i]);
const ledRibbon = { tex: null, canvas: null };
{
  const back0 = (i) => LOW[upIdx[i]].h0 + LOW[upIdx[i]].d1 * LOW[upIdx[i]].s1; // ~13.3
  const dA = (i) => LOW[upIdx[i]].d1;
  // 페시아
  const fasPath = UPATH.map((p, i) => ({ x: p.x + p.nx * (dA(i) + 1.2), z: p.z + p.nz * (dA(i) + 1.2) }));
  const c = makeCanvas(2048, 64); ledRibbon.canvas = c; ledRibbon.tex = canvasTex(c, { repeat: true });
  const fas = new T.Mesh(ribbonGeo(fasPath, (i) => back0(i) + 0.4, (i) => back0(i) + 2.6, { x: 0, z: -45 }, 1 / 80), new T.MeshBasicMaterial({ map: ledRibbon.tex }));
  world.add(fas);
  const under = new T.Mesh(ribbonGeo(fasPath, (i) => back0(i) - 0.5, (i) => back0(i) + 0.4, { x: 0, z: -45 }), new T.MeshLambertMaterial({ color: 0x20283a }));
  world.add(under);
  buildStandSurface(UPATH.map((p) => p), (i) => ({ d0: dA(i) + 1.2, d1: dA(i) + 1.2 + 20, y0: back0(i) + 2.6, y1: back0(i) + 2.6 + 20 * 0.62 }), (i) => secColor(upIdx[i]));
  // 뒷벽
  const backPath = UPATH.map((p, i) => ({ x: p.x + p.nx * (dA(i) + 21.2), z: p.z + p.nz * (dA(i) + 21.2) }));
  world.add(new T.Mesh(ribbonGeo(backPath, () => 0, (i) => back0(i) + 2.6 + 12.4 + 5, { x: 0, z: -45 }), new T.MeshLambertMaterial({ color: 0x1a1f2b })));
  // 지붕 캐노피
  const roofPts = [];
  for (let i = 0; i < UPATH.length; i++) { const p = UPATH[i]; roofPts.push({ a: { x: p.x + p.nx * (dA(i) + 21.2), z: p.z + p.nz * (dA(i) + 21.2) }, b: { x: p.x + p.nx * (dA(i) + 9), z: p.z + p.nz * (dA(i) + 9) }, y: back0(i) + 2.6 + 12.4 + 5 }); }
  const rp = [], ri = [];
  roofPts.forEach((r, i) => { rp.push(r.a.x, r.y, r.a.z, r.b.x, r.y - 1.2, r.b.z); if (i) { const k = (i - 1) * 2; ri.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } });
  const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(rp, 3)); rg.setIndex(ri); rg.computeVertexNormals();
  world.add(new T.Mesh(rg, new T.MeshLambertMaterial({ color: 0x2b3345, side: T.DoubleSide })));
}
// 외야/하단 뒷벽
{
  const bp = BOUND.map((p, i) => ({ x: p.x + p.nx * LOW[i].d1, z: p.z + p.nz * LOW[i].d1 }));
  const outIdx = BOUND.map((p, i) => i).filter((i) => BOUND[i].w < 0.99);
  // 외야 쪽만 (내야는 상단 스탠드가 덮음) — 연속 구간으로 나눠서
  let seg = [];
  const flush = () => { if (seg.length > 1) world.add(new T.Mesh(ribbonGeo(seg.map((i) => bp[i]), () => 0, (k) => LOW[seg[k]].h0 + LOW[seg[k]].d1 * LOW[seg[k]].s1 + 2.2, { x: 0, z: -45 }), new T.MeshLambertMaterial({ color: 0x1a1f2b }))); seg = []; };
  for (let i = 0; i < BOUND.length; i++) { if (BOUND[i].w < 0.99 || (seg.length && BOUND[i - 1] && BOUND[i - 1].w < 0.99)) seg.push(i); else flush(); if (BOUND[i].w >= 0.99) flush(); }
  flush();
  void outIdx;
}

/* ---------- 관중 (인스턴싱 + 셰이더 바운스) ---------- */
const cheerU = { uT: { value: 0 }, uCH: { value: 0 }, uCA: { value: 0 } };
function crowdMat(color) {
  const m = new T.MeshLambertMaterial({ color });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = cheerU.uT; sh.uniforms.uCH = cheerU.uCH; sh.uniforms.uCA = cheerU.uCA;
    sh.vertexShader = 'attribute float aPh;\nattribute float aSide;\nuniform float uT;\nuniform float uCH;\nuniform float uCA;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n float ch = aSide > 0.5 ? uCH : (aSide < -0.5 ? uCA : max(uCH, uCA) * 0.6);\n float bb = abs(sin(uT * (7.0 + aPh * 3.0) + aPh * 30.0));\n transformed.y += ch * bb * 0.38 + 0.025 * sin(uT * 1.7 + aPh * 50.0);\n transformed.x += ch * 0.06 * sin(uT * 9.0 + aPh * 11.0);');
  };
  return m;
}
const CROWD_N = lowEnd ? 2200 : isTouch ? 3000 : 4400;
const crowd = (() => {
  const bodyG = new T.CylinderGeometry(0.19, 0.23, 0.6, 6); bodyG.translate(0, 0.3, 0);
  const headG = new T.SphereGeometry(0.12, 7, 5); headG.translate(0, 0.72, 0);
  const ph = new Float32Array(CROWD_N), side = new Float32Array(CROWD_N);
  const bodies = new T.InstancedMesh(bodyG, crowdMat(0xffffff), CROWD_N);
  const heads = new T.InstancedMesh(headG, crowdMat(0x2a1d16), CROWD_N);
  // 샘플링: 하단 스탠드(모든 구간) + 상단 스탠드(내야)
  const segs = [];
  let tot = 0;
  const addSurface = (path, prof, isUp) => {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], q = prof(i);
      const dens = isUp ? 1.1 : (a.w > 0.5 ? (Math.hypot(a.x, a.z) < 40 ? 2.2 : 1.5) : 0.8);
      const len = Math.hypot(b.x - a.x, b.z - a.z) * (q.d1 - q.d0) * dens;
      segs.push({ a, b, q, prof, i, len, isUp }); tot += len;
    }
  };
  addSurface(BOUND, (i) => ({ d0: 0.5, d1: LOW[i].d1 - 0.6, y0: LOW[i].h0, s: LOW[i].s1 }), false);
  addSurface(UPATH, (i) => { const L = LOW[upIdx[i]]; return { d0: L.d1 + 1.8, d1: L.d1 + 20.6, y0: L.h0 + L.d1 * L.s1 + 2.6, s: 0.62, off: L.d1 + 1.2 }; }, true);
  const m4 = new T.Matrix4(), q4 = new T.Quaternion(), s4 = new T.Vector3(1, 1, 1), p4 = new T.Vector3(), up = new T.Vector3(0, 1, 0);
  const place = [];
  for (let n = 0; n < CROWD_N; n++) {
    let r = Math.random() * tot, sg = segs[0];
    for (const s of segs) { r -= s.len; if (r <= 0) { sg = s; break; } }
    const t = Math.random(), q = sg.q;
    const x = lerp(sg.a.x, sg.b.x, t), z = lerp(sg.a.z, sg.b.z, t), nx = lerp(sg.a.nx, sg.b.nx, t), nz = lerp(sg.a.nz, sg.b.nz, t);
    const rows = Math.floor((q.d1 - q.d0) / 0.85);
    const row = Math.floor(Math.random() * rows), d = q.d0 + row * 0.85 + 0.3;
    const y = q.y0 + (d - (q.off || 0)) * q.s + 0.06;
    p4.set(x + nx * d, y, z + nz * d);
    q4.setFromAxisAngle(up, Math.atan2(-nx, -nz));
    const sc = 0.9 + Math.random() * 0.2; s4.set(sc, sc, sc);
    m4.compose(p4, q4, s4); bodies.setMatrixAt(n, m4); heads.setMatrixAt(n, m4);
    ph[n] = Math.random();
    const phi = S.phiOf(p4.x, p4.z);
    side[n] = Math.abs(phi) < 40 && p4.z < -60 ? 0 : p4.x > 0 ? 1 : -1;
    place.push(side[n]);
  }
  for (const m of [bodies, heads]) {
    m.geometry.setAttribute('aPh', new T.InstancedBufferAttribute(ph, 1));
    m.geometry.setAttribute('aSide', new T.InstancedBufferAttribute(side, 1));
    m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; world.add(m);
  }
  return { bodies, heads, side: place };
})();
function paintCrowd(homeT, awayT) {
  const cc = new T.Color();
  const pal = (t) => [t.c1, t.c1, t.c1, '#ffffff', t.c2, '#ffffff', t.c1];
  const hp = pal(homeT), ap = pal(awayT);
  const neutral = ['#d9d9d9', '#3b4a6b', '#9c3b3b', '#e0c36a', '#2f2f35', '#6e8fc2', '#ffffff', homeT.c1, awayT.c1];
  for (let i = 0; i < CROWD_N; i++) {
    const s = crowd.side[i];
    const arr = s > 0 ? (Math.random() < 0.82 ? hp : neutral) : s < 0 ? (Math.random() < 0.7 ? ap : neutral) : neutral;
    cc.set(arr[Math.floor(Math.random() * arr.length)]);
    cc.multiplyScalar(0.72 + Math.random() * 0.35);
    crowd.bodies.setColorAt(i, cc);
  }
  crowd.bodies.instanceColor.needsUpdate = true;
}

/* ---------- 조명탑 ---------- */
const towerGlows = [], towerPanels = [];
{
  const panelTex = (() => {
    const c = makeCanvas(256, 128), g = c.getContext('2d');
    g.fillStyle = '#20242c'; g.fillRect(0, 0, 256, 128);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 8; k++) {
      const gr = g.createRadialGradient(18 + k * 31, 18 + r * 31, 1, 18 + k * 31, 18 + r * 31, 13);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#fff4dc'); gr.addColorStop(1, '#6d6a62');
      g.fillStyle = gr; g.beginPath(); g.arc(18 + k * 31, 18 + r * 31, 12, 0, Math.PI * 2); g.fill();
    }
    return canvasTex(c);
  })();
  const spots = [];
  for (const s of [1, -1]) {
    spots.push({ x: s * 76, z: 22 }, { x: s * 112, z: -26 }, { x: s * 92, z: -128 });
  }
  const poleMat = new T.MeshLambertMaterial({ color: 0x5b6270 });
  for (const sp of spots) {
    const H = 52;
    const pole = new T.Mesh(new T.CylinderGeometry(0.55, 0.9, H, 8), poleMat); pole.position.set(sp.x, H / 2, sp.z); world.add(pole);
    const bank = new T.Group(); bank.position.set(sp.x, H + 3, sp.z);
    const frame = new T.Mesh(new T.BoxGeometry(13, 7, 0.8), new T.MeshLambertMaterial({ color: 0x2a2f38 })); bank.add(frame);
    const panel = new T.Mesh(new T.PlaneGeometry(12.4, 6.4), new T.MeshBasicMaterial({ map: panelTex, color: 0xffffff }));
    panel.position.z = 0.42; bank.add(panel); towerPanels.push(panel);
    bank.lookAt(0, 0, -45); bank.rotateX(-0.25);
    world.add(bank);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: 0xfff3dc, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
    glow.scale.set(46, 46, 1); glow.position.copy(bank.position); towerGlows.push(glow); world.add(glow);
  }
}

/* ---------- 전광판 ---------- */
const board = { W: 256, H: 96, small: makeCanvas(256, 96), big: makeCanvas(1024, 384), tex: null, flash: 0 };
{
  board.tex = canvasTex(board.big, { nomip: true });
  const g = new T.Group(); g.position.set(0, 0, -158);
  const frame = new T.Mesh(new T.BoxGeometry(50, 19, 1.6), new T.MeshLambertMaterial({ color: 0x1b202b })); frame.position.y = 27; g.add(frame);
  const scr = new T.Mesh(new T.PlaneGeometry(46, 17.25), new T.MeshBasicMaterial({ map: board.tex })); scr.position.set(0, 27, 0.82); g.add(scr);
  const header = new T.Mesh(new T.BoxGeometry(50, 2.2, 1.8), new T.MeshLambertMaterial({ color: 0x0f1d44 })); header.position.set(0, 37.6, 0); g.add(header);
  for (const s of [-1, 1]) { const leg = new T.Mesh(new T.BoxGeometry(2.2, 18, 2.2), new T.MeshLambertMaterial({ color: 0x2c313c })); leg.position.set(s * 15, 9, -0.5); g.add(leg); }
  world.add(g);
}
const dotMask = (() => {
  const c = makeCanvas(4, 4), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 4, 4);
  g.clearRect(0, 0, 3, 3);
  return c;
})();
function blitBoard() {
  const g = board.big.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, 1024, 384);
  g.drawImage(board.small, 0, 0, 1024, 384);
  g.fillStyle = g.createPattern(dotMask, 'repeat');
  g.globalAlpha = 0.72; g.fillRect(0, 0, 1024, 384); g.globalAlpha = 1;
  board.tex.needsUpdate = true;
}

/* ---------- LED 리본 ---------- */
function paintLed(homeT, awayT) {
  const c = ledRibbon.canvas, g = c.getContext('2d');
  g.fillStyle = '#05070c'; g.fillRect(0, 0, 2048, 64);
  const items = [
    [`${homeT.city} ${homeT.name}`, homeT.c1, homeT.c2], ['풀카운트 3D', '#0b1535', '#ffb627'], [`${awayT.city} ${awayT.name}`, awayT.c1, awayT.c2], ['홈런통신', '#e8412c', '#fff'], ['만루라면', '#d8261d', '#ffe36b'], ['직구은행', '#233a8c', '#ffd23f'],
  ];
  const w = 2048 / items.length;
  items.forEach((it, i) => {
    g.fillStyle = it[1]; g.fillRect(i * w + 3, 4, w - 6, 56);
    g.fillStyle = lum(it[1]) > 0.6 && lum(it[2]) > 0.6 ? '#111' : it[2];
    g.font = `34px ${FONT_DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(it[0], i * w + w / 2, 34, w - 20);
  });
  g.fillStyle = 'rgba(0,0,0,0.35)'; for (let x = 0; x < 2048; x += 3) g.fillRect(x, 0, 1, 64);
  ledRibbon.tex.needsUpdate = true;
  // 앞벽: 홈팀 이름 패널 다시 그리기
  const fc = frontWallTex.canvas, fg = fc.getContext('2d');
  for (let i = 0; i < 16; i += 2) {
    const x = i * 256;
    fg.fillStyle = shadeHex(homeT.c1, -0.25); fg.fillRect(x, 0, 256, 64);
    fg.fillStyle = lum(homeT.c1) > 0.6 ? '#101010' : '#ffffff'; fg.font = `30px ${FONT_DISP}`; fg.textAlign = 'center'; fg.textBaseline = 'middle';
    fg.fillText(i % 4 === 0 ? homeT.city.toUpperCase() : homeT.name, x + 128, 34, 230);
  }
  frontWallTex.tex.needsUpdate = true;
}

/* ---------- 불꽃놀이 ---------- */
const FW_N = 900;
const fireworks = (() => {
  const pos = new Float32Array(FW_N * 3), col = new Float32Array(FW_N * 3);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
  const m = new T.Points(g, new T.PointsMaterial({ size: 2.2, map: dotTex, vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false }));
  m.frustumCulled = false; world.add(m);
  const P = []; for (let i = 0; i < FW_N; i++) P.push({ x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1, g: 1, b: 1 });
  return { m, pos, col, P, next: 0 };
})();
function burst(x, y, z, hex, n = 110, o = {}) {
  const c = new T.Color(hex), willow = o.kind === 'willow', ring = o.kind === 'ring';
  const tilt = Math.random() * 0.9 - 0.45;
  for (let k = 0; k < n; k++) {
    const p = fireworks.P[fireworks.next]; fireworks.next = (fireworks.next + 1) % FW_N;
    const a = ring ? (k / n) * Math.PI * 2 : Math.random() * Math.PI * 2, e = ring ? Math.PI / 2 + tilt * Math.cos(a) : Math.acos(2 * Math.random() - 1);
    const sp = (o.sp || (willow ? 7 : 12)) * (ring ? 1.25 : 1) + Math.random() * (ring ? 0.6 : 5);
    p.x = x; p.y = y; p.z = z; p.vx = Math.sin(e) * Math.cos(a) * sp; p.vy = Math.cos(e) * sp; p.vz = Math.sin(e) * Math.sin(a) * sp;
    if (ring) { const vy = p.vy; p.vy = p.vz * 0.9; p.vz = vy; } // 관중석 쪽을 향한 고리
    p.life = p.max = (o.life || (willow ? 2.6 : 1.3)) + Math.random() * 0.6; p.g0 = willow ? 3 : 6;
    const cc = willow ? new T.Color('#ffcf6a') : c; p.r = cc.r; p.g = cc.g; p.b = cc.b;
  }
}
function updateFireworks(dt) {
  const { pos, col, P } = fireworks; let any = false;
  for (let i = 0; i < FW_N; i++) {
    const p = P[i];
    if (p.life > 0) {
      any = true; p.life -= dt; p.vy -= (p.g0 || 6) * dt; p.vx *= 0.985; p.vy *= 0.985; p.vz *= 0.985;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const f = Math.max(0, p.life / p.max);
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z; col[i * 3] = p.r * f; col[i * 3 + 1] = p.g * f; col[i * 3 + 2] = p.b * f;
    } else if (pos[i * 3 + 1] !== -99) { pos[i * 3 + 1] = -99; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; }
  }
  fireworks.m.geometry.attributes.position.needsUpdate = true; fireworks.m.geometry.attributes.color.needsUpdate = true;
  fireworks.m.visible = any;
}

/* ---------- 주간/야간 ---------- */
let nightMode = true;
function applyTime(night) {
  nightMode = night;
  if (night) {
    skyU.top.value.set('#040817'); skyU.hor.value.set('#16224a'); skyU.glow.value.set('#6b76a8');
    scene.fog.color.set('#101a3a'); hemi.color.set('#c9d4ff'); hemi.groundColor.set('#1a2a1c'); hemi.intensity = 0.5;
    sun.color.set('#fffaf0'); sun.intensity = 0.64; sun.position.set(25, 90, 40); fill.intensity = 0.34;
    stars.visible = true; towerGlows.forEach((g) => (g.visible = true)); towerPanels.forEach((p) => p.material.color.set(0xffffff));
    outerGround.material.color.set(0x0e1310);
  } else {
    skyU.top.value.set('#2f74d0'); skyU.hor.value.set('#cfe3fa'); skyU.glow.value.set('#ffffff');
    scene.fog.color.set('#bcd4ef'); hemi.color.set('#d6e8ff'); hemi.groundColor.set('#3b4a2e'); hemi.intensity = 0.56;
    sun.color.set('#fff1dc'); sun.intensity = 0.74; sun.position.set(-70, 95, 30); fill.intensity = 0.22;
    stars.visible = false; towerGlows.forEach((g) => (g.visible = false)); towerPanels.forEach((p) => p.material.color.set(0x8a8d94));
    outerGround.material.color.set(0x44503f);
  }
}

