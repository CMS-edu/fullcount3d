// 선수 사진 목록 만들기 → src/g4_photos.js
//   node tools/photos.js
// Wikimedia Commons에 올라온 "자유 이용 가능한" 사진만 쓴다 (Wikidata P18 이미지).
// 공식 구단·KBO 사진은 저작권이 있어서 쓰지 않음. 각 사진은 저작자·라이선스를 게임 안에 표시해야 함.
'use strict';
const fs = require('fs');
const path = require('path');
const UA = 'fullcount3d-fan-game/1.0 (build script; https://github.com/CMS-edu/fullcount3d)';
const ROOT = path.join(__dirname, '..');

// 게임 팀 순서(S.TEAMS)와 같은 순서의 Wikidata 구단 항목 (SSG는 SK 시절 포함)
const TEAM_Q = [['Q490377'], ['Q490046'], ['Q105636368', 'Q490639'], ['Q490418'], ['Q486862'], ['Q3023347'], ['Q495346'], ['Q490621'], ['Q487215'], ['Q490137']];
// Wikidata에 이적이 아직 반영 안 된 선수 (팀번호|이름 → Wikidata 항목). 같은 사람인지 직접 확인한 것만
const MANUAL = {
  '1|강백호': 'Q51191291', '2|김재환': 'Q6408840', '3|강민호': 'Q489727', '4|이우성': 'Q19161953', '5|김현수': 'Q77840', '5|허경민': 'Q5946296',
  '6|노진혁': 'Q12590463', '8|손아섭': 'Q7560570', '8|벤자민': 'Q98277927', '9|안치홍': 'Q624654', '9|알칸타라': 'Q7073967',
};
// 동명이인이라 절대 붙이면 안 되는 조합
const BLOCK = new Set(['6|박건우', '7|김태형']);
// 얼굴이 동그라미 안에 오도록 자르는 위치: [가로 %, 세로 %, 확대] (사진을 직접 보고 정함)
const FOCUS = require('./photo_focus.json');

const sparql = async (q) => {
  const r = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(q), { headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA } });
  if (!r.ok) throw new Error('SPARQL ' + r.status);
  return (await r.json()).results.bindings;
};
const commonsInfo = async (files, width) => {
  const out = {};
  for (let i = 0; i < files.length; i += 40) {
    const titles = files.slice(i, i + 40).map((f) => 'File:' + f).join('|');
    const u = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=' + width + '&titles=' + encodeURIComponent(titles);
    const j = await (await fetch(u, { headers: { 'User-Agent': UA } })).json();
    const norm = {}; (j.query.normalized || []).forEach((n) => (norm[n.to] = n.from));
    Object.values(j.query.pages).forEach((p) => {
      const ii = p.imageinfo && p.imageinfo[0]; if (!ii) return;
      const m = ii.extmetadata || {}, txt = (k) => (m[k] ? String(m[k].value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '');
      const key = (norm[p.title] || p.title).replace(/^File:/, '');
      out[key] = { u: ii.thumburl, w: ii.thumbwidth, h: ii.thumbheight, s: ii.descriptionurl, a: txt('Artist') || '작자 미상', l: txt('LicenseShortName'), lu: m.LicenseUrl ? m.LicenseUrl.value : '' };
    });
  }
  return out;
};

(async () => {
  const REAL = new Function(fs.readFileSync(path.join(ROOT, 'src/g4_data.js'), 'utf8') + '; return REAL;')();
  const vals = TEAM_Q.flat().map((q) => 'wd:' + q).join(' ');
  const rows = (await sparql(`SELECT ?p (SAMPLE(?ko) AS ?kol) (SAMPLE(?en) AS ?enl) (SAMPLE(?img) AS ?image) (GROUP_CONCAT(DISTINCT STRAFTER(STR(?team), "entity/"); separator=",") AS ?teams) WHERE {
    VALUES ?team { ${vals} } ?p wdt:P54 ?team . ?p wdt:P18 ?img .
    OPTIONAL { ?p rdfs:label ?ko FILTER(lang(?ko)="ko") } OPTIONAL { ?p rdfs:label ?en FILTER(lang(?en)="en") }
  } GROUP BY ?p`)).map((b) => ({ q: b.p.value.split('/').pop(), ko: b.kol && b.kol.value, en: b.enl && b.enl.value, file: decodeURIComponent(b.image.value.split('FilePath/')[1]), teams: b.teams.value.split(',') }));
  const byQ = Object.fromEntries(rows.map((r) => [r.q, r]));
  const norm = (s) => (s || '').replace(/[\s\-·()]/g, '').toLowerCase();
  const found = {};
  REAL.forEach((t, ti) => ['lineup', 'bench', 'rotation', 'bullpen'].forEach((k) => (t[k] || []).forEach((pl) => {
    const id = ti + '|' + pl.n;
    if (BLOCK.has(id) || found[id]) return;
    let pick = MANUAL[id] ? byQ[MANUAL[id]] : null;
    if (!pick) {
      // 이름(한글 또는 영문)이 같고, 그 사람이 이 팀에서 뛴 기록이 있어야 함 → 동명이인 방지
      const c = rows.filter((w) => (norm(w.ko) === norm(pl.n) || (pl.e && norm(w.en) === norm(pl.e))) && w.teams.some((q) => TEAM_Q[ti].includes(q)));
      if (c.length === 1) pick = c[0];
    }
    if (pick) found[id] = pick.file;
  })));
  // 얼굴이 작게 찍힌 사진은 크게 확대해야 하니 더 큰 썸네일 (Wikimedia 표준 크기 250/500/960)
  const widthOf = (id) => { const z = FOCUS[id] ? FOCUS[id][2] : 1; return z > 6 ? 960 : z > 3 ? 500 : 250; };
  const info = {};
  for (const w of [250, 500, 960]) {
    const files = [...new Set(Object.keys(found).filter((id) => widthOf(id) === w).map((id) => found[id]))];
    if (files.length) Object.assign(info, Object.fromEntries(Object.entries(await commonsInfo(files, w)).map(([k, v]) => [k + '@' + w, v])));
  }
  const db = {};
  Object.keys(found).sort().forEach((id) => {
    const m = info[found[id] + '@' + widthOf(id)]; if (!m || !m.u) { console.warn('정보 없음', id, found[id]); return; }
    if (!/^(CC|Public domain|PD)/i.test(m.l)) { console.warn('자유 라이선스 아님 → 제외', id, m.l); return; }
    m.u = m.u.replace(/\?utm_[^#]*$/, ''); // 추적용 쿼리 제거
    m.a = m.a.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''); // 저작자가 주소로만 적힌 경우 짧게
    db[id] = Object.assign({}, m, FOCUS[id] ? { f: FOCUS[id] } : {});
  });
  const out = `/* ===================== 선수 사진 (tools/photos.js가 생성 — 직접 고치지 말 것) =====================
   Wikimedia Commons의 자유 라이선스 사진만. 키: "팀번호|이름". u=썸네일, s=원본 페이지, a=저작자, l=라이선스, f=[얼굴 가로%, 세로%, 확대]
   생성: ${new Date().toISOString().slice(0, 10)} · ${Object.keys(db).length}명 */
const PHOTO_DB = ${JSON.stringify(db, null, 0).replace(/},"/g, '},\n  "')};
`;
  fs.writeFileSync(path.join(ROOT, 'src/g4_photos.js'), out);
  console.log('wrote src/g4_photos.js', Object.keys(db).length, 'photos');
})().catch((e) => { console.error(e); process.exit(1); });
