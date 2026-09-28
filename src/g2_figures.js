/* ===================== FIGURES ===================== */
// 관절 위치(엉덩이 0.95, 어깨 ±0.235/0.52, 위팔·아래팔 0.3/0.28, 허벅지·정강이 0.47/0.45)는 포즈·IK와 맞물려 있어서 바꾸면 안 됨.
// 모양만 다듬음: 몸통은 회전체(lathe)로 가슴·어깨 곡선, 팔다리는 캡슐, 얼굴·소매·벨트·양말은 텍스처.
const FG = (() => {
  const cyl = (rt, rb, h, seg, ty) => { const g = new T.CylinderGeometry(rt, rb, h, seg, 1); g.translate(0, ty, 0); return g; };
  // 회전체: [반지름, 높이] 점을 아래→위 순서로. uv.v는 높이 비율로 다시 계산 (텍스처가 늘어나지 않게)
  const lathe = (pts, seg, zs) => {
    const g = new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(Math.max(0, r), y)), seg);
    const P = g.attributes.position, UV = g.attributes.uv;
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < P.count; i++) { lo = Math.min(lo, P.getY(i)); hi = Math.max(hi, P.getY(i)); }
    for (let i = 0; i < P.count; i++) UV.setY(i, (P.getY(i) - lo) / (hi - lo));
    if (zs) g.scale(1, 1, zs);
    g.computeVertexNormals();
    return g;
  };
  // 관절(y=0)에서 아래로 len만큼 내려가는 캡슐
  const capsule = (rt, rb, len, seg = 10) => {
    const pts = [], n = 4;
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * (Math.PI / 2); pts.push([Math.cos(a) * rb, -len + Math.sin(a) * rb]); }
    for (let i = 1; i <= n; i++) { const a = (i / n) * (Math.PI / 2); pts.push([Math.cos(a) * rt, Math.sin(a) * rt]); }
    return lathe(pts, seg);
  };
  // 여러 도형을 한 메시로 합침 (그리기 호출 수 줄이기). uv를 주면 그 점으로 고정(피부색 부분 등), color를 주면 정점색
  const merge = (parts) => {
    const pos = [], nor = [], uv = [], col = [];
    parts.forEach(({ g, uvAt, color }) => {
      const n = g.index ? g.toNonIndexed() : g, P = n.attributes.position, N = n.attributes.normal, U = n.attributes.uv, c = color ? new T.Color(color) : null;
      for (let i = 0; i < P.count; i++) {
        pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i));
        if (uvAt) uv.push(uvAt[0], uvAt[1]); else uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
        if (c) col.push(c.r, c.g, c.b);
      }
    });
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    if (col.length) g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    return g;
  };
  const SKIN_UV = [0.5, 0.985]; // 얼굴 텍스처 맨 위(모자 속) = 맨 피부색
  const g = {
    hips: lathe([[0.148, -0.13], [0.17, -0.07], [0.178, 0.0], [0.172, 0.07], [0.158, 0.12]], 14, 0.84),
    torso: lathe([[0.152, -0.03], [0.16, 0.06], [0.178, 0.18], [0.204, 0.3], [0.222, 0.4], [0.228, 0.47], [0.214, 0.54], [0.176, 0.585], [0.11, 0.615], [0.056, 0.628]], 18, 0.8),
    thigh: capsule(0.093, 0.074, 0.47),
    shin: capsule(0.071, 0.052, 0.45),
    shoe: merge([
      { g: new T.SphereGeometry(0.066, 10, 7).scale(0.86, 0.62, 1.95).translate(0, -0.465, 0.07), uvAt: [0, 0], color: 0x141416 },
      { g: new T.BoxGeometry(0.108, 0.022, 0.26).translate(0, -0.5, 0.065), uvAt: [0, 0], color: 0xe9e9e4 },
    ]),
    sleeve: lathe([[0.07, -0.15], [0.072, -0.1], [0.073, -0.02], [0.068, 0.03], [0.055, 0.058], [0.032, 0.073], [0, 0.078]], 10),
    upper: capsule(0.063, 0.054, 0.3, 9),
    fore: capsule(0.052, 0.041, 0.28, 9),
    hand: new T.SphereGeometry(0.048, 8, 6).scale(0.9, 1.15, 0.75).translate(0, -0.3, 0),
    glove: merge([
      { g: new T.SphereGeometry(0.105, 10, 8).scale(1, 1.22, 0.52).translate(0, -0.34, 0.02) },
      { g: new T.SphereGeometry(0.04, 6, 5).scale(1, 1.4, 0.8).translate(0.085, -0.29, 0.03) },
    ]),
    // 머리 + 코 + 목을 한 메시로 (얼굴은 텍스처)
    head: merge([
      { g: new T.SphereGeometry(0.118, 18, 12).scale(0.93, 1.05, 0.99).translate(0, 0.12, 0) },
      { g: new T.SphereGeometry(0.021, 6, 5).scale(0.75, 1.15, 1).translate(0, 0.103, 0.112), uvAt: SKIN_UV },
      { g: cyl(0.054, 0.062, 0.14, 9, 0.0), uvAt: SKIN_UV },
    ]),
    cap: new T.SphereGeometry(0.126, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.15, 0),
    brim: new T.CylinderGeometry(0.112, 0.112, 0.012, 14, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.95).translate(0, 0.155, 0.1),
    helmet: new T.SphereGeometry(0.137, 16, 9, 0, Math.PI * 2, 0, Math.PI * 0.62).translate(0, 0.13, 0),
    flap: new T.SphereGeometry(0.078, 9, 7).scale(0.45, 1, 1).translate(0, 0.07, 0),
    bat: lathe([[0, 0], [0.021, 0.002], [0.022, 0.012], [0.0135, 0.024], [0.0135, 0.28], [0.017, 0.4], [0.026, 0.56], [0.033, 0.7], [0.0345, 0.82], [0.031, 0.852], [0.018, 0.861], [0, 0.863]], 12),
    mask: merge([
      { g: new T.BoxGeometry(0.2, 0.2, 0.05).translate(0, 0.11, 0.125) },
      { g: new T.BoxGeometry(0.2, 0.012, 0.012).translate(0, 0.14, 0.155) },
      { g: new T.BoxGeometry(0.2, 0.012, 0.012).translate(0, 0.09, 0.155) },
    ]),
    pad: lathe([[0.2, 0.05], [0.235, 0.2], [0.24, 0.4], [0.2, 0.56], [0.12, 0.6]], 12, 0.82),
  };
  const shadowTex = (() => {
    const c = makeCanvas(64, 64), x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return canvasTex(c);
  })();
  g.shadow = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shadowMat = new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
  // 저사양 폰은 정점 조명(Lambert), 나머지는 픽셀 조명(Phong) — 곡면이 매끈해 보임
  const mat = (o = {}) => (lowEnd ? new T.MeshLambertMaterial(o) : new T.MeshPhongMaterial(Object.assign({ shininess: 10, specular: 0x161616 }, o)));
  const gloss = (o = {}) => new T.MeshPhongMaterial(Object.assign({ shininess: 70, specular: 0x5a5a5a }, o));
  const batTex = (() => {
    const c = makeCanvas(16, 128), x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#e8c68e'); gr.addColorStop(1, '#c79a5e');
    x.fillStyle = gr; x.fillRect(0, 0, 16, 128);
    x.fillStyle = 'rgba(120,80,40,0.18)'; for (let i = 0; i < 16; i += 3) x.fillRect(i, 0, 1, 128);
    x.fillStyle = '#1c1c1f'; x.fillRect(0, 100, 16, 28); // 손잡이 테이프
    x.fillStyle = '#2a2a2e'; for (let y = 102; y < 126; y += 4) x.fillRect(0, y, 16, 1);
    return canvasTex(c);
  })();
  const M = {
    shoe: mat({ vertexColors: true }),
    glove: mat({ color: 0x7b4a24 }),
    bat: gloss({ map: batTex, shininess: 40, specular: 0x333333 }),
    black: mat({ color: 0x1b1b1f }),
    gray: mat({ color: 0x6b7078 }),
    navy: mat({ color: 0x1b2440 }),
  };
  return { g, M, mat, gloss, shadowMat };
})();

