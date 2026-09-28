// KBO 문자중계 공통 모듈 (tools/pitch_mix.js, tools/batter_tend.js가 같이 씀)
// 네이버 스포츠 문자중계에서 정규시즌 경기 목록과 경기별 "타석 → 공" 요약을 가져오고 tools/.cache/relay2에 저장한다.
//   타석: { b: 타자 ID, bs: 타석(R/L), res: 결과 글("중견수 플라이 아웃" 등), p: [공, ...] }
//   공:   [투수 ID, 구종 이름, 구속, 가로무브(인치, 포수 기준 +오른쪽), 세로무브(인치), 릴리스x(ft), 릴리스높이(ft),
//          홈 통과 x(ft, 포수 기준 +오른쪽), 홈 통과 높이(ft), 존 위(ft), 존 아래(ft), 결과(B 볼·T 루킹·S 헛스윙·F 파울·H 인플레이)]
'use strict';
const fs = require('fs');
const path = require('path');
const H = { 'User-Agent': 'Mozilla/5.0 (fullcount3d fan game; relay stats)', Referer: 'https://m.sports.naver.com/' };
const CACHE = path.join(__dirname, '.cache', 'relay2');
const OPENING = '2026-03-28', LAST = '2026-09-27'; // 정규시즌 (시범경기 제외)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function J(u) {
  for (let t = 0; t < 4; t++) {
    try { const r = await fetch(u, { headers: H }); if (r.ok) return await r.json(); } catch (e) { /* 재시도 */ }
    await sleep(800 * (t + 1));
  }
  throw new Error('요청 실패: ' + u);
}
const day = (d) => d.toISOString().slice(0, 10);
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
// PITCHf/x식 무브먼트(인치): 홈 40피트 앞 ~ 홈플레이트 사이에서 회전 때문에 휜 거리 (중력은 뺌)
function pfx(q) {
  const { vy0, ay, ax, az } = q, y0 = Number.isFinite(q.y0) ? q.y0 : 50;
  if (![vy0, ay, ax, az].every(Number.isFinite) || vy0 >= 0 || ay <= 0) return null;
  const tAt = (y) => { const d = vy0 * vy0 - 2 * ay * (y0 - y); return d < 0 ? NaN : (-vy0 - Math.sqrt(d)) / ay; };
  const t40 = tAt(40), tp = tAt(17 / 12);
  if (!(tp > t40)) return null;
  const dt2 = (tp - t40) ** 2;
  return { x: 0.5 * ax * dt2 * 12, z: 0.5 * (az + 32.174) * dt2 * 12 };
}
// 홈플레이트 앞(y = 17/12ft)을 지날 때 위치 (ft) — 궤적으로 계산.
// ※ 문자중계의 crossPlateY는 모든 공이 0.7083으로 같은 값이라 못 씀 (계산한 높이로 루킹 스트라이크의 93%가 존 안, 볼은 3%만 존 안 — ABS 판정과 맞음)
function crossing(q) {
  const { vy0, ay, vx0, vz0, ax, az, x0, z0 } = q, y0 = Number.isFinite(q.y0) ? q.y0 : 50;
  if (![vy0, ay, vx0, vz0, ax, az, x0, z0].every(Number.isFinite) || vy0 >= 0) return null;
  const d = vy0 * vy0 - 2 * ay * (y0 - 17 / 12); if (d < 0) return null;
  const t = (-vy0 - Math.sqrt(d)) / ay;
  return { x: x0 + vx0 * t + 0.5 * ax * t * t, z: z0 + vz0 * t + 0.5 * az * t * t };
}
// 정규시즌 경기 목록 (최근 경기부터). 날짜별로 물어봄 — 한 번에 여러 날을 물으면 10경기에서 잘림
async function games() {
  fs.mkdirSync(CACHE, { recursive: true });
  const cf = path.join(CACHE, '_games_' + LAST + '.json');
  if (fs.existsSync(cf)) return JSON.parse(fs.readFileSync(cf, 'utf8'));
  const list = [];
  for (let d = new Date(LAST); day(d) >= OPENING; d.setDate(d.getDate() - 1)) {
    const g = await J(`https://api-gw.sports.naver.com/schedule/games?fields=basic&upperCategoryId=kbaseball&categoryId=kbo&fromDate=${day(d)}&toDate=${day(d)}`);
    (g.result.games || []).filter((x) => x.statusCode === 'RESULT' && !x.cancel).forEach((x) => list.push({ id: x.gameId, inn: +((x.statusInfo || '').match(/(\d+)회/) || [0, 9])[1] || 9 }));
    await sleep(60);
  }
  fs.writeFileSync(cf, JSON.stringify(list));
  return list;
}
async function gameData(g) {
  const cf = path.join(CACHE, g.id + '.json');
  if (fs.existsSync(cf)) return JSON.parse(fs.readFileSync(cf, 'utf8'));
  const pa = [];
  for (let inn = 1; inn <= Math.max(9, g.inn); inn++) {
    const j = await J(`https://api-gw.sports.naver.com/schedule/games/${g.id}/relay?inning=${inn}`);
    const rel = (j.result && j.result.textRelayData && j.result.textRelayData.textRelays) || [];
    const pts = {};
    rel.forEach((r) => (r.ptsOptions || []).forEach((q) => (pts[q.pitchId] = q)));
    for (const r of rel) {
      let b = null, bs = null, res = null;
      const ps = [];
      for (const o of r.textOptions || []) {
        const gs = o.currentGameState;
        if (o.type === 1 && o.pitchResult && gs) {
          const q = o.ptsPitchId && pts[o.ptsPitchId], m = q && pfx(q), cr = q && crossing(q);
          b = b || String(gs.batter || '');
          if (q && q.stance) bs = q.stance;
          ps.push([String(gs.pitcher || ''), o.stuff || '', +o.speed || 0, m ? r1(m.x) : null, m ? r1(m.z) : null,
            m ? r2(q.x0) : null, m ? r2(q.z0) : null, cr ? r2(cr.x) : null, cr ? r2(cr.z) : null,
            q ? r2(q.topSz) : null, q ? r2(q.bottomSz) : null, o.pitchResult]);
        } else if (o.type === 13 || o.type === 23) { // 타석 결과 (23 = 주자가 있거나 점수가 난 타석)
          res = String(o.text || '').split(' : ').slice(1).join(' : ') || o.text;
          if (!b && gs && gs.batter) b = String(gs.batter);
        }
      }
      if (ps.length || res) pa.push({ b, bs, res, p: ps });
    }
  }
  const data = { pa };
  fs.writeFileSync(cf, JSON.stringify(data));
  return data;
}
module.exports = { games, gameData, sleep, OPENING, LAST };
