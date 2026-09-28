/* ===================== 선수 얼굴 (사진 · 그림) ===================== */
// 우선순위: ① 내가 올린 사진(이 기기에만 저장) ② Wikimedia Commons 자유 이용 사진(저작자 표시) ③ 3D 선수와 같은 얼굴로 그린 그림
const MYPH = store.get('myphotos', {}) || {};
const phId = (pl) => (pl && pl.ti != null ? S.TEAMS[pl.ti].id + '|' + pl.key : null);
function myPhoto(pl) { const k = phId(pl); return k ? MYPH[k] : null; }
function setMyPhoto(pl, url) {
  const k = phId(pl); if (!k) return false;
  if (url) MYPH[k] = url; else delete MYPH[k];
  store.set('myphotos', MYPH);
  if (url && (store.get('myphotos', {}) || {})[k] !== url) { delete MYPH[k]; return false; } // 저장 공간 부족
  return true;
}
const _genFace = new Map();
// 그림 얼굴: 3D 선수와 같은 피부·머리색 (looksOf), 팀 모자·유니폼
function genFace(pl) {
  const key = (pl.ti == null ? '-' : pl.ti) + '|' + (pl.key || pl.name);
  let url = _genFace.get(key); if (url) return url;
  const t = S.TEAMS[pl.ti == null ? 0 : pl.ti], lk = looksOf(pl, 0);
  const c = makeCanvas(128, 128), x = c.getContext('2d'), skin = SKINS[lk.sk], hair = HAIRS[lk.hair];
  const dk = (hex, k) => new T.Color(hex).multiplyScalar(k).getStyle();
  const bg = x.createLinearGradient(0, 0, 0, 128); bg.addColorStop(0, dk(t.c1, 1.15)); bg.addColorStop(1, dk(t.c1, 0.55));
  x.fillStyle = bg; x.fillRect(0, 0, 128, 128);
  x.fillStyle = 'rgba(255,255,255,0.07)'; for (let i = -128; i < 128; i += 14) { x.beginPath(); x.moveTo(i, 128); x.lineTo(i + 128, 0); x.lineTo(i + 135, 0); x.lineTo(i + 7, 128); x.fill(); }
  // 어깨·유니폼
  const jersey = lum(t.c1) > 0.6 ? '#f3f3ee' : t.c1, trim = lum(t.c1) > 0.6 ? t.c2 : t.c2;
  x.fillStyle = jersey; x.beginPath(); x.moveTo(8, 128); x.quadraticCurveTo(14, 96, 44, 92); x.lineTo(84, 92); x.quadraticCurveTo(114, 96, 120, 128); x.fill();
  x.strokeStyle = trim; x.lineWidth = 4; x.beginPath(); x.moveTo(50, 92); x.lineTo(64, 106); x.lineTo(78, 92); x.stroke();
  x.fillStyle = lum(jersey) > 0.6 ? trim : '#ffffff'; x.font = `18px ${FONT_DISP}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (pl.num) x.fillText(String(pl.num), 96, 114);
  // 목·머리
  x.fillStyle = dk(skin, 0.86); x.fillRect(54, 76, 20, 20);
  x.fillStyle = skin; x.beginPath(); x.ellipse(64, 62, 25, 29, 0, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.ellipse(39, 64, 5, 8, 0, 0, Math.PI * 2); x.ellipse(89, 64, 5, 8, 0, 0, Math.PI * 2); x.fill(); // 귀
  x.fillStyle = hair; x.fillRect(38, 42, 7, 16); x.fillRect(83, 42, 7, 16); // 옆머리
  // 모자
  const capC = lum(t.c1) > 0.55 ? t.c2 : t.c1;
  x.fillStyle = capC; x.beginPath(); x.ellipse(64, 44, 29, 22, 0, Math.PI, 0); x.fill();
  x.fillStyle = dk(capC, 0.75); x.beginPath(); x.ellipse(66, 45, 31, 6, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = lum(capC) > 0.6 ? '#1b1b1f' : '#ffffff'; x.font = `${t.city.length > 2 ? 11 : 14}px ${FONT_DISP}`; x.fillText(t.city, 64, 33, 34);
  // 눈썹·눈·코·입
  x.fillStyle = hair; const bt = lk.v & 1 ? 3.5 : 2.5;
  x.fillRect(50, 53, 11, bt); x.fillRect(67, 53, 11, bt);
  x.fillStyle = '#1d1712'; x.beginPath(); x.ellipse(56, 61, 2.6, 2.8, 0, 0, Math.PI * 2); x.ellipse(72, 61, 2.6, 2.8, 0, 0, Math.PI * 2); x.fill();
  x.fillStyle = dk(skin, 0.8); x.beginPath(); x.moveTo(64, 63); x.lineTo(60, 72); x.lineTo(66, 72); x.fill();
  x.strokeStyle = dk(skin, 0.55); x.lineWidth = 2; x.beginPath(); x.moveTo(58, 79); x.quadraticCurveTo(64, 82, 70, 79); x.stroke();
  if (lk.v & 2) { x.fillStyle = hexA(hair, 0.55); x.beginPath(); x.ellipse(64, 82, 17, 10, 0, 0, Math.PI); x.fill(); x.fillRect(47, 78, 34, 4); }
  url = c.toDataURL('image/png'); _genFace.set(key, url);
  return url;
}
// 동그란 얼굴 사진 HTML. cls: xs(HUD) / sm(명단) / md(카드) / lg
function avatarHTML(pl, cls = '') {
  if (!pl) return '';
  const my = myPhoto(pl);
  if (my) return `<span class="ava ${cls}"><img src="${my}" alt="" style="width:100%;left:0;top:0"></span>`;
  const r = pl.ph;
  if (r) {
    const [fx, fy, z] = r.f || [0.5, 0.3, 1.5], ar = r.h / r.w;
    const w = Math.max(z * 100, 100, 100 / ar), h = w * ar;
    const l = clamp(50 - fx * w, 100 - w, 0), tp = clamp(50 - fy * h, 100 - h, 0);
    return `<span class="ava ph ${cls}" title="사진: ${esc(r.a)} · ${esc(r.l)} (Wikimedia Commons)"><img src="${esc(r.u)}" alt="" loading="lazy" referrerpolicy="no-referrer" style="width:${w.toFixed(1)}%;left:${l.toFixed(1)}%;top:${tp.toFixed(1)}%" data-fb="${genFace(pl)}" onerror="this.onerror=null;this.src=this.dataset.fb;this.style.cssText='width:100%;left:0;top:0'"></span>`;
  }
  return `<span class="ava gen ${cls}"><img src="${genFace(pl)}" alt="" style="width:100%;left:0;top:0"></span>`;
}
function photoCredit(pl) {
  if (!pl || myPhoto(pl) || !pl.ph) return '';
  const r = pl.ph;
  return `사진: <a href="${esc(r.s)}" target="_blank" rel="noopener">${esc(r.a)}</a> · <a href="${esc(r.lu || r.s)}" target="_blank" rel="noopener">${esc(r.l)}</a>`;
}
// 사진 파일 → 가운데(위쪽 기준)를 정사각형으로 잘라 작게 저장
function fileToAvatar(file) {
  return new Promise((ok, bad) => {
    if (!file || !/^image\//.test(file.type)) return bad(new Error('이미지 파일만 돼요'));
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = Math.max(0, (img.height - s) * 0.2);
      const c = makeCanvas(160, 160); c.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, 160, 160);
      URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(u); bad(new Error('사진을 읽을 수 없어요')); };
    img.src = u;
  });
}
