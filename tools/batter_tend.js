// 타자 성향 조사 → src/g4_battend.js
//   node tools/batter_tend.js   (정규시즌 전체 문자중계를 훑음 — 처음엔 몇 분, tools/.cache가 있으면 금방)
// 타자마다: 코스별(존 안 3×3 + 존 밖 위·아래·몸쪽·바깥쪽) 스윙률·헛스윙률·타율, 당겨치기/밀어치기 비율, 땅볼 비율.
// 표본이 적은 칸은 리그 평균(과 그 타자의 전체 타율) 쪽으로 당겨서 튀지 않게 함.
'use strict';
const fs = require('fs');
const path = require('path');
const { games, gameData, OPENING, LAST } = require('./relay');
const ROOT = path.join(__dirname, '..');
const BALL = 0.12, PLATE = 17 / 24 + BALL; // ft: 홈플레이트 반폭 + 공 반지름

// 칸: 0~8 존 안 3×3 (위→아래 줄, 몸쪽→바깥쪽 칸), 9 위 · 10 아래 · 11 몸쪽 · 12 바깥쪽 (존 밖)
function cell(px, pz, top, bot, stance) {
  if (px == null || pz == null || top == null || bot == null) return -1;
  const xi = stance === 'L' ? px : -px; // + = 몸쪽 (포수가 볼 때 우타자는 왼쪽에 섬)
  const t = top + BALL, b = bot - BALL;
  if (Math.abs(px) <= PLATE && pz >= b && pz <= t) {
    const col = xi > PLATE / 3 ? 0 : xi < -PLATE / 3 ? 2 : 1;
    const row = pz > b + ((t - b) * 2) / 3 ? 0 : pz < b + (t - b) / 3 ? 2 : 1;
    return row * 3 + col;
  }
  const dx = Math.abs(px) - PLATE, du = pz - t, dd = b - pz, m = Math.max(dx, du, dd);
  return m === du ? 9 : m === dd ? 10 : xi > 0 ? 11 : 12;
}
// 타석 결과 글 해석
function outcome(res) {
  if (!res || /(타격방해|주루방해)/.test(res)) return null;
  if (/삼진/.test(res)) return 'K';
  if (/(볼넷|몸에 맞는|고의4구|고의 4구)/.test(res)) return 'BB';
  if (/희생/.test(res)) return 'SAC';
  if (/(1루타|2루타|3루타|홈런|안타)/.test(res)) return 'H';
  if (/(아웃|실책|야수선택|병살|땅볼|플라이|직선타|라인드라이브)/.test(res)) return 'O';
  return null;
}
function direction(res) {
  if (/(파울|번트)/.test(res)) return null;
  if (/(좌익수|좌중간|좌측|좌월|좌중월|3루수|유격수)/.test(res)) return 'L';
  if (/(우익수|우중간|우측|우월|우중월|1루수|2루수)/.test(res)) return 'R';
  if (/(중견수|중월|중전|투수|포수)/.test(res)) return 'C';
  return null;
}
function ballType(res) {
  if (/번트/.test(res)) return null;
  if (/(땅볼|병살|내야안타)/.test(res)) return 'GB';
  if (/(라인드라이브|직선타)/.test(res)) return 'LD';
  if (/(플라이|홈런|뜬공)/.test(res)) return 'FB';
  return null;
}
const r3 = (v) => Math.round(v * 1000) / 1000;

