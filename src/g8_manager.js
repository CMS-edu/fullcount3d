/* ===================== 감독 모드: 구단 관리 · 교체 ===================== */
function rosterCfgAll() { return store.get('roster2', {}) || {}; }
function applyRoster(tm) {
  const cfg = rosterCfgAll()[tm.t.id] || {};
  const bats = tm.ros.lineup.concat(tm.ros.bench), pits = tm.ros.rotation.concat(tm.ros.bullpen), by = {};
  bats.concat(pits).forEach((p) => (by[p.key] = p));
  if (cfg.names) for (const k in cfg.names) if (by[k] && cfg.names[k]) by[k].name = String(cfg.names[k]).slice(0, 10);
  if (cfg.hands) for (const k in cfg.hands) if (by[k] && /^[LR]$/.test(cfg.hands[k])) by[k].hand = cfg.hands[k];
  const ord = cfg.order;
  if (Array.isArray(ord) && ord.length === 9 && new Set(ord).size === 9 && ord.every((k) => by[k] && k[0] === 'B')) {
    const ps = ord.map((k) => (cfg.pos && cfg.pos[k]) || by[k].pos);
    if (new Set(ps).size === 9 && ps.every((p) => POS_K[p])) {
      tm.lineup = ord.map((k, i) => { const b = by[k]; b.pos = ps[i]; b.posK = POS_K[ps[i]]; return b; });
      tm.bench = bats.filter((b) => !tm.lineup.includes(b));
    }
  }
  if (cfg.sp && by[cfg.sp] && tm.ros.rotation.includes(by[cfg.sp])) { tm.pitcher = by[cfg.sp]; tm.used = [tm.pitcher]; }
}

