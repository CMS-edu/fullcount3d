// 투수 구종·공 움직임 조사 → src/g4_pitchmix.js
//   node tools/pitch_mix.js
// 네이버 스포츠 문자중계에 기록된 공 하나하나(구종·구속 + 투구 추적 PTS 궤적)를 모아서 투수별로
//   구종 비율 · 구종별 평균 구속 · 구종별 무브먼트(휘는 정도·떨어지는 정도) · 릴리스 위치(팔 높이)를 계산한다.
// 투수는 KBO 선수 ID(src/g4_kbo.js)로 맞춤 — 문자중계의 투수 번호와 같은 번호.
// 최근 경기부터 거꾸로 훑고, 모든 투수가 충분히(TARGET구) 모이면 멈춤. 경기별 요약은 tools/.cache에 저장(다시 돌릴 때 빠름).
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const CACHE = path.join(__dirname, '.cache', 'relay');
const H = { 'User-Agent': 'Mozilla/5.0 (fullcount3d fan game; pitch mix)', Referer: 'https://m.sports.naver.com/' };
const OPENING = '2026-03-28', LAST = '2026-09-27'; // 정규시즌 (시범경기 제외)
const TARGET = 250, MAX_GAMES = 480, MIN_PITCHES = 40;
// 문자중계 구종 이름 → 게임 구종
const STUFF = {
  직구: 'FB', 투심: 'TS', 싱커: 'TS', 커터: 'CT', 슬라이더: 'SL', 슬러브: 'SL', 스위퍼: 'ST',
  커브: 'CB', 너클커브: 'CB', 체인지업: 'CH', 서클체인지업: 'CH', 포크: 'FK', 스플리터: 'FK',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function J(u) {
  for (let t = 0; t < 4; t++) {
    try { const r = await fetch(u, { headers: H }); if (r.ok) return await r.json(); } catch (e) { /* 재시도 */ }
    await sleep(800 * (t + 1));
  }
  throw new Error('요청 실패: ' + u);
}
const day = (d) => d.toISOString().slice(0, 10);
// PITCHf/x식 무브먼트(인치): 홈 40피트 앞 ~ 홈플레이트 사이에서 회전 때문에 생긴 휘어짐 (중력은 뺌)
function pfx(q) {
  const { vy0, ay, ax, az } = q, y0 = Number.isFinite(q.y0) ? q.y0 : 50;
  if (![vy0, ay, ax, az].every(Number.isFinite) || vy0 >= 0 || ay <= 0) return null;
  const tAt = (y) => { const d = vy0 * vy0 - 2 * ay * (y0 - y); return d < 0 ? NaN : (-vy0 - Math.sqrt(d)) / ay; };
  const t40 = tAt(40), tp = tAt(17 / 12);
  if (!(tp > t40)) return null;
  const dt2 = (tp - t40) ** 2;
  return { x: 0.5 * ax * dt2 * 12, z: 0.5 * (az + 32.174) * dt2 * 12 };
}
const r1 = (v) => Math.round(v * 10) / 10;

(async () => {
  const load = (f, name) => new Function(fs.readFileSync(path.join(ROOT, f), 'utf8') + '; return ' + name + ';')();
  const REAL = load('src/g4_data.js', 'REAL'), KBO_PH = load('src/g4_kbo.js', 'KBO_PH');
  const want = {}, hand = {}; // KBO ID → 이름, 투구 손
  REAL.forEach((t, ti) => ['rotation', 'bullpen'].forEach((k) => (t[k] || []).forEach((p) => { const id = KBO_PH[ti + '|' + p.n]; if (id) { want[id] = ti + '|' + p.n; hand[id] = p.t; } })));
  console.log('투수', Object.keys(want).length, '명');
  fs.mkdirSync(CACHE, { recursive: true });

  // 1) 날짜별 경기 목록 (한 번에 여러 날을 물으면 10경기에서 잘림)
  const games = [];
  for (let d = new Date(LAST); day(d) >= OPENING; d.setDate(d.getDate() - 1)) {
    const g = await J(`https://api-gw.sports.naver.com/schedule/games?fields=basic&upperCategoryId=kbaseball&categoryId=kbo&fromDate=${day(d)}&toDate=${day(d)}`);
    (g.result.games || []).filter((x) => x.statusCode === 'RESULT' && !x.cancel).forEach((x) => games.push({ id: x.gameId, inn: +((x.statusInfo || '').match(/(\d+)회/) || [0, 9])[1] || 9 }));
    await sleep(60);
  }
  console.log('정규시즌 경기', games.length);

  // 2) 경기별 공 목록: [투수ID, 구종이름, 구속, 가로무브(인치,포수 기준 +오른쪽), 세로무브(인치), 릴리스x(ft), 릴리스높이(ft)]
  async function gamePitches(g) {
    const cf = path.join(CACHE, g.id + '.json');
    if (fs.existsSync(cf)) return JSON.parse(fs.readFileSync(cf, 'utf8'));
    const list = [];
    for (let inn = 1; inn <= Math.max(9, g.inn); inn++) {
      const j = await J(`https://api-gw.sports.naver.com/schedule/games/${g.id}/relay?inning=${inn}`);
      const rel = (j.result && j.result.textRelayData && j.result.textRelayData.textRelays) || [];
      const pts = {};
      rel.forEach((r) => (r.ptsOptions || []).forEach((q) => (pts[q.pitchId] = q)));
      for (const r of rel) for (const o of r.textOptions || []) {
        if (!o.stuff || !o.currentGameState) continue;
        const q = o.ptsPitchId && pts[o.ptsPitchId], m = q && pfx(q);
        list.push([String(o.currentGameState.pitcher || ''), o.stuff, +o.speed || 0, m ? r1(m.x) : null, m ? r1(m.z) : null,
          m && Number.isFinite(q.x0) ? Math.round(q.x0 * 100) / 100 : null, m && Number.isFinite(q.z0) ? Math.round(q.z0 * 100) / 100 : null]);
      }
    }
    fs.writeFileSync(cf, JSON.stringify(list));
    return list;
  }

  // 3) 투수별 · 구종별로 모으기 (+ 리그 전체 구종별 평균 무브먼트)
  const acc = {}, lg = {}; // lg[구종] = [팔쪽 가로 합, 세로 합, 개수]
  const done = () => Object.keys(want).every((id) => acc[id] && acc[id].n >= TARGET);
  let scanned = 0; const raw = {};
  const add = (list) => list.forEach(([id, stuff, v, mx, mz, x0, z0]) => {
    raw[stuff] = (raw[stuff] || 0) + 1;
    const ty = STUFF[stuff]; if (!ty) return;
    // 가로 무브를 "팔 쪽 = +"로 맞춤 (우투수 팔 쪽은 포수 기준 왼쪽 = x 음수). 모르는 투수는 릴리스 위치로 판단
    const R = want[id] ? hand[id] !== 'L' : (x0 == null ? true : x0 < 0);
    if (mx != null) { const L = lg[ty] || (lg[ty] = [0, 0, 0]); L[0] += R ? -mx : mx; L[1] += mz; L[2]++; }
    if (!want[id]) return;
    const a = acc[id] || (acc[id] = { n: 0, c: {}, s: {}, m: {}, r: [0, 0, 0] });
    a.n++; a.c[ty] = (a.c[ty] || 0) + 1;
    if (v > 60 && v < 170) { const s = a.s[ty] || (a.s[ty] = [0, 0]); s[0] += v; s[1]++; }
    if (mx != null) { const m = a.m[ty] || (a.m[ty] = [0, 0, 0]); m[0] += R ? -mx : mx; m[1] += mz; m[2]++; }
    if (x0 != null && z0 != null) { a.r[0] += R ? -x0 : x0; a.r[1] += z0; a.r[2]++; }
  });
  for (let i = 0; i < games.length && scanned < MAX_GAMES && !done(); i += 4) {
    (await Promise.all(games.slice(i, i + 4).map(gamePitches))).forEach(add);
    scanned += Math.min(4, games.length - i);
    if (scanned % 40 === 0) console.log(`${scanned}경기 · 충분히 모인 투수 ${Object.keys(want).filter((id) => acc[id] && acc[id].n >= TARGET).length}/${Object.keys(want).length}`);
  }
  console.log('훑은 경기', scanned, '· 문자중계 구종 이름:', JSON.stringify(raw));

  // 4) 정리: 구종 비율(3% 미만은 빼고 합이 1이 되게) · 평균 구속 · 무브먼트(표본이 적으면 리그 평균 쪽으로 당김) · 릴리스
  const avg = {};
  for (const ty in lg) avg[ty] = [r1(lg[ty][0] / lg[ty][2]), r1(lg[ty][1] / lg[ty][2])];
  const out = {}, few = [];
  for (const id of Object.keys(want)) {
    const a = acc[id];
    if (!a || a.n < MIN_PITCHES) { few.push(`${want[id]}(${a ? a.n : 0}구)`); continue; }
    let m = Object.entries(a.c).map(([ty, c]) => [ty, c / a.n]).sort((x, y) => y[1] - x[1]);
    m = m.filter((x, i) => i < 2 || x[1] >= 0.03).slice(0, 6);
    const tot = m.reduce((s, x) => s + x[1], 0);
    const rows = m.map(([ty, sh]) => {
      const s = a.s[ty], mv = a.m[ty], L = avg[ty];
      let hb = null, vb = null;
      if (mv && L) { const w = mv[2] / (mv[2] + 15); hb = r1(L[0] + (mv[0] / mv[2] - L[0]) * w); vb = r1(L[1] + (mv[1] / mv[2] - L[1]) * w); }
      return [ty, Math.round((sh / tot) * 1000) / 1000, s ? r1(s[0] / s[1]) : 0, hb, vb];
    });
    out[id] = [a.n, rows, a.r[2] ? [Math.round((a.r[0] / a.r[2]) * 100) / 100, Math.round((a.r[1] / a.r[2]) * 100) / 100] : null];
  }
  const js = `/* ===================== 투수 구종 · 무브먼트 (tools/pitch_mix.js가 생성 — 직접 고치지 말 것) =====================
   네이버 스포츠 문자중계의 투구 기록과 투구 추적(PTS) 궤적 (${OPENING}~${LAST} 정규시즌, 최근 경기부터 ${scanned}경기)을 투수별로 집계.
   PITCH_MIX: KBO 선수 ID → [집계한 공 수, [[구종, 구사율, 평균 구속 km/h, 가로 무브(인치, 팔 쪽 +), 세로 무브(인치, 위 +)], ...], [릴리스 옆(ft, 팔 쪽 +), 릴리스 높이(ft)]]
   PITCH_MV_AVG: 리그 전체 구종별 평균 무브먼트 [가로, 세로] — 게임은 이 평균과의 차이만큼 공을 더/덜 휘게 함
   구종: FB 직구 TS 투심 CT 커터 SL 슬라이더 ST 스위퍼 CB 커브 CH 체인지업 FK 포크 */
const PITCH_MV_AVG = ${JSON.stringify(avg)};
const PITCH_MIX = ${JSON.stringify(out).replace(/\]\],"/g, ']],\n  "').replace(/\]\]\],"|\],null\],"/g, (s) => s.replace(',"', ',\n  "'))};
`;
  fs.writeFileSync(path.join(ROOT, 'src/g4_pitchmix.js'), js);
  console.log('wrote src/g4_pitchmix.js', Object.keys(out).length, '명 · 리그 평균 무브먼트', JSON.stringify(avg));
  if (few.length) console.log('기록이 부족해서 기존 추정 구종을 쓰는 투수:', few.join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
