/* ===================== 경기 결과 리포트: 우리 팀·상대 팀 어워드 · 팀 기록 · 타자 · 투수 ===================== */
// 어워드는 팀별 탭: 이긴 팀은 MVP·승리투수·세이브/홀드·"얜 뭐냐", 진 팀은 졌잘싸·패전투수·"얘 때문에 짐".
// 조건이 맞으면 홈런·불쇼·철벽·삼진 공장장 같은 칭호도. 카드마다 등장 효과(색종이·비구름·흔들림 등)

function batScore(g) {
  return g.h + g.hr * 2.5 + (g.d2 || 0) * 0.5 + (g.d3 || 0) + g.rbi * 1.2 + g.r * 0.6 + g.bb * 0.45 + g.sb * 0.5
    - g.k * 0.35 - (g.ab - g.h) * 0.3 - ((g.cs || 0) + (g.pko || 0)) * 0.9;
}
function pitScore(g) { return (g.outs / 3) * 0.9 + g.k * 0.35 - g.r * 1.25 - g.bb * 0.25 - g.h * 0.2 - g.hr * 0.6; }
function playersOf(tm) {
  const bats = tm.lineup.concat(tm.out).filter((b) => b.g && b.g.pa > 0).map((p) => ({ p, bat: true, s: batScore(p.g), tm }));
  const pits = tm.used.filter((p) => p.g && (p.g.outs > 0 || p.g.pc > 0)).map((p) => ({ p, bat: false, s: pitScore(p.g), tm }));
  return bats.concat(pits);
}
function statLine(x) {
  const g = x.p.g;
  if (!x.bat) return `${fmtIP(g.outs)}이닝 ${g.pc}구 ${g.h}피안타 ${g.r}실점 ${g.k}K${g.bb ? ` ${g.bb}볼넷` : ''}`;
  const extra = [g.hr && `${g.hr}홈런`, g.rbi && `${g.rbi}타점`, g.r && `${g.r}득점`, g.bb && `${g.bb}볼넷`, g.sb && `${g.sb}도루`, g.k && `${g.k}삼진`, (g.cs || 0) + (g.pko || 0) && `주루사 ${(g.cs || 0) + (g.pko || 0)}`].filter(Boolean);
  return `${g.ab}타수 ${g.h}안타${extra.length ? ' · ' + extra.join(' ') : ''}`;
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LINES = {
  mvp: ['오늘의 주인공!', '경기를 지배했다', '인터뷰 준비하세요', '수훈 선수 등극'],
  wp: ['승리의 기운을 받았다', '타선 덕을 봤다… 아니 잘 던졌다', '오늘 밤 발 뻗고 잔다'],
  sv: ['뒷문 잠금 완료', '끝판왕 등장', '심장 쫄깃했던 마무리'],
  hd: ['리드를 지켜 냈다', '다리 역할 완벽 수행'],
  what: ['얜 뭐냐… 이긴 게 다행', '팀 승리에 묻어 간 하루', '상대 벤치가 박수를 보냈다', '적군 팬들이 유니폼 구매 고민 중'],
  hero: ['졌지만 잘 싸웠다', '혼자서 다 했는데…', '이 선수에게 죄가 없다', '패배 속 한 줄기 빛'],
  lp: ['오늘은 운이 없었다', '결승점을 내줬다', '다음 등판을 기약하며'],
  doom: ['오늘은 쉬는 날이었어야…', '감독님 표정이 굳었습니다', '팬 카페가 불타는 중', '내일은 잘할 거예요… 아마도', '더그아웃 구석에서 반성 중'],
};

// 승리·패전·세이브·홀드 (KBO 규칙을 짧은 경기에 맞춰 단순화)
//   결승점: 이긴 팀이 마지막으로 앞서 나간 순간 → 그때 상대 투수가 패전, 우리 투수(선발은 경기 5/9 이닝 이상 던졌을 때)가 승리
//   세이브: 승리투수가 아닌 마지막 투수가 3점 차 이내 리드에서 나와 아웃 1개 이상 잡고 끝냄
//   홀드: 3점 차 이내 리드에서 나와 아웃을 잡고 리드를 지킨 채 내려간 중간 투수
function pitEnter(tm) { // 투수 교체 직후: 새 투수의 등판 시 점수 차, 내려간 투수의 강판 시 점수 차 기록
  const opp = G.T[0] === tm ? G.T[1] : G.T[0], lead = tm.runs - opp.runs, prev = tm.used[tm.used.length - 2];
  if (prev) prev.g.outLead = lead;
  tm.pitcher.g.inLead = lead;
}
function decisions(W, L) {
  const wi = G.T.indexOf(W), log = G.runLog || [];
  let k = -1, prev = 0;
  log.forEach((e, i) => { const lead = wi ? e.h - e.a : e.a - e.h; if (lead > 0 && prev <= 0) k = i; if (lead <= 0) k = -1; prev = lead; });
  if (k < 0) return {};
  const e = log[k], lp = e.p[1 - wi];
  let wp = e.p[wi];
  const need = Math.ceil((G.maxInn * 5) / 9) * 3;
  if (wp === W.used[0] && wp.g.outs < need && W.used.length > 1) wp = W.used.slice(1).sort((a, b) => pitScore(b.g) - pitScore(a.g))[0];
  const last = W.used[W.used.length - 1], final = W.runs - L.runs;
  const sv = last !== wp && W.used.length > 1 && last.g.inLead >= 1 && last.g.inLead <= 3 && last.g.outs >= 1 ? last : null;
  const hd = W.used.slice(1, -1).filter((p) => p !== wp && p.g.inLead >= 1 && p.g.inLead <= 3 && p.g.outs >= 1 && (p.g.outLead != null ? p.g.outLead : final) >= 1);
  return { wp, lp, sv, hd };
}

// 한 팀의 어워드 카드 (res: 이 팀 기준 win/lose/draw)
function teamAwards(tm, res) {
  const opp = G.T[0] === tm ? G.T[1] : G.T[0], ps = playersOf(tm);
  const cards = [], used = new Set();
  const add = (p, c) => { if (!p || used.has(p)) return; const x = ps.find((y) => y.p === p) || { p, bat: !tm.used.includes(p), tm }; used.add(p); cards.push(Object.assign({ x }, c)); };
  const best = () => ps.filter((x) => !used.has(x.p)).sort((a, b) => b.s - a.s)[0];
  const worst = () => ps.filter((x) => !used.has(x.p) && (x.bat ? x.p.g.pa >= 2 : x.p.g.r > 0 || x.p.g.outs < 3)).sort((a, b) => a.s - b.s)[0];
  const d = res === 'win' ? decisions(tm, opp) : res === 'lose' ? decisions(opp, tm) : {};
  if (res === 'win') {
    const m = best(); if (m) add(m.p, { fx: 'gold', ico: '🏆', t: 'MVP', sub: pick(LINES.mvp) });
    add(d.wp, { fx: 'pulse', ico: '⚾', t: '승리투수', sub: pick(LINES.wp) });
    add(d.sv, { fx: 'ice', ico: '🔒', t: '세이브', sub: pick(LINES.sv) });
    (d.hd || []).forEach((p) => add(p, { fx: 'pulse', ico: '🛡️', t: '홀드', sub: pick(LINES.hd) }));
    const w = worst(); if (w && w.s < 0) add(w.p, { fx: 'wobble', ico: '🤨', t: `얜 뭐냐 · 사실상 ${opp.t.city} MVP`, sub: pick(LINES.what) });
  } else if (res === 'lose') {
    const h = best(); if (h) add(h.p, { fx: 'pulse', ico: '💪', t: '졌잘싸', sub: pick(LINES.hero) });
    add(d.lp, { fx: 'fire', ico: '😣', t: '패전투수', sub: pick(LINES.lp) });
    const w = worst(); if (w) add(w.p, { fx: 'doom', ico: '🌧️', t: `얘 때문에 짐 · 사실상 ${opp.t.city} MVP`, sub: pick(LINES.doom) });
  } else {
    const m = best(); if (m) add(m.p, { fx: 'gold', ico: '🏆', t: '무승부 MVP', sub: pick(LINES.mvp) });
    const w = worst(); if (w && w.s < 0) add(w.p, { fx: 'wobble', ico: '🤨', t: `얜 뭐냐 · 사실상 ${opp.t.city} MVP`, sub: pick(LINES.what) });
  }
  // 칭호: 이 팀 선수 중 조건 맞는 것만, 이미 상 받은 선수는 빼고 최대 3개
  const bats = ps.filter((x) => x.bat), pits = ps.filter((x) => !x.bat);
  const top = (arr, f, min) => arr.filter((x) => !used.has(x.p) && f(x.p.g) >= min).sort((a, b) => f(b.p.g) - f(a.p.g))[0];
  const titles = [
    [bats, (g) => g.hr, 1, (g) => ({ fx: 'boom', ico: '💥', t: g.hr >= 2 ? '멀티 홈런쇼' : '홈런 한 방', sub: `담장 밖으로 ${g.hr}개` })],
    [bats, (g) => g.rbi, 3, (g) => ({ fx: 'pulse', ico: '👑', t: '타점 기계', sub: `혼자 ${g.rbi}타점` })],
    [bats, (g) => g.h + g.bb, 3, (g) => ({ fx: 'pulse', ico: '🚀', t: '출루 머신', sub: `${g.h + g.bb}번 출루` })],
    [pits, (g) => g.k, 4, (g) => ({ fx: 'pulse', ico: '🎯', t: 'K 머신', sub: `삼진 ${g.k}개` })],
    [pits, (g) => (g.r === 0 ? g.outs : 0), 6, (g) => ({ fx: 'ice', ico: '🧊', t: '철벽 투구', sub: `${fmtIP(g.outs)}이닝 무실점` })],
    [pits, (g) => g.r, 3, (g) => ({ fx: 'fire', ico: '🔥', t: '불쇼 주의보', sub: `${g.r}실점… 소방차 출동` })],
    [bats, (g) => g.k, 2, (g) => ({ fx: 'wobble', ico: '🌀', t: '삼진 공장장', sub: `선풍기 ${g.k}번 가동` })],
    [bats, (g) => (g.cs || 0) + (g.pko || 0), 1, () => ({ fx: 'wobble', ico: '🙈', t: '주루사 장인', sub: '베이스가 멀었다' })],
    [bats, (g) => g.sb, 1, (g) => ({ fx: 'pulse', ico: '🏃', t: '대도', sub: `도루 ${g.sb}개 성공` })],
    [bats, (g) => (g.h === 0 ? g.ab : 0), 3, (g) => ({ fx: 'doom', ico: '🥶', t: '무안타 침묵', sub: `${g.ab}타수 무안타` })],
  ];
  let n = 0;
  for (const [arr, f, min, mk] of titles) {
    if (n >= 3) break;
    const x = top(arr, f, min);
    if (x) { add(x.p, mk(x.p.g)); n++; }
  }
  return cards;
}

function awardsHTML(cards) {
  if (!cards.length) return '<p class="sub">기록이 부족해요</p>';
  return `<div class="awards">${cards.map((c, i) => {
    const conf = c.fx === 'gold' ? `<span class="confetti">${Array.from({ length: 16 }, (_, k) => `<i style="--x:${(k * 37) % 100}%;--d:${(k % 5) * 0.18}s;--c:${['#ffd84a', '#ff6b6b', '#4dd4ff', '#7dff9b', '#ff9ef0'][k % 5]}"></i>`).join('')}</span>` : '';
    const rain = c.fx === 'doom' ? `<span class="rain">${Array.from({ length: 10 }, (_, k) => `<i style="--x:${(k * 23 + 7) % 100}%;--d:${(k % 4) * 0.2}s"></i>`).join('')}</span>` : '';
    return `<div class="acard fx-${c.fx}" style="--tc:${c.x.tm.t.c1};animation-delay:${0.15 + i * 0.22}s">${conf}${rain}
      <span class="aico">${c.ico}</span>${avatarHTML(c.x.p, 'md')}
      <div class="atx"><small>${esc(c.t)}</small><b>${esc(c.x.p.name)}</b><span>${esc(statLine(c.x))}</span><em>${esc(c.sub)}</em></div></div>`;
  }).join('')}</div>`;
}

function teamCmpHTML() {
  const A = G.T[0], H = G.T[1];
  const sum = (tm, f) => tm.lineup.concat(tm.out).reduce((a, b) => a + (f(b.g) || 0), 0);
  const pc = (tm) => tm.used.reduce((a, p) => a + p.g.pc, 0);
  const rows = [
    ['득점', A.runs, H.runs], ['안타', A.hits, H.hits], ['홈런', sum(A, (g) => g.hr), sum(H, (g) => g.hr)],
    ['2·3루타', sum(A, (g) => (g.d2 || 0) + (g.d3 || 0)), sum(H, (g) => (g.d2 || 0) + (g.d3 || 0))],
    ['볼넷', A.bb, H.bb], ['삼진 당함', sum(A, (g) => g.k), sum(H, (g) => g.k)], ['도루', sum(A, (g) => g.sb), sum(H, (g) => g.sb)],
    ['주루사', A.ro || 0, H.ro || 0], ['실책', A.err, H.err], ['투구 수', pc(A), pc(H)],
  ];
  const col = (t) => `background:${t.c1}`;
  return `<div class="tcmp"><div class="th"><b style="color:${A.t.c1}">${esc(A.t.city)}</b><span></span><b style="color:${H.t.c1}">${esc(H.t.city)}</b></div>
    ${rows.map(([nm, a, h]) => { const m = Math.max(a, h, 1); return `<div class="tr"><span class="v">${a}</span><span class="bar l"><i style="${col(A.t)};--w:${(a / m) * 100}%"></i></span><span class="nm">${nm}</span><span class="bar r"><i style="${col(H.t)};--w:${(h / m) * 100}%"></i></span><span class="v">${h}</span></div>`; }).join('')}</div>`;
}

function batBoxHTML(tm) {
  let h = `<div class="rhead">${esc(tm.t.city)} ${esc(tm.t.name)} 타자</div><div class="lswrap"><table class="box"><tr><th>#</th><th style="text-align:left">이름</th><th>타수</th><th>안타</th><th>홈런</th><th>타점</th><th>득점</th><th>볼넷</th><th>삼진</th><th>도루</th></tr>`;
  const row = (b, i, sub) => { const g = b.g; return `<tr${sub ? ' style="opacity:.6"' : ''}><td>${sub ? '-' : i + 1}</td><td class="n">${esc(b.name)}${sub ? ' (교체)' : ''} <small style="opacity:.6">${b.posK}</small></td><td>${g.ab}</td><td${g.h >= 2 ? ' style="color:#ffd84a;font-weight:700"' : ''}>${g.h}</td><td>${g.hr || ''}</td><td>${g.rbi || ''}</td><td>${g.r || ''}</td><td>${g.bb || ''}</td><td>${g.k || ''}</td><td>${g.sb || ''}</td></tr>`; };
  tm.lineup.forEach((b, i) => { h += row(b, i, false); });
  tm.out.filter((b) => b.g.pa > 0 || b.g.r > 0).forEach((b) => { h += row(b, 0, true); });
  return h + '</table></div>';
}
function pitBoxHTML(tm) {
  let h = `<div class="rhead">${esc(tm.t.city)} ${esc(tm.t.name)} 투수</div><div class="lswrap"><table class="box"><tr><th style="text-align:left">이름</th><th>이닝</th><th>투구</th><th>피안타</th><th>피홈런</th><th>실점</th><th>볼넷</th><th>삼진</th></tr>`;
  tm.used.forEach((p, i) => { const g = p.g; h += `<tr><td class="n">${esc(p.name)} <small style="opacity:.6">${i === 0 ? '선발' : '구원'}</small></td><td>${fmtIP(g.outs)}</td><td>${g.pc}</td><td>${g.h}</td><td>${g.hr || ''}</td><td${g.r >= 3 ? ' style="color:#ff8a8a;font-weight:700"' : ''}>${g.r}</td><td>${g.bb || ''}</td><td${g.k >= 4 ? ' style="color:#7dff9b;font-weight:700"' : ''}>${g.k}</td></tr>`; });
  return h + '</table></div>';
}

// 결과 창 탭
const OVER = { tab: 'me', me: [], op: [] };
function renderOverPane() {
  const me = G.T[G.userSide], op = G.T[1 - G.userSide], P = $('#overPane');
  $('#overTabs').querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ot === OVER.tab)));
  P.innerHTML = OVER.tab === 'me' ? awardsHTML(OVER.me) : OVER.tab === 'op' ? awardsHTML(OVER.op) : OVER.tab === 'tm' ? teamCmpHTML()
    : OVER.tab === 'bat' ? batBoxHTML(me) + batBoxHTML(op) : pitBoxHTML(me) + pitBoxHTML(op);
}
function showReport(r) {
  const me = G.T[G.userSide], op = G.T[1 - G.userSide];
  OVER.tab = 'me';
  OVER.me = teamAwards(me, r); OVER.op = teamAwards(op, r === 'win' ? 'lose' : r === 'lose' ? 'win' : 'draw');
  const dot = (t) => `<i class="tdot" style="background:${t.c1}"></i>`;
  $('#overTabs').innerHTML = `<button data-ot="me" role="tab">${dot(me.t)}${esc(me.t.city)}</button><button data-ot="op" role="tab">${dot(op.t)}${esc(op.t.city)}</button>`
    + '<button data-ot="tm" role="tab">팀 기록</button><button data-ot="bat" role="tab">타자</button><button data-ot="pit" role="tab">투수</button>';
  renderOverPane();
}
$('#overTabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-ot]'); if (!b) return; AU.click(); OVER.tab = b.dataset.ot; renderOverPane(); });