(async () => {
  const load = (f, name) => new Function(fs.readFileSync(path.join(ROOT, f), 'utf8') + '; return ' + name + ';')();
  const REAL = load('src/g4_data.js', 'REAL'), KBO_PH = load('src/g4_kbo.js', 'KBO_PH');
  const want = {}, hand = {};
  REAL.forEach((t, ti) => ['lineup', 'bench'].forEach((k) => (t[k] || []).forEach((p) => { const id = KBO_PH[ti + '|' + p.n]; if (id) { want[id] = ti + '|' + p.n; hand[id] = p.b; } })));
  console.log('타자', Object.keys(want).length, '명');
  const list = await games();
  console.log('정규시즌 경기', list.length);

  const mk = () => ({ pa: 0, ab: 0, h: 0, sp: { P: 0, C: 0, O: 0 }, bt: { GB: 0, LD: 0, FB: 0 }, c: Array.from({ length: 13 }, () => ({ n: 0, sw: 0, wh: 0, ab: 0, h: 0 })) });
  const acc = {}, lg = mk();
  let done = 0;
  for (let i = 0; i < list.length; i += 4) {
    const batch = await Promise.all(list.slice(i, i + 4).map(gameData));
    for (const g of batch) for (const pa of g.pa) {
      const id = pa.b; if (!id) continue;
      const st = pa.bs || (hand[id] === 'L' ? 'L' : 'R');
      const A = want[id] ? (acc[id] || (acc[id] = mk())) : null;
      const both = (f) => { f(lg); if (A) f(A); };
      for (const q of pa.p) {
        const c = cell(q[7], q[8], q[9], q[10], st); if (c < 0) continue;
        const r = q[11];
        both((X) => { const C = X.c[c]; C.n++; if (r === 'F' || r === 'S' || r === 'H') C.sw++; if (r === 'S') C.wh++; });
      }
      const o = outcome(pa.res); if (!o) continue;
      both((X) => X.pa++);
      const last = pa.p[pa.p.length - 1], lc = last ? cell(last[7], last[8], last[9], last[10], st) : -1;
      if (o === 'H' || o === 'O' || o === 'K') {
        both((X) => { X.ab++; if (o === 'H') X.h++; if (lc >= 0) { X.c[lc].ab++; if (o === 'H') X.c[lc].h++; } });
      }
      if (o === 'H' || o === 'O') {
        const d = direction(pa.res), bt = ballType(pa.res);
        if (d) { const pull = st === 'L' ? 'R' : 'L', k = d === 'C' ? 'C' : d === pull ? 'P' : 'O'; both((X) => X.sp[k]++); }
        if (bt) both((X) => X.bt[bt]++);
      }
    }
    done += batch.length;
    if (done % 60 === 0 || done === list.length) console.log(`${done}/${list.length}경기`);
  }

  // 리그 평균
  const lgAvg = lg.h / lg.ab, spN = lg.sp.P + lg.sp.C + lg.sp.O, btN = lg.bt.GB + lg.bt.LD + lg.bt.FB;
  const LG = {
    avg: r3(lgAvg), pull: r3(lg.sp.P / spN), oppo: r3(lg.sp.O / spN), gb: r3(lg.bt.GB / btN),
    cells: lg.c.map((C) => [r3(C.sw / C.n), r3(C.wh / C.sw), r3(C.h / Math.max(1, C.ab))]),
  };
  // 타자별 (표본 적으면 평균 쪽으로)
  const out = {}, few = [];
  for (const id of Object.keys(want)) {
    const A = acc[id];
    if (!A || A.pa < 30) { few.push(`${want[id]}(${A ? A.pa : 0}타석)`); continue; }
    const sn = A.sp.P + A.sp.C + A.sp.O, k = 20;
    const pull = (A.sp.P + k * LG.pull) / (sn + k), oppo = (A.sp.O + k * LG.oppo) / (sn + k);
    const bn = A.bt.GB + A.bt.LD + A.bt.FB, gb = (A.bt.GB + k * LG.gb) / (bn + k);
    const myAvg = (A.h + 30 * LG.avg) / (A.ab + 30);
    const cells = A.c.map((C, i) => {
      const L = LG.cells[i], prior = L[2] * (myAvg / LG.avg);
      return [r3((C.sw + 30 * L[0]) / (C.n + 30)), r3((C.wh + 20 * L[1]) / (C.sw + 20)), r3((C.h + 15 * prior) / (C.ab + 15))];
    });
    out[id] = [A.pa, [r3(pull), r3(1 - pull - oppo), r3(oppo)], r3(gb), cells];
  }
  const js = `/* ===================== 타자 성향 (tools/batter_tend.js가 생성 — 직접 고치지 말 것) =====================
   네이버 스포츠 문자중계의 투구 위치·결과와 타석 결과(${OPENING}~${LAST} 정규시즌 ${list.length}경기)를 타자별로 집계.
   BAT_TEND: KBO 선수 ID → [타석 수, [당겨친 비율, 가운데, 밀어친 비율], 땅볼 비율, 칸 13개 [스윙률, 헛스윙률(스윙 중), 타율]]
   칸: 0~8 존 안 3×3 (위→아래 줄, 몸쪽→바깥쪽 칸), 9 존 위 · 10 존 아래 · 11 몸쪽 밖 · 12 바깥쪽 밖
   BAT_LG: 리그 평균 (같은 모양) */
const BAT_LG = ${JSON.stringify(LG)};
const BAT_TEND = ${JSON.stringify(out).replace(/\]\]\],"/g, ']]],\n  "')};
`;
  fs.writeFileSync(path.join(ROOT, 'src/g4_battend.js'), js);
  console.log('wrote src/g4_battend.js', Object.keys(out).length, '명 · 리그', JSON.stringify({ avg: LG.avg, pull: LG.pull, oppo: LG.oppo, gb: LG.gb }));
  if (few.length) console.log('기록이 부족한 타자:', few.join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
