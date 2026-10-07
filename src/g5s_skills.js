/* ===================== 선수 스킬 ===================== */
// 팀마다 타자 2명 · 투수 2명에게 스킬 하나씩. 기본값은 2026 시즌 실제 기록(LEAGUE)에서 리그 상위권인 장점으로 자동 배정,
// 구단 탭의 '스킬'에서 바꿀 수 있음(저장 → 온라인이면 방 시작 때 상대에게도 전달돼 두 기기가 같은 스킬로 경기).
// 효과 숫자는 sim.js의 skillMods / pitchSpeed / pitchSigma / makePitch / fatigueOf와 g5_flow·g5r_rules의 도루·견제 부분에 있음
const SKILLS = {
  // 타자
  slug: { ico: '💣', nm: '거포', bat: true, desc: '타구 속도 +7km/h · 더 높이 뜸' },
  contact: { ico: '🎯', nm: '안타 제조기', bat: true, desc: '배트 판정 범위 +15% · CPU는 컨택↑' },
  speed: { ico: '⚡', nm: '대도', bat: true, desc: '도루 성공 +12%p · 견제에 덜 걸림 · 주력 +6' },
  eye: { ico: '👁️', nm: '선구안', bat: true, desc: '타이밍 여유 +15% · CPU는 유인구에 덜 속음' },
  clutch: { ico: '🔥', nm: '해결사', bat: true, desc: '득점권(2·3루 주자)에서 타구 속도 +6 · 컨택↑' },
  first: { ico: '🥊', nm: '초구 킬러', bat: true, desc: '0-0 카운트에서 타구 속도 +8' },
  pull: { ico: '🧲', nm: '당겨치기 장인', bat: true, desc: '당겨 친 타구 속도 +6' },
  tough: { ico: '🪨', nm: '끈질김', bat: true, desc: '2스트라이크에서 판정 범위·타이밍 여유↑' },
  // 투수
  heat: { ico: '☄️', nm: '파이어볼러', bat: false, desc: '직구 계열 +3km/h · 구위↑' },
  magic: { ico: '🌀', nm: '마구', bat: false, desc: '변화구 휘는 폭 +30%' },
  ctrl: { ico: '📍', nm: '핀포인트', bat: false, desc: '제구 오차 −28%' },
  gb: { ico: '🧱', nm: '땅볼 유도', bat: false, desc: '상대 타구 발사각 −5° (병살↑)' },
  escape: { ico: '🛡️', nm: '위기관리', bat: false, desc: '득점권에서 상대 타구 속도 −6' },
  eater: { ico: '⏱️', nm: '이닝이터', bat: false, desc: '체력 소모 −25%' },
  closer: { ico: '🔒', nm: '끝판왕', bat: false, desc: '마지막 이닝 1~3점 리드: +2km/h · 상대 타구 −5' },
  pickoff: { ico: '🐍', nm: '견제 달인', bat: false, desc: '견제 성공 2배 · 상대 도루 −8%p' },
  sub: { ico: '🌊', nm: '잠수함', bat: false, desc: '낮은 팔 각도: 상대 타이밍 여유 −10%' },
};
const skillTag = (p) => (p && p.skill && SKILLS[p.skill] ? `${SKILLS[p.skill].ico} ${SKILLS[p.skill].nm}` : '');

