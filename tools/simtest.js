// 실제 데이터 능력치로 CPU vs CPU 9이닝 시뮬 (sim.js 로직) → 득점/타율 분포 확인
const fs = require('fs');
const S = require('../sim.js');
const clamp = S.clamp;
const flow = fs.readFileSync(__dirname + '/../src/g5_flow.js', 'utf8');
const a = flow.indexOf('const POS_SPD'), b = flow.indexOf('const LEAGUE = REAL.map');
const code = fs.readFileSync(__dirname + '/../src/g4_data.js', 'utf8') + '\nconst POS_K={C:"포수","1B":"1루수","2B":"2루수","3B":"3루수",SS:"유격수",LF:"좌익수",CF:"중견수",RF:"우익수",DH:"지명"};\n' + flow.slice(a, b) + '\nmodule.exports={REAL,rateHitter,ratePitcher,fieldAt};';
const M = {}; new Function('module', 'clamp', code)(M, clamp);
const { REAL, rateHitter, ratePitcher, fieldAt } = M.exports;
const L = REAL.map((t) => ({ lineup: t.lineup.map(rateHitter), rotation: t.rotation.map(ratePitcher), bullpen: t.bullpen.map(ratePitcher) }));
if (process.argv[2] === 'ratings') {
  const TN = ['LG', 'HH', 'SSG', 'SS', 'NC', 'KT', 'LT', 'KIA', 'OB', 'KW'];
  L.forEach((t, i) => { console.log(TN[i], t.lineup.map((p) => `${p.name}${p.con}/${p.pow}/${p.eye}/${p.spd} 수${p.fld}어${p.arm}`).join(' ')); console.log('   ', t.rotation.concat(t.bullpen).map((p) => `${p.name}${p.vel}/${p.ctl}/${p.stf}`).join(' ')); });
  process.exit(0);
}
const D = { ts: 0.78, win: 1, pci: 1, cpuCon: 0, cpuPow: 0, meter: 1 };
// 수비 팀 선수들의 주력·수비·어깨 (게임의 defOf와 같음). NOFLD=1 이면 예전처럼 모두 보통 수비
const POS_IDX = { C: 1, '1B': 2, '2B': 3, '3B': 4, SS: 5, LF: 6, CF: 7, RF: 8 };
function defs(ft) {
  if (process.env.NOFLD) return null;
  const a = [{ spd: 50, fld: 55, arm: 60 }];
  ft.lineup.forEach((b) => { if (POS_IDX[b.pos]) a[POS_IDX[b.pos]] = Object.assign({ spd: b.spd }, fieldAt(b, b.pos)); });
  return a;
}
function half(bt, p, st, meter, ft) {
  let outs = 0, B = [null, null, null], runs = 0; const F = S.makeFielders(defs(ft));
  while (outs < 3) {
    const b = bt.lineup[st.o]; st.o = (st.o + 1) % 9; st.pa++;
    let bb = 0, s = 0, done = false;
    while (!done) {
      const z = S.zoneOf(b.height), fat = S.fatigueOf(p, st.pc), plan = S.cpuPitchPlan(p, { b: bb, s }, z);
      const sig = S.pitchSigma(p, fat, meter), tg = { x: plan.target.x + S.randn() * sig, y: plan.target.y + S.randn() * sig };
      const kmh = S.pitchSpeed(p, plan.type, fat, meter), q = S.pitchQuality(p, fat, meter), P = S.makePitch(p, plan.type, tg, kmh); st.pc++;
      const zi = S.zoneInfo(z, tg.x, tg.y), c = S.cpuSwing(b, P, zi, { b: bb, s }, D, p.hand, q);
      if (!c.swing) { if (zi.inside) s++; else bb++; }
      else if (!c.contact) s++;
      else {
        const tr = S.flyBall({ x: tg.x, y: tg.y, z: 0 }, c.ev, c.la, c.phi);
        if (tr.foul) { const r = S.resolvePlay(tr, { bases: B, outs, batter: b, fielders: F }); if (r.kind === 'FOUL_OUT') { outs++; st.ab++; done = true; } else if (s < 2) s++; continue; }
        const r = S.resolvePlay(tr, { bases: B.slice(), outs, batter: b, fielders: F }); st.ab++;
        if (['1B', '2B', '3B', 'HR', 'IFH', 'BUNT_HIT'].includes(r.kind)) st.h++; if (r.kind === 'HR') st.hr++; if (r.kind === 'E') st.e++;
        outs += r.outs; runs += r.runs; B = r.bases.slice(); done = true; continue;
      }
      if (s >= 3) { st.k++; st.ab++; outs++; done = true; }
      else if (bb >= 4) { st.bb++; if (B[0] && B[1] && B[2]) runs++; B = [b, B[0] || null, B[0] ? B[1] : B[1]]; if (!B[1] && !B[2]) {} done = true; }
    }
  }
  return runs;
}
const N = +process.argv[2] || 300; let R = 0; const st = { pa: 0, ab: 0, h: 0, hr: 0, k: 0, bb: 0, e: 0 };
const per = Array(10).fill(0);
for (let g = 0; g < N; g++) {
  const bi = g % 10, pi = (g * 3 + 1) % 10; if (bi === pi) continue;
  const bt = L[bi], p = L[pi].rotation[g % 5]; const s2 = Object.assign(st, { o: 0, pc: 0 });
  let r = 0; for (let i = 0; i < 9; i++) r += half(bt, i < 6 ? p : L[pi].bullpen[i % 6], s2, null, L[pi]);
  R += r; per[bi] += r;
}
console.log('R/G', (R / N).toFixed(2), 'AVG', (st.h / st.ab).toFixed(3), 'K%', (st.k / st.pa * 100).toFixed(1), 'BB%', (st.bb / st.pa * 100).toFixed(1), 'HR/G', (st.hr / N).toFixed(2), 'E/G', (st.e / N).toFixed(2));
console.log('team R/G', per.map((x) => (x / (N / 10)).toFixed(1)).join(' '));
