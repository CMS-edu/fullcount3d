/* =========================================================
   SIM — 순수 야구 로직 (렌더링과 분리, node에서 테스트 가능)
   좌표계: 홈플레이트 = 원점, x = 1루 방향(포수 시점 오른쪽),
           -z = 중견수 방향, y = 위. 단위 m, s, km/h
   ========================================================= */
(function (root) {
  'use strict';
  const D2R = Math.PI / 180;
  const BASE = 27.43, SQ = Math.SQRT1_2;
  const FENCE_H = 3.2, BALL_R = 0.037;
  const G = 9.81, DRAG = 0.0046, LIFT = 0.0011, DT = 1 / 120;

  let rnd = Math.random;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function setRng(f) { rnd = f; }
  function R() { return rnd(); }
  function randn() { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  /* ---------- 필드 기하 ---------- */
  function basePos(k) {
    k = ((k % 4) + 4) % 4;
    if (k === 0) return { x: 0, z: 0 };
    if (k === 1) return { x: BASE * SQ, z: -BASE * SQ };
    if (k === 2) return { x: 0, z: -2 * BASE * SQ };
    return { x: -BASE * SQ, z: -BASE * SQ };
  }
  function polar(phi, r) { return { x: r * Math.sin(phi * D2R), z: -r * Math.cos(phi * D2R) }; }
  function phiOf(x, z) { return Math.atan2(x, -z) / D2R; }
  // 좌우 99m, 중앙 122m 정도의 한국 구장 규격 느낌
  function fenceDist(phi) { const p = clamp(phi, -45, 45); return 99 + 23 * Math.cos(2 * p * D2R); }
  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  /* ---------- 구종 ---------- */
  // ratio: 최고구속 대비, arm: 팔 쪽 수평 무브(m), drop: 수직 낙차(m), arc: 포물선 높이
  const PITCHES = {
    FB: { name: '직구', ratio: 1.0, arm: 0.05, drop: -0.05, arc: 0.1, brk: false },
    TS: { name: '투심', ratio: 0.975, arm: 0.17, drop: 0.07, arc: 0.1, brk: false },
    CT: { name: '커터', ratio: 0.955, arm: -0.16, drop: 0.07, arc: 0.1, brk: false }, // 예전 -0.09/0.03은 직구와 거의 구별이 안 돼서 키움
    SL: { name: '슬라이더', ratio: 0.9, arm: -0.22, drop: 0.1, arc: 0.14, brk: true },
    ST: { name: '스위퍼', ratio: 0.89, arm: -0.36, drop: 0.06, arc: 0.15, brk: true },
    CB: { name: '커브', ratio: 0.8, arm: -0.14, drop: 0.36, arc: 0.34, brk: true },
    CH: { name: '체인지업', ratio: 0.87, arm: 0.13, drop: 0.24, arc: 0.16, brk: true },
    FK: { name: '포크', ratio: 0.9, arm: 0.02, drop: 0.38, arc: 0.14, brk: true },
  };

  /* ---------- 스트라이크 존 (키 비율 기반, ABS 스타일) ---------- */
  function zoneOf(height) { return { bot: height * 0.2764, top: height * 0.5635, half: 0.216 + BALL_R }; }
  function inZone(z, x, y) { return Math.abs(x) <= z.half && y >= z.bot - BALL_R && y <= z.top + BALL_R; }
  function zoneInfo(z, x, y) {
    const mid = (z.top + z.bot) / 2, hh = (z.top - z.bot) / 2 + BALL_R;
    const inside = inZone(z, x, y);
    const dx = Math.max(0, Math.abs(x) - z.half), dy = Math.max(0, Math.abs(y - mid) - hh);
    return { inside, out: Math.hypot(dx, dy), corner: Math.max(Math.abs(x) / z.half, Math.abs(y - mid) / hh), low: y < mid };
  }

  /* ---------- 투구 궤적 ---------- */
  function makePitch(pitcher, type, target, kmh) {
    const p = PITCHES[type];
    const armSign = pitcher.hand === 'R' ? -1 : 1;
    const rel = { x: 0.55 * armSign, y: 1.78, z: -16.9 };
    const mv = pitcher.mv && pitcher.mv[type]; // 투수마다 실제 무브먼트 [가로(팔 쪽 +), 떨어짐] (m)
    const bx = (mv ? mv[0] : p.arm) * armSign, by = -(mv ? mv[1] : p.drop);
    const dur = Math.abs(rel.z) / (kmh / 3.6);
    return { type, kmh, rel, target, bx, by, arc: p.arc * (145 / kmh), dur };
  }
  // u = t/dur (0=릴리스, 1=홈플레이트)
  function pitchPos(pt, u, out) {
    const { rel, target, bx, by, arc } = pt;
    out.x = rel.x + (target.x - bx - rel.x) * u + bx * u * u;
    out.y = rel.y + (target.y - by - rel.y) * u + by * u * u + arc * 4 * u * (1 - u);
    out.z = rel.z * (1 - u);
    return out;
  }

  /* ---------- 타구 물리 ---------- */
  function flyBall(start, evKmh, laDeg, phiDeg) {
    const v = evKmh / 3.6, h = v * Math.cos(laDeg * D2R);
    let x = start.x, y = start.y, z = start.z;
    let vx = h * Math.sin(phiDeg * D2R), vz = -h * Math.cos(phiDeg * D2R), vy = v * Math.sin(laDeg * D2R);
    const foul = Math.abs(phiDeg) > 45;
    const lift = LIFT * clamp(laDeg / 25, 0, 1); // 백스핀 양력
    const pts = [{ t: 0, x, y, z, air: true }];
    let t = 0, rolling = false, firstLand = null, hr = false, apex = y, wall = false, step = 0;
    let carry = null;
    while (t < 16) {
      if (!rolling) {
        const sp = Math.hypot(vx, vy, vz);
        vx += -DRAG * sp * vx * DT; vy += (-G - DRAG * sp * vy + (firstLand ? 0 : lift * sp * sp)) * DT; vz += -DRAG * sp * vz * DT;
        x += vx * DT; y += vy * DT; z += vz * DT;
        if (y > apex) apex = y;
        if (y <= BALL_R) {
          y = BALL_R;
          if (!firstLand) firstLand = { t, x, z };
          if (-vy < 1.3) { rolling = true; vy = 0; } else { vy = -vy * 0.36; vx *= 0.86; vz *= 0.86; }
        }
      } else {
        const hs = Math.hypot(vx, vz), dec = 2.6 * DT;
        if (hs <= dec) { vx = 0; vz = 0; } else { vx -= (vx / hs) * dec; vz -= (vz / hs) * dec; }
        x += vx * DT; z += vz * DT;
      }
      t += DT;
      if (!foul && !hr) {
        const r = Math.hypot(x, z), ph = phiOf(x, z);
        if (Math.abs(ph) <= 45.5 && r >= fenceDist(ph)) {
          if (!firstLand && y > FENCE_H) { hr = true; }
          else {
            const nx = x / r, nz = z / r, vr = vx * nx + vz * nz;
            if (vr > 0) { vx -= 1.35 * vr * nx; vz -= 1.35 * vr * nz; }
            const f = fenceDist(ph) - 0.1; x = nx * f; z = nz * f; wall = true;
          }
        }
      }
      if (hr) {
        // 관중석 표면(대략)에 닿으면 멈춤
        const r = Math.hypot(x, z), ph = phiOf(x, z);
        const standY = 3 + (r - fenceDist(ph)) * 0.55;
        if (y <= standY || t > 8) {
          if (!carry) carry = estimateCarry(start, evKmh, laDeg);
          if (++step % 2 === 0) pts.push({ t, x, y, z, air: true });
          break;
        }
      }
      if (++step % 2 === 0) pts.push({ t, x, y, z, air: !firstLand });
      if (rolling && vx === 0 && vz === 0) break;
      if (foul && (firstLand || t > 8)) break;
    }
    const last = pts[pts.length - 1];
    return {
      pts, hr, foul, firstLand, apex, wall, la: laDeg, phi: phiDeg, ev: evKmh,
      carry: carry || (firstLand ? Math.hypot(firstLand.x, firstLand.z) : Math.hypot(last.x, last.z)),
      restT: last.t, rest: { x: last.x, z: last.z },
    };
  }
  function estimateCarry(start, evKmh, laDeg) {
    const v = evKmh / 3.6, lift = LIFT * clamp(laDeg / 25, 0, 1); let x = 0, y = start.y, vx = v * Math.cos(laDeg * D2R), vy = v * Math.sin(laDeg * D2R);
    for (let i = 0; i < 4000 && y > 0; i++) { const sp = Math.hypot(vx, vy); vx += -DRAG * sp * vx * DT; vy += (-G - DRAG * sp * vy + lift * sp * sp) * DT; x += vx * DT; y += vy * DT; }
    return x;
  }

  /* ---------- 수비 ---------- */
  // 인덱스: 0 투수 1 포수 2 1루 3 2루 4 3루 5 유격 6 좌익 7 중견 8 우익
  const POS_NAME = ['투수', '포수', '1루수', '2루수', '3루수', '유격수', '좌익수', '중견수', '우익수'];
  const FIELD_HOME = [
    { x: 0, z: -17.6 }, { x: 0, z: 1.3 }, polar(38, 33), polar(14, 44), polar(-36, 32), polar(-14, 44),
    polar(-28, 84), polar(0, 94), polar(28, 84),
  ];
  const FT = { ofS: 5.9, infS: 4.3, ofT: 0.75, infT: 0.44, ofR: 1.04, infR: 0.91 };
  const US = { e0: 72, e1: 108, ep: 0.75, la0: 12, laK: 18, laN: 9 };
  function makeFielders(defSpd) {
    return FIELD_HOME.map((p, i) => {
      const s = defSpd ? defSpd[i] : 60;
      const of = i >= 6, inf = i >= 2 && i <= 5;
      return {
        x: p.x, z: p.z,
        speed: (of ? FT.ofS : inf ? FT.infS : 4.3) * (0.92 + s / 750),
        react: of ? FT.ofT : inf ? FT.infT : 0.52,
        reach: of ? FT.ofR : inf ? FT.infR : 0.8,
        reachH: of ? 2.7 : inf ? 2.3 : 2.1,
      };
    });
  }
  function findIntercept(tr, F) {
    let best = null;
    const ux = Math.sin(tr.phi * D2R), uz = -Math.cos(tr.phi * D2R);
    for (let f = 0; f < 9; f++) {
      const fd = F[f];
      for (let i = 1; i < tr.pts.length; i++) {
        const p = tr.pts[i];
        if (p.y > fd.reachH) continue;
        const d = Math.max(0, Math.hypot(p.x - fd.x, p.z - fd.z) - fd.reach);
        const tf = fd.react + d / fd.speed;
        if (tf <= p.t) { if (!best || p.t < best.t) best = { f, t: p.t, x: p.x, z: p.z, y: p.y, air: p.air, dive: clamp((Math.abs(fd.x * uz - fd.z * ux) - 2.5) / 4, 0, 1) }; break; }
      }
      if (!best || true) {
        // 공이 멈춘 뒤 도달
        const last = tr.pts[tr.pts.length - 1];
        const d = Math.max(0, Math.hypot(last.x - fd.x, last.z - fd.z) - fd.reach);
        const tf = Math.max(last.t, fd.react + d / fd.speed);
        if (!best || tf < best.t) best = { f, t: tf, x: last.x, z: last.z, y: last.y, air: false, late: true };
      }
    }
    return best;
  }

  /* ---------- 주루 ---------- */
  const runV = (s) => 6.2 + s * 0.022;

  function dirText(phi) {
    if (phi < -30) return '좌익수';
    if (phi < -12) return '좌중간';
    if (phi <= 12) return '중견수';
    if (phi <= 30) return '우중간';
    return '우익수';
  }
  function sideText(phi) {
    if (phi < -30) return '좌측';
    if (phi < -12) return '좌중간';
    if (phi <= 12) return '가운데';
    if (phi <= 30) return '우중간';
    return '우측';
  }

  /*  ctx = { bases:[r1,r2,r3] (runner {id, spd} | null), outs, batter:{id, spd}, fielders, bunt }
      반환: { kind, outs, runs, bases, runners:[{who, from, to, out, t0, t1}], throws:[{t0,t1,from,to}], fielder, fieldT, fieldPos, cover:[{f, base, t}], text } */
  // 파울 지역 뜬공 포구 (관중석 전까지)
  function foulCatch(tr, F) {
    if (tr.la < 22) return null;
    let best = null;
    for (const f of [1, 2, 4, 3, 5, 6, 8]) {
      const fd = F[f];
      for (let i = 1; i < tr.pts.length; i++) {
        const p = tr.pts[i];
        if (!p.air) break;
        if (p.y > fd.reachH) continue;
        const lineDist = p.z <= 0 ? Math.min(Math.abs(p.x + p.z), Math.abs(p.z - p.x)) * SQ : Math.hypot(p.x, p.z);
        if (lineDist > 15 || Math.abs(phiOf(p.x, p.z)) <= 45) continue;
        const d = Math.max(0, Math.hypot(p.x - fd.x, p.z - fd.z) - fd.reach);
        if (fd.react + d / fd.speed <= p.t) { if (!best || p.t < best.t) best = { f, t: p.t, x: p.x, z: p.z }; break; }
      }
    }
    return best && R() < 0.85 ? best : null;
  }
  function resolvePlay(tr, ctx) {
    const B = ctx.bases, out0 = ctx.outs, bat = ctx.batter;
    const res = { kind: '', outs: 0, runs: 0, bases: [null, null, null], runners: [], throws: [], cover: [], text: '', rbi: 0, fielder: -1, fieldT: 0, fieldPos: null, dur: 0 };
    if (tr.foul) {
      const fo = foulCatch(tr, ctx.fielders);
      if (!fo) { res.kind = 'FOUL'; res.text = '파울'; res.dur = Math.min(tr.restT, 2.2); return res; }
      res.kind = 'FOUL_OUT'; res.outs = 1; res.fielder = fo.f; res.fieldT = fo.t; res.fieldPos = { x: fo.x, z: fo.z };
      res.text = `${POS_NAME[fo.f]} 파울 플라이 아웃`;
      res.runners.push({ who: bat, from: 0, to: 1, out: true, t0: 0.45, t1: Math.max(fo.t, 1.2), abort: true });
      res.bases = [B[0], B[1], B[2]];
      res.dur = Math.max(fo.t + 1.5, 2.4);
      return res;
    }
    if (tr.hr) {
      res.kind = 'HR';
      for (let b = 2; b >= 0; b--) if (B[b]) res.runners.push({ who: B[b], from: b + 1, to: 4, out: false, t0: 0.6, t1: 0.6 + (3 - b) * 4.2 });
      res.runners.push({ who: bat, from: 0, to: 4, out: false, t0: 0.8, t1: 0.8 + 4 * 4.4 });
      res.runs = res.runners.length; res.rbi = res.runs;
      const nm = ['솔로', '투런', '쓰리런', '만루'][res.runs - 1];
      res.text = `${nm} 홈런! ${sideText(tr.phi)} 담장을 넘깁니다 (비거리 ${Math.round(tr.carry)}m)`;
      res.dur = Math.max(tr.restT + 0.6, 4.5);
      return res;
    }
    const ic = findIntercept(tr, ctx.fielders);
    res.fielder = ic.f; res.fieldT = ic.t; res.fieldPos = { x: ic.x, z: ic.z };
    const d0 = Math.hypot(ic.x, ic.z);
    const pos = POS_NAME[ic.f];
    const bT1 = 0.65 + BASE / runV(bat.spd);
    const coverOf = (k) => (k === 1 ? (ic.f === 2 ? 0 : 2) : k === 2 ? (ic.f === 5 ? 3 : 5) : k === 3 ? (ic.f === 4 ? 5 : 4) : 1);
    const addCover = (k, t) => res.cover.push({ f: coverOf(k), base: k, t });

    // 인필드 플라이: 1·2루(또는 만루), 노아웃/1아웃에 내야 뜬공 → 타자 자동 아웃 (포구 실책이 나와도 타자는 아웃)
    const iff = ic.air && !ctx.bunt && tr.la > 45 && d0 < 45 && ic.f >= 1 && ic.f <= 5 && !!B[0] && !!B[1] && out0 < 2;
    if (ic.air && !ctx.bunt && !iff && R() < 0.012) { ic.air = false; ic.late = true; res._err = true; res.errType = 'drop'; }
    if (ic.air) {
      /* ----- 뜬공/직선타 아웃 ----- */
      res.outs = 1;
      res.kind = tr.la > 48 && d0 < 60 ? 'POP' : tr.la < 18 ? 'LINE' : 'FLY';
      res.text = res.kind === 'POP' ? `${pos} 내야 뜬공 아웃` : res.kind === 'LINE' ? `${pos} 직선타 아웃` : `${pos} 뜬공 아웃`;
      if (iff) { res.iff = true; res.text = `인필드 플라이 선언! ${pos} 뜬공 아웃`; }
      res.runners.push({ who: bat, from: 0, to: 1, out: true, t0: 0.45, t1: Math.max(ic.t, 1.2), abort: true });
      const nb = [B[0], B[1], B[2]];
      if (out0 + 1 < 3) {
        if (B[2]) {
          const tThrow = ic.t + 0.9 + d0 / 27, tRun = ic.t + 0.3 + BASE / runV(B[2].spd);
          if (tRun + 0.25 < tThrow) {
            res.runners.push({ who: B[2], from: 3, to: 4, out: false, t0: ic.t + 0.3, t1: tRun });
            nb[2] = null; res.runs = 1; res.rbi = 1; res.kind = 'SF';
            res.text = `${pos} 희생플라이! 3루 주자 홈인`;
            res.throws.push({ t0: ic.t + 0.5, t1: tThrow, from: { x: ic.x, z: ic.z }, to: basePos(0) });
            addCover(4, tThrow);
          }
        }
        if (B[1] && !nb[2] && d0 > 78 && tr.phi > -5) {
          const b3 = basePos(3), tThrow = ic.t + 0.9 + dist2(ic, b3) / 27, tRun = ic.t + 0.3 + BASE / runV(B[1].spd);
          if (tRun + 0.4 < tThrow) { res.runners.push({ who: B[1], from: 2, to: 3, out: false, t0: ic.t + 0.3, t1: tRun }); nb[2] = B[1]; nb[1] = null; }
        }
      }
      if (res.kind === 'LINE' && out0 + 1 < 3 && d0 < 46 && ic.t < 0.9) {
        // 빠른 직선타: 가장 가까운 루의 주자가 귀루하지 못하면 더블 아웃
        let bk = -1, bd = 1e9;
        for (let k = 0; k < 3; k++) if (nb[k] && nb[k] === B[k]) { const d = dist2(ic, basePos(k + 1)); if (d < bd) { bd = d; bk = k; } }
        if (bk >= 0 && R() < 0.3) {
          const tb = basePos(bk + 1), tThrow = ic.t + 0.35 + bd / 30;
          res.runners.push({ who: B[bk], from: bk + 1, to: bk + 1, out: true, t0: 0.1, t1: tThrow, doubled: true });
          nb[bk] = null; res.outs = 2; res.kind = 'LDP';
          res.text = `${pos} 직선타에 귀루 못한 ${bk + 1}루 주자까지, 더블 아웃!`;
          res.throws.length = 0; res.runs = 0; res.rbi = 0;
          res.throws.push({ t0: ic.t + 0.35, t1: tThrow, from: { x: ic.x, z: ic.z }, to: tb });
          addCover(bk + 1, tThrow);
        }
      }
      if (!res.throws.length) { const b2 = basePos(2); res.throws.push({ t0: ic.t + 0.6, t1: ic.t + 0.6 + dist2(ic, b2) / 28, from: { x: ic.x, z: ic.z }, to: b2 }); }
      res.bases = nb;
      if (out0 + res.outs >= 3) { res.runs = 0; res.rbi = 0; for (let i = 0; i < 3; i++) nb[i] = null; }
      if (out0 + 1 >= 3) { res.runs = 0; res.rbi = 0; }
      res.dur = Math.max(ic.t + 1.6, ...res.runners.map((r) => r.t1 + 0.4));
      return res;
    }

    const infield = ic.f <= 5 && d0 < 48 && !ic.late;
    if (infield) {
      /* ----- 내야 땅볼 ----- */
      const xfer = (ic.f === 1 ? 0.95 : ic.f === 0 ? 0.8 : 0.75) + (ic.dive || 0) * 0.55, arm = 28;
      const thr = (k, from = ic, t0 = ic.t + xfer) => t0 + dist2(from, basePos(k)) / arm;
      const forced = [!!B[0], !!(B[0] && B[1]), !!(B[0] && B[1] && B[2])];
      const runT = (b) => 0.15 + BASE / runV(B[b].spd); // b: 0=1루주자
      let outsMade = 0; const nb = [null, null, null];
      const tB1 = thr(1);
      let plan = null;
      if (!ctx.bunt && forced[0] && out0 < 2) {
        const t2 = thr(2, ic, ic.t + xfer - 0.15);
        if (t2 < runT(0)) {
          const relay = t2 + 0.4 + BASE * Math.SQRT2 / 32; // 2루→1루 (피벗)
          plan = relay < bT1 ? 'DP' : 'FC2';
          res.throws.push({ t0: ic.t + xfer - 0.15, t1: t2, from: { x: ic.x, z: ic.z }, to: basePos(2) });
          addCover(2, t2);
          if (plan === 'DP') { res.throws.push({ t0: t2 + 0.4, t1: relay, from: basePos(2), to: basePos(1) }); addCover(1, relay); }
        }
      }
      if (!plan && out0 === 2 && forced[0] && !ctx.bunt) {
        // 2사: 가장 쉬운 포스아웃
        let bestK = 1, bestM = bT1 - tB1;
        for (let k = 2; k <= 4; k++) if (forced[k - 2]) { const m = runT(k - 2) - thr(k); if (m > bestM) { bestM = m; bestK = k; } }
        if (bestK > 1 && bestM > 0) {
          plan = 'FORCE'; res.throws.push({ t0: ic.t + xfer, t1: thr(bestK), from: { x: ic.x, z: ic.z }, to: basePos(bestK) }); addCover(bestK, thr(bestK));
          res._forceK = bestK;
        }
      }
      if (!plan) {
        plan = tB1 < bT1 ? 'GO' : 'IFH';
        if (plan === 'GO' && R() < (ic.f === 5 || ic.f === 4 ? 0.022 : 0.014)) { plan = 'IFH'; res._err = true; res.errType = 'throw'; }
        res.throws.push({ t0: ic.t + xfer, t1: tB1, from: { x: ic.x, z: ic.z }, to: basePos(1) });
        addCover(1, tB1);
      }
      // 주자 처리 (선행 주자부터)
      const scoreOnGround = (ic.f === 3 || ic.f === 5 || d0 > 36);
      const adv = (b, to, out, t1) => res.runners.push({ who: B[b], from: b + 1, to, out, t0: 0.15, t1 });
      if (plan === 'DP' || plan === 'FC2') {
        adv(0, 2, true, runT(0));
        outsMade = plan === 'DP' ? 2 : 1;
        res.runners.push({ who: bat, from: 0, to: 1, out: plan === 'DP', t0: 0.65, t1: bT1 });
        if (plan === 'FC2') nb[0] = bat;
        if (B[1]) { if (forced[1]) { adv(1, 3, false, runT(1) + 0.3); nb[2] = B[1]; } else { nb[1] = B[1]; } }
        if (B[2]) { if (forced[2] || scoreOnGround) { adv(2, 4, false, runT(2)); res.runs++; } else nb[2] = nb[2] || B[2]; }
        res.kind = plan; res.text = plan === 'DP' ? `${pos} 땅볼, 병살타!` : `${pos} 땅볼, 선행 주자 포스아웃`;
      } else if (plan === 'FORCE') {
        const k = res._forceK; outsMade = 1;
        res.runners.push({ who: bat, from: 0, to: 1, out: false, t0: 0.65, t1: bT1 });
        for (let b = 2; b >= 0; b--) if (B[b]) adv(b, b + 2, b + 2 === k, runT(b) + (b + 2 === k ? 0 : 0.2));
        res.kind = 'FC'; res.text = `${pos} 땅볼, ${k === 4 ? '홈' : k + '루'} 포스아웃`;
      } else if (plan === 'GO') {
        outsMade = 1;
        res.runners.push({ who: bat, from: 0, to: 1, out: true, t0: 0.65, t1: bT1 });
        if (B[2]) { if (forced[2] || (scoreOnGround && out0 < 2)) { adv(2, 4, false, runT(2)); res.runs++; } else nb[2] = B[2]; }
        if (B[1]) { if (forced[1] || (!nb[2] && (ic.f === 2 || ic.f === 3 || ctx.bunt) && out0 < 2)) { adv(1, 3, false, runT(1) + 0.2); nb[2] = B[1]; } else nb[1] = B[1]; }
        if (B[0]) { adv(0, 2, false, runT(0) + 0.2); nb[1] = B[0]; }
        res.kind = ctx.bunt ? 'SAC' : 'GO';
        res.text = ctx.bunt ? (B[0] || B[1] || B[2] ? '희생번트 성공! 주자 진루' : `번트 타구, ${pos} 처리 아웃`) : `${pos} 땅볼 아웃`;
      } else {
        // 내야안타
        res.runners.push({ who: bat, from: 0, to: 1, out: false, t0: 0.65, t1: bT1 });
        nb[0] = bat;
        if (B[2]) { if (forced[2]) { adv(2, 4, false, runT(2)); res.runs++; } else nb[2] = B[2]; }
        if (B[1]) { if (forced[1]) { adv(1, 3, false, runT(1) + 0.2); nb[2] = B[1]; } else nb[1] = B[1]; }
        if (B[0]) { adv(0, 2, false, runT(0) + 0.2); nb[1] = B[0]; }
        res.kind = ctx.bunt ? 'BUNT_HIT' : 'IFH';
        res.text = ctx.bunt ? '기습번트 안타!' : `${pos} 쪽 내야안타!`;
      }
      if (res._err) {
        // 1루 악송구: 공이 파울 지역으로 빠져 타자는 2루까지, 주자는 두 베이스씩
        res.kind = 'E'; res.text = `${pos} 1루 악송구 실책! 타자 주자 2루까지`;
        res.runners.length = 0; res.runs = 0; for (let i = 0; i < 3; i++) nb[i] = null;
        const tArr = tB1 + 0.1;
        for (let b = 2; b >= 0; b--) if (B[b]) {
          const to = Math.min(4, b + 3);
          res.runners.push({ who: B[b], from: b + 1, to, out: false, t0: 0.15, t1: tArr + 0.6 + (to - b - 1) * BASE / runV(B[b].spd) });
          if (to >= 4) res.runs++; else nb[to - 1] = B[b];
        }
        res.runners.push({ who: bat, from: 0, to: 2, out: false, t0: 0.65, t1: 0.65 + (2 * BASE) / runV(bat.spd) + 0.4 });
        nb[1] = bat; outsMade = 0;
      }
      res.outs = outsMade;
      if (plan === 'FORCE') {
        // 2사 포스아웃 → 이닝 종료
        res.runs = 0;
      }
      if (out0 + outsMade >= 3) { res.runs = 0; for (let i = 0; i < 3; i++) nb[i] = null; }
      res.bases = nb;
      res.rbi = plan === 'DP' || res._err ? 0 : res.runs;
      res.dur = Math.max(...res.runners.map((r) => r.t1), ...res.throws.map((t) => t.t1)) + 0.9;
      return res;
    }

    /* ----- 외야로 빠진 안타 ----- */
    const EXTRA_HOME = 1.25, EXTRA_3B = 1.1;
    const P = { x: ic.x, z: ic.z };
    const throwArr = (k) => ic.t + 0.9 + dist2(P, basePos(k)) / (dist2(P, basePos(k)) > 50 ? 24 : 27);
    let k = 1;
    for (let kk = 2; kk <= 3; kk++) {
      const tb = 0.45 + (kk * BASE) / runV(bat.spd) + (kk - 1) * 0.3;
      if (tb + 0.12 < throwArr(kk)) k = kk; else break;
    }
    const delay = tr.firstLand && out0 < 2 && tr.la > 12 ? Math.min(tr.firstLand.t * 0.55, 2.2) : 0.2;
    const nb = [null, null, null];
    let limit = 5; // 앞 주자 최종 위치
    for (let b = 2; b >= 0; b--) {
      if (!B[b]) continue;
      const from = b + 1;
      let to = Math.min(from + k, 4);
      const lead = from === 2 ? 4.5 : from === 1 ? 3.5 : 3;
      const tRun = (tt) => delay + ((tt - from) * BASE - lead) / runV(B[b].spd) + (tt - from - 1) * 0.25;
      if (to < 4 && to + 1 < limit) {
        const nt = to + 1;
        if (tRun(nt) - (nt === 4 ? EXTRA_HOME : EXTRA_3B) < throwArr(nt === 4 ? 0 : nt)) to = nt;
      }
      if (to < 4 && to >= limit) to = limit - 1;
      res.runners.push({ who: B[b], from, to, out: false, t0: delay, t1: tRun(to) });
      if (to >= 4) res.runs++; else { nb[to - 1] = B[b]; }
      limit = to >= 4 ? 5 : to;
    }
    if (k >= limit) k = limit - 1;
    res.runners.push({ who: bat, from: 0, to: k, out: false, t0: 0.45, t1: 0.45 + (k * BASE) / runV(bat.spd) + (k - 1) * 0.3 });
    nb[k - 1] = bat;
    res.bases = nb;
    res.kind = ['', '1B', '2B', '3B'][k];
    const dir = ic.late && ic.f <= 5 ? pos + ' 앞' : dirText(tr.phi);
    res.text = k === 1 ? (ic.f <= 5 ? `${pos} 옆을 빠지는 안타!` : `${dir} 앞 안타!`) : k === 2 ? `${dir} ${tr.wall ? '펜스 직격 ' : ''}2루타!` : `${dir} 깊숙한 3루타!`;
    if (res._err) { res.kind = 'E'; res.text = `${pos} 포구 실책! ${k >= 2 ? k + '루까지 진루' : '타자 주자 출루'}`; }
    const tgt = k >= 2 ? k : 2;
    res.throws.push({ t0: ic.t + 0.6, t1: throwArr(tgt), from: P, to: basePos(tgt) });
    addCover(tgt, throwArr(tgt));
    res.rbi = res._err ? 0 : res.runs;
    res.dur = Math.max(...res.runners.map((r) => r.t1), throwArr(tgt)) + 0.9;
    return res;
  }

  /* ---------- 스윙 판정 (유저 타격) ---------- */
  // e: 타이밍 오차(초, 음수=빠름), aim/ball: 홈플레이트 평면 좌표 {x,y}
  function userSwing(batter, aim, ball, e, diff, bunt, pitcherHand) {
    const W = 0.085 * diff.win, r0 = (0.1 + batter.con * 0.0006) * diff.pci;
    const d = Math.hypot(aim.x - ball.x, aim.y - ball.y);
    const pullSign = batter.hand === 'R' ? -1 : 1;
    const tl = e < -W * 0.45 ? '빠름' : e > W * 0.45 ? '늦음' : '굿';
    if (bunt) {
      if (Math.abs(e) > W * 2.4 || d > r0 * 2.6) return { miss: true, tl };
      const q = (1 - Math.abs(e) / (W * 2.4)) * (1 - d / (r0 * 2.6));
      if (q < 0.25 && R() < 0.7) return { foul: true, tl, ev: 40, la: 20, phi: 60 * (R() < 0.5 ? -1 : 1) };
      const side = aim.x < ball.x ? -1 : 1;
      return { ev: 28 + R() * 22, la: -16 + R() * 12, phi: side * (10 + R() * 24), q, tl, bunt: true };
    }
    const Wf = e < 0 ? W * 1.6 : W * 0.78, rf = r0 * 1.8;
    if (Math.abs(e) > Wf || d > rf) return { miss: true, tl };
    const qa = 1 - d / rf, qt = 1 - Math.abs(e) / Wf;
    const q = Math.pow(qa, 0.8) * Math.pow(qt, 0.8);
    const phi = -pullSign * (e / Wf) * 44 + randn() * 6 + pullSign * ((batter.pullDeg != null ? batter.pullDeg : 7) - 7) * 0.6;
    const m = batter.zm ? batter.zm[zoneCell(batter, ball)] : null;
    if (q < 0.16 || (q < 0.3 && R() < 0.55)) {
      return { foul: true, tl, ev: 70 + q * 100, la: 25 + randn() * 25, phi: (Math.abs(phi) > 45 ? phi : Math.sign(phi || 1) * (50 + R() * 30)) };
    }
    const plat = batter.hand !== pitcherHand ? 1.03 : 1;
    const ev = Math.min(186, US.e0 + US.e1 * Math.pow(q, US.ep) * (0.85 + batter.pow * 0.004) * plat + (m ? clamp(m[2], -0.15, 0.15) * 30 : 0));
    const dy = aim.y - ball.y;
    const la = clamp(US.la0 - (dy / r0) * US.laK + randn() * US.laN + (batter.pow - 60) * 0.12 + (batter.laAdj || 0) * 0.5, -40, 75);
    const cl = q > 0.85 ? '정타!' : q > 0.6 ? '잘 맞음' : q > 0.35 ? '보통' : '빗맞음';
    return { ev, la, phi, q, tl, cl };
  }

  /* ---------- 타자 성향: 코스 칸 ---------- */
  // 0~8 존 안 3×3 (위→아래 줄, 몸쪽→바깥쪽 칸), 9 위 · 10 아래 · 11 몸쪽 · 12 바깥쪽 (존 밖) — tools/batter_tend.js와 같은 규칙
  function zoneCell(batter, t) {
    const z = zoneOf(batter.height), xi = t.x * (batter.hand === 'R' ? -1 : 1); // + = 몸쪽 (우타자는 월드 -x에 섬)
    const top = z.top + BALL_R, bot = z.bot - BALL_R, h = z.half;
    if (Math.abs(t.x) <= h && t.y >= bot && t.y <= top) {
      const col = xi > h / 3 ? 0 : xi < -h / 3 ? 2 : 1, row = t.y > bot + ((top - bot) * 2) / 3 ? 0 : t.y < bot + (top - bot) / 3 ? 2 : 1;
      return row * 3 + col;
    }
    const dx = Math.abs(t.x) - h, du = t.y - top, dd = bot - t.y, m = Math.max(dx, du, dd);
    return m === du ? 9 : m === dd ? 10 : xi > 0 ? 11 : 12;
  }

  /* ---------- CPU 타자 반응 (유저 투구) ---------- */
  function cpuSwing(batter, pitch, zi, count, diff, pitcherHand, quality) {
    const brk = PITCHES[pitch.type].brk;
    // 실제 기록이 있으면 코스별 [스윙 배율, 컨택 배율, 타율 차이] (리그 평균 대비)
    const m = batter.zm && pitch.target ? batter.zm[zoneCell(batter, pitch.target)] : null;
    let ps;
    if (zi.inside) {
      ps = 0.66 + (count.s === 2 ? 0.2 : 0) - (count.b === 3 && count.s < 2 ? 0.18 : 0) + (zi.corner < 0.5 ? 0.1 : 0) - (count.b === 0 && count.s === 0 ? 0.12 : 0);
    } else {
      ps = Math.max(0, 0.4 - zi.out * 2.9) * (1.12 - batter.eye / 120) * (brk ? 1.3 : 1) + (count.s === 2 ? 0.08 : 0);
      if (count.b === 3 && count.s < 2) ps *= 0.35;
    }
    if (m) ps *= clamp(m[0], 0.55, 1.6); // 잘 참는 코스·잘 따라가는 코스
    if (R() > ps) return { swing: false };
    const plat = batter.hand !== pitcherHand ? 0.03 : 0;
    let pc = 0.765 + (batter.con - 60) / 220 + plat - (quality - 0.75) * 0.45 + diff.cpuCon;
    pc -= zi.inside ? Math.max(0, zi.corner - 0.4) * 0.22 : 0.12 + zi.out * 1.4;
    if (m) pc *= clamp(m[1], 0.75, 1.25); // 헛스윙이 많은 코스
    if (R() > pc) return { swing: true, contact: false };
    const pFoul = 0.4 + (zi.inside ? 0 : 0.12) + Math.max(0, zi.corner - 0.5) * 0.15 + (count.s === 2 ? 0.06 : 0);
    const pullSign = batter.hand === 'R' ? -1 : 1;
    if (R() < pFoul) return { swing: true, contact: true, foul: true, ev: 90 + R() * 50, la: 20 + randn() * 25, phi: (R() < 0.5 ? -1 : 1) * (48 + R() * 30) };
    const evMean = 112.5 + batter.pow * 0.36 - Math.max(0, zi.corner - 0.3) * 12 - zi.out * 45 - (quality - 0.75) * 10 + diff.cpuPow + (m ? clamp(m[2], -0.15, 0.15) * 70 : 0); // 강한 코스는 더 세게
    const ev = clamp(evMean + randn() * 21, 45, 184);
    const la = clamp(10.5 + (batter.pow - 60) * 0.17 + (zi.low ? -6 : 5) + (brk && zi.low ? -5 : 0) + (batter.laAdj || 0) + randn() * 25, -45, 80);
    const phi = pullSign * (batter.pullDeg != null ? batter.pullDeg : 7) + randn() * 22; // 당겨치기/밀어치기 성향
    return { swing: true, contact: true, foul: Math.abs(phi) > 45, ev, la, phi };
  }


  /* ---------- CPU 투구 계획 ---------- */
  const FASTS = { FB: 1, TS: 1, CT: 1 };
  function cpuPitchPlan(p, count, zone) {
    const types = p.pitches, off = types.filter((t) => !FASTS[t]);
    let type;
    if (p.mix && p.mix.length) {
      // 실제 구사율대로 + 볼카운트 보정 (볼이 몰리면 속구, 2스트라이크면 변화구를 더)
      const hitter = count.b >= 3 && count.s < 2, putaway = count.s === 2;
      const w = p.mix.map(([t, sh]) => sh * (hitter ? (FASTS[t] ? 2.4 : 0.45) : putaway ? (FASTS[t] ? 0.75 : 1.35) : 1));
      let x = R() * w.reduce((a, b) => a + b, 0);
      type = p.mix[p.mix.length - 1][0];
      for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) { type = p.mix[i][0]; break; } }
    } else if (count.b >= 3 && count.s < 2) type = R() < 0.75 ? 'FB' : pick(types);
    else if (count.s === 2) type = R() < 0.6 && off.length ? pick(off) : pick(types);
    else type = R() < 0.48 ? 'FB' : pick(types);
    const mid = (zone.top + zone.bot) / 2, hh = (zone.top - zone.bot) / 2;
    const brk = PITCHES[type].brk;
    let tx, ty;
    if (count.b === 3 && count.s < 2) { tx = (R() - 0.5) * 0.24; ty = mid + (R() - 0.5) * hh * 0.8; }
    else if (count.s === 2 && count.b < 3) { tx = (R() < 0.5 ? -1 : 1) * (0.17 + R() * 0.16); ty = brk ? zone.bot - R() * 0.14 : mid + (R() - 0.5) * hh * 2.2; }
    else { tx = (R() - 0.5) * 0.5; ty = mid + (R() - 0.5) * hh * 1.8 - (brk ? hh * 0.35 : 0); }
    return { type, target: { x: tx, y: ty } };
  }
  function fatigueOf(p, pc) { return clamp((pc - p.sta * 0.8) / (p.sta * 0.45), 0, 1); }
  function pitchSigma(p, fat, meter) {
    return meter == null ? 0.045 + (100 - p.ctl) * 0.0011 + fat * 0.06 : 0.028 + (1 - meter) * 0.15 + (100 - p.ctl) * 0.0007 + fat * 0.06;
  }
  function pitchSpeed(p, type, fat, meter) {
    const base = p.spd && p.spd[type] ? p.spd[type] : p.vel * PITCHES[type].ratio; // 실제 구종별 평균 구속이 있으면 그걸로
    return base * (1 - fat * 0.035) + randn() * 1.1 + (meter != null ? (meter - 0.6) * 2.5 : 0);
  }
  function pitchQuality(p, fat, meter) { return (p.stf / 100) * (meter == null ? 0.9 : 0.72 + 0.38 * meter) - fat * 0.15; }

  /* ---------- 팀 & 선수 (가상 구단) ---------- */
  const TEAMS = [
    { id: 'LG', city: 'LG', name: '트윈스', c1: '#c30452', c2: '#1a1a1a' },
    { id: 'HH', city: '한화', name: '이글스', c1: '#ff6600', c2: '#07111a' },
    { id: 'SSG', city: 'SSG', name: '랜더스', c1: '#ce0e2d', c2: '#ffb81c' },
    { id: 'SS', city: '삼성', name: '라이온즈', c1: '#074ca1', c2: '#e6eef8' },
    { id: 'NC', city: 'NC', name: '다이노스', c1: '#1d467f', c2: '#c4a574' },
    { id: 'KT', city: 'KT', name: '위즈', c1: '#1a1a1a', c2: '#eb1c24' },
    { id: 'LT', city: '롯데', name: '자이언츠', c1: '#041e42', c2: '#d00f31' },
    { id: 'KIA', city: 'KIA', name: '타이거즈', c1: '#ea0029', c2: '#06141f' },
    { id: 'OB', city: '두산', name: '베어스', c1: '#131230', c2: '#ed1c24' },
    { id: 'KW', city: '키움', name: '히어로즈', c1: '#820024', c2: '#d9b27a' },
  ];
  const SUR = ['김', '김', '김', '이', '이', '이', '박', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '홍', '전', '고', '문', '양', '배', '백'];
  const G1 = ['민', '서', '준', '도', '현', '지', '승', '우', '재', '태', '동', '성', '상', '진', '건', '유', '시', '정', '하', '주', '경', '호', '예', '은', '규', '형', '윤', '석'];
  const G2 = ['준', '우', '호', '민', '현', '석', '훈', '빈', '혁', '규', '환', '태', '찬', '범', '율', '결', '겸', '온', '한', '오', '재', '람', '헌', '완'];
  const FOREIGN = ['가르시아', '로페즈', '하워드', '맥케이', '에르난데스', '페레즈', '앤더슨', '토레스', '라미레즈', '모리스', '브랜든', '카스트로', '워커', '헤일', '도슨', '바르가스', '콜먼', '리베라', '멘도사', '피셔', '그랜트', '베이커', '오르티스', '실바', '넬슨', '코르테스', '하퍼스', '메이슨', '블레어', '로웰', '카터', '핀치', '에스코바', '레이놀즈', '패짓', '구즈만'];
  const ASIA = ['다카하시', '나카무라', '와타나베', '야마다', '마쓰오', '린 웨이', '천 하오', '오카다', '후지이', '쿠퍼'];
  // 실존 유명 선수와 우연히 겹치지 않게
  const BLOCK = new Set(['김도영', '류현진', '김현수', '오승환', '안우진', '김재환', '이재원', '박민우', '김주원', '최원준', '박동원', '정우영', '오지환', '강민호', '김지찬', '최지훈', '조상우', '박건우', '정수빈', '김재호', '이민호', '김민재', '정준호', '이정후', '김하성', '박해민', '김태훈', '이태양', '김민우', '장현식', '박준영', '최준용', '김서현', '이승현', '김동현', '박세웅', '구승민', '한동희', '김태진', '이재현', '김성현', '박성한', '김민성', '이유찬', '김지용', '이용찬', '홍건희', '정철원', '이우성', '최형우', '한준수', '김도현', '윤동희', '황성빈', '이호준', '김호준', '박지훈', '문현빈', '정은원', '하주석', '김인환', '안치홍', '이도윤', '최재훈', '박상원', '한승혁', '송은범', '김상수', '김재윤', '정해영', '전상현', '윤영철', '김건우', '조병현', '고명준', '박성민', '최민준', '김택연', '이병헌', '김동주', '최승용', '박준순', '오명진', '김민석', '고승민', '정훈', '이주형', '송성문', '김혜성', '김우빈', '이종석', '박서준', '이민호', '김수현', '송중기', '현빈']);

  function makeName(used) {
    for (let i = 0; i < 200; i++) {
      const a = pick(G1), b = pick(G2), n = pick(SUR) + a + b;
      if (a !== b && !BLOCK.has(n) && !used.has(n)) { used.add(n); return n; }
    }
    return '홍길' + used.size;
  }
  function foreignName(list, used) {
    for (let i = 0; i < 50; i++) { const n = pick(list); if (!used.has(n)) { used.add(n); return n; } }
    return pick(list);
  }
  const rt = (m, s, lo = 30, hi = 99) => Math.round(clamp(m + randn() * s, lo, hi));

  function buildRoster(teamIdx, seed) {
    setRng(mulberry32(seed * 7919 + teamIdx * 104729 + 13));
    const used = buildRoster._used;
    const lvl = (R() - 0.5) * 8;
    const POS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'];
    const PK = { C: '포수', '1B': '1루수', '2B': '2루수', '3B': '3루수', SS: '유격수', LF: '좌익수', CF: '중견수', RF: '우익수', DH: '지명' };
    const fIdx = Math.floor(R() * 9);
    const bats = POS.map((p, i) => {
      const f = i === fIdx;
      const spdM = p === 'SS' || p === 'CF' || p === '2B' ? 70 : p === 'C' || p === '1B' || p === 'DH' ? 45 : 58;
      const powM = p === '1B' || p === 'DH' || p === 'LF' || p === 'RF' ? 70 : p === 'SS' || p === '2B' ? 52 : 60;
      const b = {
        name: f ? foreignName(FOREIGN, used) : makeName(used), pos: p, posK: PK[p], foreign: f,
        hand: R() < 0.38 ? 'L' : 'R', height: 1.72 + R() * 0.16,
        con: rt(62 + lvl, 11), pow: rt(powM + lvl + (f ? 12 : 0), 12), eye: rt(60, 12), spd: rt(spdM, 12),
      };
      b.avg = clamp(0.212 + b.con * 0.0012 + randn() * 0.012, 0.201, 0.372);
      b.hr = Math.max(0, Math.round((b.pow - 42) * 0.55 + randn() * 3));
      return b;
    });
    // 타순: 1·2번 출루/주력, 3~5번 장타, 나머지
    const score = (b, w) => b.con * w[0] + b.pow * w[1] + b.spd * w[2] + b.eye * w[3];
    const pool = bats.slice(), order = [];
    const take = (w) => { pool.sort((a, b) => score(b, w) - score(a, w)); order.push(pool.shift()); };
    take([1, 0, 1, 0.6]); take([1, 0.2, 0.4, 0.8]); take([1, 1, 0, 0.3]); take([0.3, 1.4, 0, 0]); take([0.6, 1, 0, 0.2]);
    pool.sort((a, b) => score(b, [1, 0.8, 0.2, 0.2]) - score(a, [1, 0.8, 0.2, 0.2]));
    order.push(...pool);
    const mkP = (role, foreign, asia) => {
      const hand = R() < 0.3 ? 'L' : 'R';
      const base = ['FB'];
      const opts = ['SL', 'CB', 'CH', 'FK', 'TS'];
      const n = role === 'SP' ? 3 : 2;
      while (base.length < n + 1) { const o = pick(opts); if (!base.includes(o)) base.push(o); }
      const p = {
        name: foreign ? foreignName(FOREIGN, used) : asia ? foreignName(ASIA, used) : makeName(used), role, foreign: foreign || asia, hand,
        vel: rt(role === 'CL' ? 152 : foreign ? 150 : 145 + lvl * 0.4, 3.5, 136, 158),
        ctl: rt(60 + (foreign ? 6 : 0), 12), stf: rt(role === 'CL' ? 76 : foreign ? 72 : 62 + lvl, 10),
        sta: role === 'SP' ? Math.round(88 + R() * 16) : role === 'CL' ? 28 : Math.round(20 + R() * 16),
        pitches: base,
      };
      p.era = clamp(6.3 - p.stf * 0.04 - p.ctl * 0.012 + randn() * 0.35, 1.6, 6.9);
      return p;
    };
    const rotation = [mkP('SP', true), mkP('SP', true), mkP('SP'), mkP('SP'), mkP('SP')];
    const bullpen = [mkP('RP', false, true), mkP('RP'), mkP('RP'), mkP('RP'), mkP('RP'), mkP('CL')];
    return { lineup: order, rotation, bullpen };
  }

  function buildLeague(seed) {
    buildRoster._used = new Set();
    const r = TEAMS.map((t, i) => buildRoster(i, seed));
    setRng(Math.random);
    return r;
  }

  const api = {
    D2R, BASE, FENCE_H, BALL_R, PITCHES, TEAMS, POS_NAME, FIELD_HOME,
    mulberry32, setRng, randn, clamp, pick, R,
    basePos, polar, phiOf, fenceDist, zoneOf, inZone, zoneInfo, zoneCell,
    makePitch, pitchPos, flyBall, makeFielders, findIntercept, resolvePlay, runV, FT, US,
    userSwing, cpuSwing, buildRoster, buildLeague, dirText, sideText,
    cpuPitchPlan, fatigueOf, pitchSigma, pitchSpeed, pitchQuality,
  };
  root.Sim = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