/* ---------- 구단 관리 에디터 ---------- */
const ED = { team: 0, tab: 'bat', order: [], pos: {}, names: {}, sp: null, sel: null, posSel: null, editing: null, dirty: false };
function edLoad(ti) {
  const r = LEAGUE[ti], cfg = rosterCfgAll()[S.TEAMS[ti].id] || {};
  ED.team = ti; ED.sel = null; ED.posSel = null; ED.editing = null; ED.dirty = false; ED.photo = null;
  ED.names = Object.assign({}, cfg.names || {}); ED.hands = Object.assign({}, cfg.hands || {});
  const tmp = { t: S.TEAMS[ti], ros: JSON.parse(JSON.stringify(r)), lineup: null, bench: null, pitcher: null, used: [] };
  tmp.lineup = tmp.ros.lineup.slice(); tmp.bench = tmp.ros.bench.slice();
  applyRoster(tmp);
  ED.order = tmp.lineup.map((b) => b.key);
  ED.pos = {}; tmp.lineup.forEach((b) => (ED.pos[b.key] = b.pos));
  ED.sp = cfg.sp || null;
  ED.base = {}; r.lineup.concat(r.bench, r.rotation, r.bullpen).forEach((p) => (ED.base[p.key] = p));
}
function edName(k) { return ED.names[k] || ED.base[k].name; }
function edBench() { return Object.keys(ED.base).filter((k) => k[0] === 'B' && !ED.order.includes(k)); }
function batInfo(p) { return `${p.sw ? '양' : p.hand === 'L' ? '좌' : '우'}타 · ${fmtAvg(p.avg)} ${p.hr}HR ${p.sb}도루 · OPS ${(p.obp + p.slg).toFixed(3)} (${p.pa}타석) · 컨${p.con} 파${p.pow} 선${p.eye} 주${p.spd}`; }
function pitInfo(p) { const ipS = `${Math.floor(p.ip)}${Math.round((p.ip % 1) * 3) ? '.' + Math.round((p.ip % 1) * 3) : ''}`; return `${p.hand === 'L' ? '좌' : '우'}투${armSlotName(p) ? ' ' + armSlotName(p) : ''} · ERA ${p.era.toFixed(2)} · ${ipS}이닝 ${p.k}K ${p.bb}BB${p.sv ? ' ' + p.sv + 'SV' : ''} · 제구${p.ctl} 구위${p.stf} · ${p.mix ? `${mixText(p)}${p.spd && p.spd.FB ? ` · 직구 평균 ${Math.round(p.spd.FB)}km/h` : ''}` : '구속·구종은 추정'}`; }
function openRoster(ti) {
  edLoad(ti == null ? OPTS.me : ti); ED.tab = 'bat';
  showTab('roster');
}
function renderRoster() {
  const t = S.TEAMS[ED.team];
  $('#rosterH').textContent = `${t.city} ${t.name}${ED.team === OPTS.me ? ' (내 팀)' : ''}`;
  $$('.rtabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === ED.tab)));
  const L = $('#rosterList'); L.innerHTML = '';
  if (ED.photo && ED.base[ED.photo] && ED.tab !== 'paste') photoPanel(L);
  const row = (html, cls) => { const d = document.createElement('div'); d.className = 'rrow' + (cls ? ' ' + cls : ''); d.innerHTML = html; L.appendChild(d); return d; };
  const head = (tx) => { const h = document.createElement('div'); h.className = 'rhead'; h.textContent = tx; L.appendChild(h); };
  const nameCell = (k, info) => ED.editing === k
    ? `<input maxlength="10" value="${esc(edName(k))}" aria-label="선수 이름" data-k="${k}">`
    : `<button class="nm" data-k="${k}">${avatarHTML(ED.base[k], 'sm')}<span class="nmt"><b>${esc(edName(k))} ${ED.base[k].num ? `<small style="opacity:.6">#${ED.base[k].num}</small>` : ''}</b><span>${info}</span></span></button>`;
  if (ED.tab === 'bat') {
    $('#rosterHint').textContent = ED.posSel ? '포지션을 바꿀 다른 선수의 포지션 칸을 누르세요' : ED.sel ? '바꿀 선수를 누르세요 (주전끼리 = 타순 교환, 벤치 선수 = 선발 투입)' : '선수를 누르고 다른 선수를 누르면 타순 교환 · 포지션 칸끼리 누르면 수비 위치 교환 · ✎ 이름 수정';
    head('선발 라인업');
    ED.order.forEach((k, i) => {
      const p = ED.base[k];
      const d = row(`<span class="no">${i + 1}</span><button class="pos${ED.posSel === k ? ' sel' : ''}" data-pk="${k}">${POS_K[ED.pos[k]]}</button>${nameCell(k, batInfo(p))}<button class="ed" data-ek="${k}" aria-label="${esc(edName(k))} 이름 수정">✎</button>`, ED.sel === k ? 'sel' : '');
      void d;
    });
    head('벤치');
    edBench().forEach((k) => {
      const p = ED.base[k];
      row(`<span class="no" style="font-size:13px;opacity:.6">벤치</span><button class="pos" disabled>${POS_K[p.pos]}</button>${nameCell(k, batInfo(p))}<button class="ed" data-ek="${k}" aria-label="${esc(edName(k))} 이름 수정">✎</button>`, ED.sel === k ? 'sel' : '');
    });
  } else if (ED.tab === 'paste') {
    renderPaste(L); return;
  } else {
    $('#rosterHint').textContent = '선발 버튼으로 다음 경기 선발투수를 정해요 (자동이면 로테이션에서 랜덤) · ✎ 이름 수정';
    head('선발 로테이션');
    const r = LEAGUE[ED.team];
    r.rotation.forEach((p) => {
      row(`<span></span><button class="sp" data-sp="${p.key}" aria-pressed="${ED.sp === p.key}">선발</button>${nameCell(p.key, pitInfo(p))}<button class="ed" data-ek="${p.key}" aria-label="${esc(edName(p.key))} 이름 수정">✎</button>`);
    });
    const auto = row(`<span></span><button class="sp" data-sp="" aria-pressed="${!ED.sp}">자동</button><span style="font-size:13px;color:var(--ink-2)">경기마다 로테이션에서 랜덤 선발</span><span></span>`);
    void auto;
    head('불펜');
    r.bullpen.forEach((p) => {
      row(`<span class="no" style="font-size:12px">${p.role === 'CL' ? '마무리' : '불펜'}</span><span></span>${nameCell(p.key, pitInfo(p))}<button class="ed" data-ek="${p.key}" aria-label="${esc(edName(p.key))} 이름 수정">✎</button>`);
    });
  }
  if (ED.tab !== 'paste') photoCredits(L);
  const inp = L.querySelector('input:not([type=file])');
  if (inp) {
    inp.focus(); inp.select();
    const done = () => { const v = inp.value.trim().slice(0, 10); if (v && v !== ED.base[inp.dataset.k].name) ED.names[inp.dataset.k] = v; else delete ED.names[inp.dataset.k]; ED.editing = null; ED.dirty = true; renderRoster(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } if (e.key === 'Escape') { e.stopPropagation(); ED.editing = null; renderRoster(); } });
    inp.addEventListener('blur', () => { if (ED.editing) done(); });
  }
}
$('#rosterList').addEventListener('click', (e) => {
  const av = e.target.closest('.nm .ava');
  if (av) { ED.photo = av.closest('.nm').dataset.k; ED.sel = null; ED.posSel = null; renderRoster(); $('#panes').scrollTop = 0; AU.click(); return; }
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ek) { ED.editing = b.dataset.ek; ED.sel = null; ED.posSel = null; renderRoster(); return; }
  if (b.dataset.sp != null && b.classList.contains('sp')) { ED.sp = b.dataset.sp || null; ED.dirty = true; AU.click(); renderRoster(); return; }
  if (b.dataset.pk) {
    const k = b.dataset.pk; ED.sel = null;
    if (!ED.posSel) ED.posSel = k;
    else if (ED.posSel === k) ED.posSel = null;
    else { const a = ED.posSel; [ED.pos[a], ED.pos[k]] = [ED.pos[k], ED.pos[a]]; ED.posSel = null; ED.dirty = true; }
    AU.click(); renderRoster(); return;
  }
  if (b.classList.contains('nm')) {
    const k = b.dataset.k; ED.posSel = null;
    if (!ED.sel) ED.sel = k;
    else if (ED.sel === k) ED.sel = null;
    else {
      const a = ED.sel, ia = ED.order.indexOf(a), ib = ED.order.indexOf(k);
      if (ia >= 0 && ib >= 0) { ED.order[ia] = k; ED.order[ib] = a; }
      else if (ia >= 0 || ib >= 0) {
        const st = ia >= 0 ? a : k, bn = ia >= 0 ? k : a, i = ED.order.indexOf(st);
        ED.order[i] = bn; ED.pos[bn] = ED.pos[st]; delete ED.pos[st];
        toast(`${edName(bn)} 선발 · ${edName(st)} 벤치로`, 1600);
      }
      ED.sel = null; ED.dirty = true;
    }
    AU.click(); renderRoster();
  }
});
// 선수 사진 바꾸기 (명단에서 얼굴을 누르면 열림)
function photoPanel(L) {
  const k = ED.photo, pl = ED.base[k], mine = !!myPhoto(pl), cr = photoCredit(pl);
  const d = document.createElement('div'); d.className = 'phpanel';
  d.innerHTML = `${avatarHTML(pl, 'lg')}<div class="php-t"><b>${esc(edName(k))}</b>
    <small>${mine ? '내가 올린 사진이에요 (이 기기에만 저장돼요)' : pl.kbo ? 'KBO 공식 선수 사진이에요' : pl.ph ? 'Wikimedia Commons 사진이에요' : '사진을 못 찾아서 그림으로 보여줘요'}</small>
    ${cr ? `<small class="cr">${cr}</small>` : ''}
    <div class="row2"><label class="mbtn primary">📷 사진 올리기<input type="file" accept="image/*" hidden></label>${mine ? '<button class="mbtn" data-phdel>원래대로</button>' : ''}<button class="mbtn" data-phx>닫기</button></div></div>`;
  L.appendChild(d);
  d.querySelector('input[type=file]').addEventListener('change', async (e) => {
    try {
      const url = await fileToAvatar(e.target.files[0]);
      if (!setMyPhoto(pl, url)) { toast('저장 공간이 부족해요. 다른 선수 사진을 지워 주세요', 2800); return; }
      toast('사진을 바꿨어요'); renderRoster(); if (G.T) updateLines();
    } catch (x) { toast(x.message || '사진을 못 읽었어요'); }
  });
  const del = d.querySelector('[data-phdel]'); if (del) del.onclick = (e) => { e.stopPropagation(); setMyPhoto(pl, null); renderRoster(); };
  d.querySelector('[data-phx]').onclick = (e) => { e.stopPropagation(); ED.photo = null; renderRoster(); };
}
// 이 팀 명단에 쓰인 Commons 사진의 저작자·라이선스
function photoCredits(L) {
  const ps = Object.values(ED.base).filter((p) => !p.kbo && p.ph && !myPhoto(p));
  const d = document.createElement('div'); d.className = 'credits';
  d.innerHTML = `<div class="rhead">선수 사진</div><p class="sub" style="margin:0 0 6px">KBO 공식 홈페이지(koreabaseball.com)의 선수 사진을 불러와서 보여줘요. 얼굴을 누르면 내 사진으로 바꿀 수 있어요 (이 기기에만 저장).</p>` +
    ps.map((p) => `<div>${esc(p.name)} — ${photoCredit(p)} · Wikimedia Commons</div>`).join('');
  L.appendChild(d);
}
function edSave() {
  const all = rosterCfgAll(), id = S.TEAMS[ED.team].id;
  const pos = {}; ED.order.forEach((k) => (pos[k] = ED.pos[k]));
  all[id] = { names: ED.names, hands: ED.hands, order: ED.order.slice(), pos, sp: ED.sp };
  store.set('roster2', all); ED.dirty = false;
}
$$('.rtabs button').forEach((b) => b.addEventListener('click', () => { ED.tab = b.dataset.tab; ED.sel = null; ED.posSel = null; ED.editing = null; renderRoster(); }));
$('#rtPrev').addEventListener('click', () => { if (ED.dirty) edSave(); edLoad((ED.team + 9) % 10); renderRoster(); AU.click(); });
$('#rtNext').addEventListener('click', () => { if (ED.dirty) edSave(); edLoad((ED.team + 1) % 10); renderRoster(); AU.click(); });
$('#rosterSave').addEventListener('click', () => { edSave(); toast('저장했어요! 다음 경기부터 적용돼요'); renderTitle(); });
$('#rosterReset').addEventListener('click', () => { const all = rosterCfgAll(); delete all[S.TEAMS[ED.team].id]; store.set('roster2', all); edLoad(ED.team); renderRoster(); toast('기본값으로 되돌렸어요'); });