// 자동 배정: 리그 전체에서 각 장점이 몇 % 위치인지(백분위) → 팀 안에서 가장 두드러진 (선수, 스킬) 2쌍씩
const AUTO_SK = (() => {
  const bats = LEAGUE.flatMap((r) => r.lineup.concat(r.bench)).filter((b) => b.pa >= 80);
  const pits = LEAGUE.flatMap((r) => r.rotation.concat(r.bullpen)).filter((p) => p.ip >= 15);
  const swingRate = (b) => (b.tz ? b.tz.slice(0, 9).reduce((a, c) => a + c[0], 0) / 9 : 0);
  const BM = {
    slug: (b) => (b.hr >= 6 ? b.hr / b.pa * 3 + (b.slg - b.avg) : -1),
    contact: (b) => b.avg + b.con * 0.0005,
    speed: (b) => (b.sb >= 6 ? b.sb : -1),
    eye: (b) => b.obp - b.avg + b.eye * 0.0005,
    clutch: (b) => b.obp + b.slg,
    first: (b) => swingRate(b) || -1,
    pull: (b) => (b.spray ? b.spray[0] : -1),
    tough: (b) => b.con - b.pow * 0.4,
  };
  const PM = {
    heat: (p) => (p.spd && p.spd.FB) || p.vel,
    magic: (p) => p.k / Math.max(1, p.ip),
    ctrl: (p) => -p.bb / Math.max(1, p.ip),
    gb: (p) => { const t = p.mix && p.mix.find((m) => m[0] === 'TS'); return t && t[1] >= 0.15 ? t[1] : -1; }, // 투심·싱커를 많이 던지는 투수만
    escape: (p) => -p.whip,
    eater: (p) => (p.role === 'SP' ? p.ip : -1),
    closer: (p) => (p.role === 'CL' ? 1 + (p.sv || 0) : -1),
    pickoff: (p) => (p.hand === 'L' ? p.ctl : -1),
    sub: (p) => (p.slot >= 1.6 ? 2 : -1),
  };
  const pctOf = (pool, f) => { const v = pool.map(f).filter((x) => x >= 0).sort((a, b) => a - b); return (x) => (x < 0 || !v.length ? 0 : v.filter((y) => y <= x).length / v.length); };
  const BP = {}, PP = {};
  for (const k in BM) BP[k] = pctOf(bats, BM[k]);
  for (const k in PM) PP[k] = pctOf(pits, PM[k]);
  const choose = (players, M, P, fit) => {
    const pairs = [];
    players.forEach((p) => { for (const k in M) { const s = P[k](M[k](p)) * fit(p); if (s > 0) pairs.push([s, p.key, k]); } });
    pairs.sort((a, b) => b[0] - a[0]);
    const out = [], usedP = new Set(), usedS = new Set();
    for (const [, key, k] of pairs) { if (out.length >= 2) break; if (usedP.has(key) || usedS.has(k)) continue; usedP.add(key); usedS.add(k); out.push([key, k]); }
    return out;
  };
  const res = {};
  LEAGUE.forEach((r, ti) => {
    const bs = choose(r.lineup.concat(r.bench).filter((b) => b.pa >= 40), BM, BP, (b) => (r.lineup.includes(b) ? 1 : 0.8));
    // 잠수함·끝판왕은 해당되는 투수가 있으면 거의 확정 (그 팀의 상징이라서)
    const ps = choose(r.rotation.concat(r.bullpen).filter((p) => p.ip >= 10), PM, PP, (p) => (p.role === 'CL' || p.slot >= 1.6 ? 1.15 : 1));
    res[S.TEAMS[ti].id] = bs.concat(ps);
  });
  return res;
})();

// 설정(cfg.sk)이 올바르면 그대로, 아니면 자동 배정. 타자 2 · 투수 2, 한 선수 한 스킬
function skillPlan(teamId, cfg, by) {
  const sk = cfg && Array.isArray(cfg.sk) ? cfg.sk : null;
  const ok = sk && sk.length <= 4 && sk.every(([k, id]) => by[k] && SKILLS[id] && SKILLS[id].bat === (k[0] === 'B'))
    && new Set(sk.map((x) => x[0])).size === sk.length && sk.filter((x) => x[0][0] === 'B').length <= 2 && sk.filter((x) => x[0][0] === 'P').length <= 2;
  return ok ? sk : AUTO_SK[teamId] || [];
}
// 경기 중 끝판왕 발동 조건: 마지막 이닝(이후 연장 포함) 1~3점 리드
function closerOn() { return G.T && G.inning >= G.maxInn && (() => { const d = fieldTeam().runs - batTeam().runs; return d >= 1 && d <= 3; })(); }
// 스윙 판정에 넘기는 상황 정보 (sim.js skillMods)
function skillCtx() { return { b: G.b, s: G.s, risp: !!(G.bases[1] || G.bases[2]), late: closerOn(), pit: fieldTeam().pitcher }; }