const _tmpV = new T.Vector3(), _tmpV2 = new T.Vector3(), _tmpQ = new T.Quaternion(), _tmpQ2 = new T.Quaternion();
const DOWN = new T.Vector3(0, -1, 0);

/* ---------- 유니폼·얼굴 텍스처 ---------- */
const TEXC = new Map();
function cachedTex(key, w, h, draw) {
  let t = TEXC.get(key);
  if (!t) { const c = makeCanvas(w, h); draw(c.getContext('2d'), w, h); t = canvasTex(c); TEXC.set(key, t); }
  return t;
}
function jerseyTexture(base, trim, text, num, name, pin) {
  const s = lowEnd ? 1 : 2, W = 256 * s, H = 128 * s, c = makeCanvas(W, H), x = c.getContext('2d');
  x.scale(s, s);
  x.fillStyle = base; x.fillRect(0, 0, 256, 128);
  if (pin) { x.fillStyle = hexA(trim, 0.35); for (let i = 0; i < 256; i += 9) x.fillRect(i, 0, 1.2, 128); }
  // 천 음영 (위는 밝게, 아래는 살짝 어둡게)
  const sh = x.createLinearGradient(0, 0, 0, 128); sh.addColorStop(0, 'rgba(255,255,255,0.08)'); sh.addColorStop(0.55, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.14)');
  x.fillStyle = sh; x.fillRect(0, 0, 256, 128);
  x.fillStyle = trim; x.fillRect(0, 0, 256, 7); x.fillRect(0, 123, 256, 5);
  // 앞 단추선 (u=0이 가슴 한가운데)
  x.fillRect(0, 7, 1.6, 121); x.fillRect(254.4, 7, 1.6, 121);
  x.fillStyle = hexA(trim, 0.9); for (let y = 20; y < 122; y += 17) { x.beginPath(); x.arc(3.2, y, 1.1, 0, Math.PI * 2); x.arc(252.8, y, 1.1, 0, Math.PI * 2); x.fill(); }
  const ink = lum(base) > 0.6 ? trim : (lum(trim) > 0.45 ? trim : '#ffffff');
  const edge = lum(ink) > 0.6 ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.7)';
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.font = `26px ${FONT_DISP}`;
  for (const cx of [0, 256]) { x.lineWidth = 3; x.strokeStyle = edge; x.strokeText(text, cx, 48, 110); x.fillStyle = ink; x.fillText(text, cx, 48, 110); }
  x.font = `bold 14px ${FONT_UI}`; x.fillStyle = ink; x.fillText(name || '', 128, 30, 100);
  x.font = `60px ${FONT_DISP}`;
  x.lineWidth = 4; x.strokeStyle = edge; x.strokeText(String(num), 128, 78);
  x.fillStyle = ink; x.fillText(String(num), 128, 78);
  return canvasTex(c);
}
function sleeveTexture(base, trim) {
  return cachedTex('sl' + base + trim, 16, 32, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    x.fillStyle = trim; x.fillRect(0, h - 6, w, 4);
    x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, h - 2, w, 2);
  });
}
function hipsTexture(pants, belt) {
  return cachedTex('hp' + pants + belt, 64, 32, (x, w, h) => {
    x.fillStyle = pants; x.fillRect(0, 0, w, h);
    x.fillStyle = belt; x.fillRect(0, h * 0.16, w, h * 0.26);
    x.fillStyle = '#d8d8d8'; x.fillRect(0, h * 0.19, 2, h * 0.2); x.fillRect(w - 2, h * 0.19, 2, h * 0.2); // 버클 (앞)
    x.fillStyle = 'rgba(0,0,0,0.28)'; for (let k = 1; k < 8; k++) x.fillRect((k * w) / 8 - 0.5, h * 0.14, 1, h * 0.3); // 벨트 고리
  });
}
function shinTexture(pants, socks, trim) {
  return cachedTex('sh' + pants + socks + trim, 16, 64, (x, w, h) => {
    x.fillStyle = socks; x.fillRect(0, 0, w, h);
    x.fillStyle = trim; x.fillRect(0, 22, w, 3); x.fillRect(0, 29, w, 3);
    x.fillStyle = pants; x.fillRect(0, 0, w, 15);
    x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(0, 15, w, 2);
  });
}
function capTexture(color, text, shiny) {
  return cachedTex('cp' + color + text + (shiny ? 1 : 0), 128, 64, (x, w, h) => {
    x.fillStyle = color; x.fillRect(0, 0, w, h);
    if (shiny) { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(0,0,0,0.1)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }
    if (!text) return;
    const ink = lum(color) > 0.6 ? '#1b1b1f' : '#ffffff';
    x.font = `${text.length > 2 ? 15 : 19}px ${FONT_DISP}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 3; x.strokeStyle = lum(color) > 0.6 ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.35)';
    x.strokeText(text, w * 0.25, h * 0.6, 34); x.fillStyle = ink; x.fillText(text, w * 0.25, h * 0.6, 34);
  });
}
// 얼굴: 머리 구 텍스처 (u=0.25가 정면, 0/0.5가 옆, v는 위→아래). 피부톤·머리색·눈썹·수염을 선수마다 다르게
const SKINS = ['#f2cfb2', '#e8bc98', '#d9a680', '#a8744f', '#6f4a31'];
const HAIRS = ['#15110e', '#2b1d13', '#4a3220', '#7a5530', '#b8904f'];
function faceTexture(sk, hair, v) {
  return cachedTex(`fc${sk}|${hair}|${v}`, 256, 128, (x, w, h) => {
    const skin = SKINS[sk], dk = new T.Color(skin).multiplyScalar(0.72).getStyle();
    x.fillStyle = skin; x.fillRect(0, 0, w, h);
    const fx = w * 0.25; // 얼굴 가운데
    // 볼·턱 음영
    const g1 = x.createRadialGradient(fx, h * 0.6, 4, fx, h * 0.6, 60); g1.addColorStop(0, 'rgba(255,220,200,0.12)'); g1.addColorStop(1, 'rgba(0,0,0,0.08)');
    x.fillStyle = g1; x.fillRect(0, h * 0.4, w, h * 0.6);
    // 머리카락: 모자 아래로 보이는 옆·뒤 (얼굴 앞쪽 ±60°는 비움)
    x.fillStyle = HAIRS[hair];
    x.fillRect(fx + 43, h * 0.38, w - (fx + 43) + (fx - 43), h * 0.08); // 옆머리 (귀 위)
    x.fillRect(0, h * 0.38, fx - 43, h * 0.08);
    x.fillRect(w * 0.5 + 10, h * 0.38, w * 0.5 - 20, h * 0.24); // 뒤통수
    x.fillRect(fx - 43, h * 0.4, 4, 13); x.fillRect(fx + 39, h * 0.4, 4, 13); // 구레나룻
    // 귀 (u=0, 0.5)
    for (const ex of [0, w * 0.5, w]) { x.fillStyle = dk; x.beginPath(); x.ellipse(ex, h * 0.55, 7, 11, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = skin; x.beginPath(); x.ellipse(ex, h * 0.55, 4.5, 8, 0, 0, Math.PI * 2); x.fill(); }
    // 눈썹
    x.fillStyle = HAIRS[hair]; const bt = v & 1 ? 3.2 : 2.2;
    for (const s of [-1, 1]) { x.save(); x.translate(fx + s * 9, h * 0.463); x.rotate(s * -0.12); x.fillRect(-6, -bt / 2, 12, bt); x.restore(); }
    // 눈
    for (const s of [-1, 1]) {
      x.fillStyle = '#f4f1ea'; x.beginPath(); x.ellipse(fx + s * 9, h * 0.515, 4.6, 2.6, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#1d1712'; x.beginPath(); x.ellipse(fx + s * 9, h * 0.518, 2.3, 2.3, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(fx + s * 9 - 5, h * 0.495, 10, 1.2);
    }
    // 코 그림자·입
    x.fillStyle = 'rgba(0,0,0,0.16)'; x.fillRect(fx - 1, h * 0.54, 2, 9);
    x.fillStyle = new T.Color(skin).multiplyScalar(0.62).getStyle(); x.fillRect(fx - 6, h * 0.655, 12, 2);
    // 수염
    if (v & 2) {
      x.fillStyle = hexA(HAIRS[hair], 0.55);
      x.beginPath(); x.ellipse(fx, h * 0.72, 22, 13, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = skin; x.fillRect(fx - 7, h * 0.64, 14, 4);
    } else if (v & 4) { x.fillStyle = hexA(HAIRS[hair], 0.22); x.beginPath(); x.ellipse(fx, h * 0.72, 20, 11, 0, 0, Math.PI * 2); x.fill(); }
    // 모자 속(맨 위) = 순수 피부색 (코·목이 여기 색을 씀)
    x.fillStyle = skin; x.fillRect(0, 0, w, h * 0.06);
  });
}
// 선수마다 얼굴 고정: 이름으로 해시 → 외국인 선수는 피부·머리색 폭을 넓게
function looksOf(pl, seed) {
  const h = hashN(pl ? (pl.eng || pl.name || '') : 'fig' + (seed || 0));
  const foreign = !!(pl && pl.foreign);
  const sk = foreign ? [0, 1, 3, 4, 2][h % 5] : [0, 1, 1, 2][h % 4];
  const hair = foreign ? [0, 1, 2, 3, 4, 1][(h >>> 4) % 6] : ((h >>> 4) % 5 === 0 ? 1 : 0);
  const v = ((h >>> 8) & 1) | ((h >>> 9) % (foreign ? 3 : 8) === 0 ? 2 : 0) | ((h >>> 12) % 4 === 0 ? 4 : 0);
  return { sk, hair, v };
}

let figSerial = 0;
function makeFigure(o) {
  // o: {jersey, pants, cap, trim, socks, helmet(bool), glove('L'|'R'|null), skin, num, name, teamText, capText, pin, kind}
  const { g, M, mat, gloss } = FG;
  const root = new T.Group(), body = new T.Group(), hip = new T.Group(), spine = new T.Group(), neck = new T.Group();
  const mk = (geo, m, parent) => { const ms = new T.Mesh(geo, m); parent.add(ms); return ms; };
  const jerseyMat = mat({ map: jerseyTexture(o.jersey, o.trim, o.teamText || '', o.num == null ? '' : o.num, o.name, o.pin) });
  const sleeveMat = mat({ map: sleeveTexture(o.jersey, o.trim) });
  const pantsMat = mat({ color: o.pants });
  const hipsMat = mat({ map: hipsTexture(o.pants, o.belt || '#16161a') });
  const shinMat = mat({ map: shinTexture(o.pants, o.socks || o.trim, o.pants) });
  const capMat = o.helmet ? gloss({ map: capTexture(o.cap, o.capText || '', true) }) : mat({ map: capTexture(o.cap, o.capText || '') });
  const capPlain = o.helmet ? gloss({ color: o.cap }) : mat({ color: o.cap });
  const id = figSerial, lk = o.skin != null ? { sk: o.skin, hair: 0, v: figSerial % 3 } : looksOf(null, id);
  const skinMat = mat({ color: SKINS[lk.sk], emissive: new T.Color(SKINS[lk.sk]).multiplyScalar(0.16) });
  const headMat = mat({ map: faceTexture(lk.sk, lk.hair, lk.v), emissive: 0x2a2018 });
  figSerial++;
  root.add(body); body.add(hip); hip.position.y = 0.95;
  mk(g.hips, hipsMat, hip);
  hip.add(spine); spine.position.y = 0.08;
  const torso = mk(g.torso, jerseyMat, spine);
  spine.add(neck); neck.position.y = 0.6;
  mk(g.head, headMat, neck);
  let hat;
  if (o.helmet) { hat = mk(g.helmet, capMat, neck); const fl = mk(g.flap, capPlain, neck); fl.position.x = o.flapSide || -0.12; }
  else { hat = mk(g.cap, capMat, neck); mk(g.brim, capPlain, neck); }
  if (o.mask) mk(g.mask, M.black, neck);
  if (o.pad) mk(g.pad, M.black, spine);
  const leg = (s) => {
    const L = new T.Group(); L.position.set(0.095 * s, -0.02, 0); hip.add(L);
    mk(g.thigh, pantsMat, L);
    const K = new T.Group(); K.position.y = -0.47; L.add(K);
    mk(g.shin, shinMat, K); mk(g.shoe, M.shoe, K);
    return { L, K };
  };
  const arm = (s) => {
    const Sh = new T.Group(); Sh.position.set(0.235 * s, 0.52, 0); spine.add(Sh);
    mk(g.sleeve, sleeveMat, Sh); mk(g.upper, skinMat, Sh);
    const E = new T.Group(); E.position.y = -0.3; Sh.add(E);
    mk(g.fore, skinMat, E);
    const isGlove = (o.glove === 'L' && s > 0) || (o.glove === 'R' && s < 0);
    const hand = mk(isGlove ? g.glove : g.hand, isGlove ? M.glove : skinMat, E);
    return { Sh, E, hand };
  };
  const lL = leg(1), rL = leg(-1), lA = arm(1), rA = arm(-1);
  const sh = new T.Mesh(g.shadow, FG.shadowMat); sh.scale.set(1.1, 1, 1.1); sh.renderOrder = 5;
  const f = {
    root, body, hip, spine, neck, torso, hat, lL, rL, lA, rA, shadow: sh, jerseyMat, capMat, capPlain, pantsMat, hipsMat, shinMat, sleeveMat, skinMat, headMat,
    P: neutralPose(), run: 0, kind: o.kind || '', visible: true, helmet: !!o.helmet, id,
  };
  f.ownMats = [jerseyMat, capMat, capPlain, pantsMat, hipsMat, shinMat, sleeveMat, skinMat, headMat];
  world.add(root); world.add(sh);
  return f;
}
function setFigureColors(f, o) {
  f.jerseyMat.map && f.jerseyMat.map.dispose();
  f.jerseyMat.map = jerseyTexture(o.jersey, o.trim, o.teamText || '', o.num == null ? '' : o.num, o.name, o.pin); f.jerseyMat.needsUpdate = true;
  f.sleeveMat.map = sleeveTexture(o.jersey, o.trim);
  f.pantsMat.color.set(o.pants);
  f.hipsMat.map = hipsTexture(o.pants, o.belt || '#16161a');
  f.shinMat.map = shinTexture(o.pants, o.socks || o.trim, o.pants);
  f.capMat.map = capTexture(o.cap, o.capText || '', f.helmet); f.capPlain.color.set(o.cap);
}
// 선수 얼굴·피부 (dress할 때 선수가 바뀌면)
function setFigureLooks(f, pl) {
  const lk = looksOf(pl, f.id);
  f.skinMat.color.set(SKINS[lk.sk]); f.skinMat.emissive.set(SKINS[lk.sk]).multiplyScalar(0.16);
  f.headMat.map = faceTexture(lk.sk, lk.hair, lk.v);
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
// 팔 높이(slot): 0 = 오버핸드·스리쿼터(기본), 1 = 사이드암, 2 = 언더핸드(잠수함). 실제 릴리스 높이로 정함 (tools/pitch_mix.js)
// 릴리스 순간 자세만 바꾸면 공도 그 손 위치에서 나감 (릴리스 지점 = 3D 투수의 손)
const REL_SIDE = pose({ hipY: -0.22, spX: 0.42, spZ: 0.22, lLx: -0.8, lK: 0.5, rLx: 0.6, rK: 0.62, rSx: -1.3, rSz: -1.32, rE: -0.18, lSx: -0.6, lE: -1.8, lSz: 0.3, hdX: -0.2 });
const REL_SUB = pose({ hipY: -0.3, spX: 0.85, spZ: 0.36, lLx: -1.05, lK: 0.95, rLx: 0.7, rK: 1.0, rSx: -0.6, rSz: -1.05, rE: -0.12, lSx: -0.5, lE: -1.7, lSz: 0.3, hdX: -0.6 });
const PITCH_KF_SLOT = {};
function pitchKF(hand, slot) {
  const s = Math.round(clamp(slot || 0, 0, 2) * 10) / 10, key = hand + s;
  if (PITCH_KF_SLOT[key]) return PITCH_KF_SLOT[key];
  let K = PITCH_KF;
  if (s > 0) {
    const rel = s <= 1 ? blendPose(pose({}), PITCH_KF[3].p, REL_SIDE, s) : blendPose(pose({}), REL_SIDE, REL_SUB, s - 1);
    K = PITCH_KF.map((k, i) => (i === 3 ? { u: k.u, rot: k.rot, dz: k.dz, p: rel } : k));
  }
  if (hand === 'L') K = K.map((k) => ({ u: k.u, rot: -k.rot, dz: k.dz, p: mirrorPose(k.p) }));
  return (PITCH_KF_SLOT[key] = K);
}
function pitcherPose(f, u, hand, slot) {
  const K = pitchKF(hand, slot);
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
    m, sh, halo, trail, hist, N, tp, tc, hot: 0,
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
        const f = (1 - i / N) * (0.8 + this.hot * 0.4), h = this.hot * (i / N + 0.35);
        tc[i * 3] = f; tc[i * 3 + 1] = f * (1 - h * 0.55); tc[i * 3 + 2] = f * (0.95 - h * 0.85);
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