/* ---------- 경기 중 교체 (대타 · 대주자) ---------- */
function subCard(p, extra) {
  const b = document.createElement('button'); b.className = 'pcard';
  b.innerHTML = `<b>${avatarHTML(p, 'xs2')} ${esc(p.name)} <span style="font-weight:500;opacity:.7">${p.num ? '#' + p.num + ' · ' : ''}${p.posK}</span></b><span class="role">${extra || '벤치'}</span><span class="r">${batInfo(p)}</span>`;
  return b;
}
function openPH() {
  if (!userBatting() || G.phase !== 'ready') return;
  const tm = batTeam(), cur = curBatter();
  $('#subH').textContent = '대타';
  $('#subSub').textContent = `${tm.order + 1}번 ${cur.name} (${fmtAvg(cur.avg)} · 오늘 ${cur.g.ab}타수 ${cur.g.h}안타) 대신 누구를 낼까?`;
  const L = $('#subList'); L.innerHTML = '';
  if (!tm.bench.length) L.textContent = '남은 벤치 선수가 없어요';
  tm.bench.forEach((p) => { const b = subCard(p, p.pow >= 60 ? '장타' : p.con >= 60 ? '컨택' : '벤치'); b.addEventListener('click', () => { pinchHit(p); closeSub(); }); L.appendChild(b); });
  paused = true; openModal('#subModal');
}
function pinchHit(sub) {
  const tm = batTeam(), i = tm.order, old = tm.lineup[i];
  sub.pos = old.pos; sub.posK = old.posK;
  tm.lineup[i] = sub; tm.bench.splice(tm.bench.indexOf(sub), 1); tm.out.push(old);
  setupBatter(); setZoneGuide(S.zoneOf(sub.height));
  updateLines(); drawBoard(); drawTracker(); showDocks();
  boardFlash('대타', sub.name, 2.2); toast(`대타 ${sub.name}! (${old.name} 교체)`); AU.whistle();
}
function openPR(k) {
  if (!userBatting() || G.phase !== 'ready') return;
  const tm = batTeam(), L = $('#subList'); L.innerHTML = '';
  $('#subH').textContent = '대주자';
  const occ = [0, 1, 2].filter((i) => G.bases[i]);
  if (k == null && occ.length > 1) {
    $('#subSub').textContent = '어느 주자를 바꿀까?';
    occ.forEach((i) => {
      const p = G.bases[i], b = document.createElement('button'); b.className = 'pcard';
      b.innerHTML = `<b>${avatarHTML(p, 'xs2')} ${i + 1}루 주자 ${esc(p.name)}</b><span class="role">주력 ${p.spd}</span>`;
      b.addEventListener('click', () => openPR(i)); L.appendChild(b);
    });
    paused = true; openModal('#subModal'); return;
  }
  k = k == null ? occ[0] : k;
  const run = G.bases[k];
  $('#subSub').textContent = `${k + 1}루 주자 ${run.name} (주력 ${run.spd}) 대신 누구를?`;
  tm.bench.slice().sort((a, b) => b.spd - a.spd).forEach((p) => { const b = subCard(p, `주력 ${p.spd}`); b.addEventListener('click', () => { pinchRun(k, p); closeSub(); }); L.appendChild(b); });
  paused = true; openModal('#subModal');
}
function pinchRun(k, sub) {
  const tm = batTeam(), old = G.bases[k], i = tm.lineup.indexOf(old);
  if (i < 0) return;
  sub.pos = old.pos; sub.posK = old.posK;
  tm.lineup[i] = sub; tm.bench.splice(tm.bench.indexOf(sub), 1); tm.out.push(old);
  G.bases[k] = sub; placeRunners(); updateLines(); showDocks();
  toast(`대주자 ${sub.name}! (${old.name} 교체)`); AU.whistle();
}
$('#phBtn').addEventListener('click', () => { AU.click(); openPH(); });
$('#prBtn').addEventListener('click', () => { AU.click(); openPR(); });
function closeSub() { closeModal('#subModal'); paused = false; }
$('#subClose').addEventListener('click', closeSub);
function benchLeft() { return G.T && batTeam().bench.length > 0; }

