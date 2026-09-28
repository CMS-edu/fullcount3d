// KBO 공식 홈페이지 선수 사진 연결 → src/g4_kbo.js
//   node tools/kbo_photos.js
// 사진 파일은 받지 않고 선수 ID만 모은다. 게임은 KBO 사이트의 사진 주소를 그대로 불러와서 보여줌 (저장소에 사진 없음).
// 맞추는 방법: 선수 검색(이름) → 현역 + 같은 팀 → 등번호 → 투수/야수 순으로 좁힘 (동명이인 방지)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const UA = 'Mozilla/5.0 (fullcount3d fan game; roster photo matcher)';
const CITY = ['LG', '한화', 'SSG', '삼성', 'NC', 'KT', '롯데', 'KIA', '두산', '키움']; // 게임 팀 순서 = KBO 사이트 팀명
const YEAR = 2026;
// 자동으로 못 찾는 선수 (직접 확인함): KBO 사이트 표기가 다른 외국인 선수, 같은 팀 동명이인
const MANUAL = {
  '1|박준영': 52731, // 한화 #96 — 2026 71⅓이닝 ERA 6.06 (게임 데이터와 일치). #68 박준영과 구분
  '2|베네치아노': 56841, // KBO 표기 '베니지아노'
  '5|앨런': 55912, // KBO 표기 '로건' #43
  '5|부쉴리': 56036, // KBO 표기 '보쉴리'
  '9|카나쿠보': 56348, // KBO 표기 '유토' #48
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function search(name) {
  const u = 'https://www.koreabaseball.com/Player/Search.aspx?searchWord=' + encodeURIComponent(name);
  for (let tries = 0; tries < 3; tries++) {
    try {
      const t = await (await fetch(u, { headers: { 'User-Agent': UA } })).text();
      const body = (t.split('<tbody>')[1] || '').split('</tbody>')[0];
      return [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => {
        const td = [...m[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((x) => x[1].trim());
        const a = (td[1] || '').match(/href='([^']+playerId=(\d+))'>([^<]+)</);
        return a && { num: td[0], name: a[3].trim(), id: a[2], retired: /Retire/.test(a[1]), pitcherPage: /Pitcher/.test(a[1]), team: td[2], pos: td[3], born: td[4] };
      }).filter(Boolean);
    } catch (e) { await sleep(1500); }
  }
  throw new Error('검색 실패: ' + name);
}
async function exists(id) {
  const r = await fetch(`https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/person/middle/${YEAR}/${id}.jpg`, { method: 'HEAD', headers: { 'User-Agent': UA } });
  return r.ok;
}

(async () => {
  const REAL = new Function(fs.readFileSync(path.join(ROOT, 'src/g4_data.js'), 'utf8') + '; return REAL;')();
  const out = {}, miss = [], cache = {};
  for (let ti = 0; ti < REAL.length; ti++) {
    const t = REAL[ti];
    for (const k of ['lineup', 'bench', 'rotation', 'bullpen']) {
      for (const pl of t[k] || []) {
        const key = ti + '|' + pl.n, isP = k === 'rotation' || k === 'bullpen';
        if (out[key]) continue;
        if (MANUAL[key]) { if (await exists(MANUAL[key])) out[key] = MANUAL[key]; else miss.push(`${key} 사진 없음 (id ${MANUAL[key]})`); continue; }
        if (!cache[pl.n]) { cache[pl.n] = await search(pl.n); await sleep(250); }
        let c = cache[pl.n].filter((r) => !r.retired && r.name === pl.n && r.team === CITY[ti]);
        if (c.length > 1) { const byNum = c.filter((r) => r.num === String(pl.num)); if (byNum.length) c = byNum; }
        if (c.length > 1) { const byPos = c.filter((r) => (r.pos === '투수') === isP); if (byPos.length) c = byPos; }
        if (c.length !== 1) { miss.push(`${key} #${pl.num} (${c.length ? '후보 여럿' : '같은 팀 현역 없음'}) 검색결과: ${cache[pl.n].map((r) => `${r.team}#${r.num}${r.retired ? '(은퇴)' : ''}`).join(', ')}`); continue; }
        if (!(await exists(c[0].id))) { miss.push(`${key} 사진 없음 (id ${c[0].id})`); continue; }
        out[key] = +c[0].id;
      }
    }
    console.log(CITY[ti], Object.keys(out).filter((x) => x.startsWith(ti + '|')).length + '명');
  }
  const js = `/* ===================== KBO 공식 선수 사진 연결 (tools/kbo_photos.js가 생성 — 직접 고치지 말 것) =====================
   값 = KBO 선수 ID. 사진은 KBO 홈페이지 주소에서 바로 불러옴 (저장소에 사진 파일 없음). ${YEAR}시즌 사진 · 생성 ${new Date().toISOString().slice(0, 10)} · ${Object.keys(out).length}명 */
const KBO_PHOTO_YEAR = ${YEAR};
const KBO_PH = ${JSON.stringify(out).replace(/,"/g, ',\n  "')};
`;
  fs.writeFileSync(path.join(ROOT, 'src/g4_kbo.js'), js);
  console.log('wrote src/g4_kbo.js', Object.keys(out).length, '명');
  if (miss.length) console.log('못 찾은 선수:\n  ' + miss.join('\n  '));
})().catch((e) => { console.error(e); process.exit(1); });
