// 투수 구종 조사 → src/g4_pitchmix.js
//   node tools/pitch_mix.js
// 네이버 스포츠 문자중계에 기록된 공 하나하나의 구종·구속을 모아서 투수별 구종 비율과 구종별 평균 구속을 계산한다.
// 투수는 KBO 선수 ID(src/g4_kbo.js)로 맞춤 — 문자중계의 투수 번호와 같은 번호.
// 최근 경기부터 거꾸로 훑고, 모든 투수가 충분히(TARGET구) 모이면 멈춤.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
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

(async () => {
  const load = (f, name) => new Function(fs.readFileSync(path.join(ROOT, f), 'utf8') + '; return ' + name + ';')();
  const REAL = load('src/g4_data.js', 'REAL'), KBO_PH = load('src/g4_kbo.js', 'KBO_PH');
  const want = {}; // KBO ID → 이름
  REAL.forEach((t, ti) => ['rotation', 'bullpen'].forEach((k) => (t[k] || []).forEach((p) => { const id = KBO_PH[ti + '|' + p.n]; if (id) want[id] = ti + '|' + p.n; })));
  console.log('투수', Object.keys(want).length, '명');

  // 1) 날짜별 경기 목록 (한 번에 여러 날을 물으면 10경기에서 잘림)
  const games = [];
  for (let d = new Date(LAST); day(d) >= OPENING; d.setDate(d.getDate() - 1)) {
    const g = await J(`https://api-gw.sports.naver.com/schedule/games?fields=basic&upperCategoryId=kbaseball&categoryId=kbo&fromDate=${day(d)}&toDate=${day(d)}`);
    (g.result.games || []).filter((x) => x.statusCode === 'RESULT' && !x.cancel).forEach((x) => games.push({ id: x.gameId, inn: +((x.statusInfo || '').match(/(\d+)회/) || [0, 9])[1] || 9 }));
    await sleep(60);
  }
  console.log('정규시즌 경기', games.length);

  // 2) 최근 경기부터 이닝별 문자중계 모으기
  const acc = {}; // id → { n, c: {type: count}, s: {type: [sum, cnt]} }
  const done = () => Object.keys(want).every((id) => acc[id] && acc[id].n >= TARGET);
  let scanned = 0, raw = {};
  async function doGame(g) {
    for (let inn = 1; inn <= Math.max(9, g.inn); inn++) {
      const j = await J(`https://api-gw.sports.naver.com/schedule/games/${g.id}/relay?inning=${inn}`);
      const rel = (j.result && j.result.textRelayData && j.result.textRelayData.textRelays) || [];
      for (const r of rel) for (const o of r.textOptions || []) {
        if (!o.stuff || !o.currentGameState) continue;
        const id = String(o.currentGameState.pitcher || ''); raw[o.stuff] = (raw[o.stuff] || 0) + 1;
        if (!want[id]) continue;
        const ty = STUFF[o.stuff]; if (!ty) continue;
        const a = acc[id] || (acc[id] = { n: 0, c: {}, s: {} });
        a.n++; a.c[ty] = (a.c[ty] || 0) + 1;
        const v = +o.speed; if (v > 60 && v < 170) { const s = a.s[ty] || (a.s[ty] = [0, 0]); s[0] += v; s[1]++; }
      }
    }
  }
  for (let i = 0; i < games.length && scanned < MAX_GAMES && !done(); i += 4) {
    await Promise.all(games.slice(i, i + 4).map(doGame));
    scanned += Math.min(4, games.length - i);
    if (scanned % 40 === 0) console.log(`${scanned}경기 · 충분히 모인 투수 ${Object.keys(want).filter((id) => acc[id] && acc[id].n >= TARGET).length}/${Object.keys(want).length}`);
  }
  console.log('훑은 경기', scanned, '· 문자중계 구종 이름:', JSON.stringify(raw));

  // 3) 투수별 구종 비율 (3% 미만은 빼고 다시 합이 1이 되게) + 평균 구속
  const out = {}, few = [];
  for (const id of Object.keys(want)) {
    const a = acc[id];
    if (!a || a.n < MIN_PITCHES) { few.push(`${want[id]}(${a ? a.n : 0}구)`); continue; }
    let m = Object.entries(a.c).map(([ty, c]) => [ty, c / a.n, a.s[ty] ? a.s[ty][0] / a.s[ty][1] : 0]).sort((x, y) => y[1] - x[1]);
    m = m.filter((x, i) => i < 2 || x[1] >= 0.03).slice(0, 6);
    const tot = m.reduce((s, x) => s + x[1], 0);
    out[id] = [a.n, m.map(([ty, sh, sp]) => [ty, Math.round((sh / tot) * 1000) / 1000, Math.round(sp * 10) / 10])];
  }
  const js = `/* ===================== 투수 구종 (tools/pitch_mix.js가 생성 — 직접 고치지 말 것) =====================
   네이버 스포츠 문자중계의 투구 기록(${OPENING}~${LAST} 정규시즌, 최근 경기부터 ${scanned}경기)을 투수별로 집계.
   키: KBO 선수 ID → [집계한 공 수, [[구종, 구사율, 평균 구속 km/h], ...]]  구종: FB 직구 TS 투심 CT 커터 SL 슬라이더 ST 스위퍼 CB 커브 CH 체인지업 FK 포크 */
const PITCH_MIX = ${JSON.stringify(out).replace(/\],"/g, '],\n  "')};
`;
  fs.writeFileSync(path.join(ROOT, 'src/g4_pitchmix.js'), js);
  console.log('wrote src/g4_pitchmix.js', Object.keys(out).length, '명');
  if (few.length) console.log('기록이 부족해서 기존 추정 구종을 쓰는 투수:', few.join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