/* ---------- 메뉴: 우리 팀 박스스코어 ---------- */
function boxHTML(tm) {
  if (!tm) return '';
  let h = `<div class="rhead">${esc(tm.t.city)} ${esc(tm.t.name)} 타자 기록</div><div class="lswrap"><table class="box"><tr><th>#</th><th style="text-align:left">이름</th><th>위치</th><th>타수</th><th>안타</th><th>타점</th><th>득점</th><th>볼넷</th><th>삼진</th></tr>`;
  tm.lineup.forEach((b, i) => {
    const g = b.g;
    h += `<tr${i === tm.order && G.half === G.userSide ? ' style="font-weight:700"' : ''}><td>${i + 1}</td><td class="n">${esc(b.name)}</td><td>${b.posK}</td><td>${g.ab}</td><td>${g.h}</td><td>${g.rbi}</td><td>${g.r}</td><td>${g.bb}</td><td>${g.k}</td></tr>`;
  });
  tm.out.forEach((b) => { const g = b.g; h += `<tr style="opacity:.55"><td>-</td><td class="n">${esc(b.name)} (교체)</td><td>${b.posK}</td><td>${g.ab}</td><td>${g.h}</td><td>${g.rbi}</td><td>${g.r}</td><td>${g.bb}</td><td>${g.k}</td></tr>`; });
  h += '</table></div>';
  const p = tm.pitcher;
  if (p) h += `<p class="sub" style="margin:8px 0 0">현재 투수 ${esc(p.name)} · ${p.g.pc}구 · ${Math.floor(p.g.outs / 3)}이닝${p.g.outs % 3 ? ' ' + (p.g.outs % 3) + '/3' : ''} · ${p.g.k}K · ${p.g.r}실점</p>`;
  return h;
}

/* ---------- 명단 붙여넣기 ---------- */
const POS_ALIAS = { '포수': 'C', 'C': 'C', '1루': '1B', '1루수': '1B', '1B': '1B', '2루': '2B', '2루수': '2B', '2B': '2B', '3루': '3B', '3루수': '3B', '3B': '3B', '유격': 'SS', '유격수': 'SS', 'SS': 'SS', '좌익': 'LF', '좌익수': 'LF', 'LF': 'LF', '중견': 'CF', '중견수': 'CF', 'CF': 'CF', '우익': 'RF', '우익수': 'RF', 'RF': 'RF', '지명': 'DH', '지명타자': 'DH', 'DH': 'DH', '내야수': 'IF', '내야': 'IF', '외야수': 'OF', '외야': 'OF' };
const ROLE_ALIAS = { '선발': 'SP', 'SP': 'SP', '불펜': 'RP', '중계': 'RP', '구원': 'RP', 'RP': 'RP', '마무리': 'CL', 'CL': 'CL', '투수': 'P', 'P': 'P' };
function parseRoster(text) {
  const bats = [], pits = [];
  text.split(/\r?\n/).forEach((line) => {
    const tk = line.replace(/[,|\/·]/g, ' ').split(/\s+/).map((x) => x.replace(/^\(|\)$/g, '')).filter(Boolean);
    if (!tk.length) return;
    let pos = null, role = null, bh = null, name = null;
    for (const w of tk) {
      const W = w.toUpperCase();
      if (/^\d+[.번)]?$/.test(w)) continue;
      if (POS_ALIAS[W] || POS_ALIAS[w]) { pos = pos || POS_ALIAS[W] || POS_ALIAS[w]; continue; }
      if (ROLE_ALIAS[W] || ROLE_ALIAS[w]) { role = role || ROLE_ALIAS[W] || ROLE_ALIAS[w]; continue; }
      const m = w.match(/^(?:([좌우])(?:투|언))?([좌우양])타$/) || w.match(/^([좌우])(?:투|언)$/);
      if (m) { if (/타$/.test(w)) bh = m[2] === '좌' ? 'L' : m[2] === '우' ? 'R' : bh; else bh = bh || (m[1] === '좌' ? 'L' : 'R'); continue; }
      if (!name && /^[가-힣A-Za-z.\-]{2,10}$/.test(w)) name = w;
    }
    if (!name) return;
    if (role) pits.push({ name, role, hand: bh }); else bats.push({ name, pos, hand: bh });
  });
  return { bats, pits };
}
function applyPaste(text) {
  const { bats, pits } = parseRoster(text), r = LEAGUE[ED.team];
  if (!bats.length && !pits.length) { toast('읽을 수 있는 줄이 없어요. 형식을 확인해 줘'); return; }
  const bKeys = r.lineup.concat(r.bench).map((b) => b.key);
  if (bats.length) {
    const st = bats.slice(0, 9), bn = bats.slice(9, 13);
    const order = bKeys.slice(0, st.length).concat(ED.order.filter((k) => !bKeys.slice(0, st.length).includes(k))).slice(0, 9);
    // 이름·투타
    st.concat(bn).forEach((b, i) => { const k = bKeys[i]; ED.names[k] = b.name; if (b.hand) ED.hands[k] = b.hand; });
    ED.order = order;
    // 포지션: 유효하고 겹치지 않으면 그대로, 나머지는 남는 자리로
    const used = new Set(), pos = {};
    st.forEach((b, i) => { if (b.pos && POS_K[b.pos] && !used.has(b.pos)) { pos[bKeys[i]] = b.pos; used.add(b.pos); } });
    ED.order.forEach((k) => { if (!pos[k]) { const p = POS_LIST.find((x) => !used.has(x)); pos[k] = p; used.add(p); } });
    ED.pos = pos;
  }
  if (pits.length) {
    const rot = r.rotation.map((p) => p.key), pen = r.bullpen.filter((p) => p.role !== 'CL').map((p) => p.key), cl = r.bullpen.find((p) => p.role === 'CL').key;
    const put = (k, p) => { ED.names[k] = p.name; if (p.hand) ED.hands[k] = p.hand; };
    const ps = pits.filter((p) => p.role === 'SP'), rp = pits.filter((p) => p.role === 'RP'), cls = pits.filter((p) => p.role === 'CL'), any = pits.filter((p) => p.role === 'P');
    any.forEach((p) => (ps.length < 5 ? ps : rp).push(p));
    ps.slice(0, 5).forEach((p, i) => put(rot[i], p));
    rp.slice(0, pen.length).forEach((p, i) => put(pen[i], p));
    if (cls[0]) put(cl, cls[0]);
  }
  ED.dirty = true;
  toast(`타자 ${Math.min(bats.length, 13)}명 · 투수 ${Math.min(pits.length, 11)}명 반영! 저장을 눌러야 적용돼요`, 3000);
  ED.tab = 'bat'; renderRoster();
}
function renderPaste(L) {
  $('#rosterHint').textContent = '한 줄에 한 명씩 붙여넣어. 타자는 적힌 순서대로 1~9번 타순, 10~13번째는 벤치. 투수는 선발/불펜/마무리를 적어줘.';
  L.innerHTML = `<textarea id="pasteBox" rows="12" style="width:100%;font:inherit;font-size:14px;padding:10px;border-radius:12px;border:1px solid var(--border);background:var(--panel-2);color:var(--ink)" placeholder="예시)\n1 홍길동 중견수 좌타\n2 김철수 유격수 우타\n...\n9 박영희 포수 우타\n이민수 내야수 우타   (10번째부터 벤치)\n선발 최강속 우투\n불펜 정중계 좌투\n마무리 오세이브 우투"></textarea>
  <p class="sub" style="margin:8px 0 0">포지션은 포수/1루수/…/지명타자, 투타는 좌타·우타·우투좌타·좌투처럼 써도 돼. 능력치는 자리별 기본값이 그대로 쓰여.</p>
  <button class="mbtn primary" id="pasteGo">명단 반영하기</button>`;
  $('#pasteGo').addEventListener('click', () => applyPaste($('#pasteBox').value));
}

/* ---------- CPU 대타 ---------- */
function cpuPinchHit(bt) {
  if (G.inning < G.maxInn - 1 || !bt.bench.length) return;
  if (Math.abs(G.T[0].runs - G.T[1].runs) > 3) return;
  const cur = bt.lineup[bt.order], val = (p) => p.con + p.pow + p.eye * 0.5;
  const best = bt.bench.slice().sort((a, b) => val(b) - val(a))[0];
  const clutch = G.bases[1] || G.bases[2] || G.inning >= G.maxInn;
  if (!(val(best) > val(cur) + 12 && clutch && R() < 0.55)) return;
  best.pos = cur.pos; best.posK = cur.posK;
  bt.lineup[bt.order] = best; bt.bench.splice(bt.bench.indexOf(best), 1); bt.out.push(cur);
  toast(`상대 대타: ${best.name} (${cur.name} 대신)`, 2200); boardFlash('대타', best.name, 2);
}

/* ---------- 수비 교체 ---------- */
function openDef(slot) {
  if (!userPitching() || G.phase !== 'aim') { toast('투구 준비 중에만 교체할 수 있어요'); return; }
  const tm = fieldTeam(), L = $('#subList'); L.innerHTML = '';
  if (!tm.bench.length) { toast('남은 벤치 선수가 없어요'); return; }
  $('#subH').textContent = '수비 교체';
  if (slot == null) {
    $('#subSub').textContent = '누구를 바꿀까? (타순 자리도 그대로 이어받아요)';
    tm.lineup.forEach((p, i) => {
      if (p.pos === 'DH') return;
      const b = document.createElement('button'); b.className = 'pcard';
      b.innerHTML = `<b>${avatarHTML(p, 'xs2')} ${esc(p.name)} <span style="font-weight:500;opacity:.7">${i + 1}번 · ${p.posK}</span></b><span class="role">주력 ${p.spd}</span><span class="r">${batInfo(p)}</span>`;
      b.addEventListener('click', () => openDef(i)); L.appendChild(b);
    });
  } else {
    const old = tm.lineup[slot];
    $('#subSub').textContent = `${old.posK} ${old.name} 대신 누구를? (수비는 주력이 높을수록 넓게 커버해요)`;
    tm.bench.slice().sort((a, b) => b.spd - a.spd).forEach((p) => {
      const b = subCard(p, `주력 ${p.spd}`);
      b.addEventListener('click', () => { defSub(tm, slot, p); closeSub(); }); L.appendChild(b);
    });
  }
  paused = true; openModal('#subModal');
}
function defSub(tm, i, sub) {
  const old = tm.lineup[i];
  sub.pos = old.pos; sub.posK = old.posK;
  tm.lineup[i] = sub; tm.bench.splice(tm.bench.indexOf(sub), 1); tm.out.push(old);
  dressField(); resetField(); updateLines();
  toast(`수비 교체: ${old.posK} ${sub.name} (${old.name} 대신)`); AU.whistle();
}
$('#defBtn').addEventListener('click', () => { AU.click(); openDef(); });

