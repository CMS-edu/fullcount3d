/* ===================== 온라인 1:1 (room presence 기반 락스텝) ===================== */
// 원리: 두 기기가 같은 시드로 같은 계산을 하고, 사람의 선택(투구/스윙/작전)만 주고받는다.
// 방 설정(이닝·홈/원정·주야간·판정 난이도)은 방장이 정하고, 참가자는 그 설정으로 경기한다.
const ON = { room: null, peers: [], my: {}, host: null, joinCode: null, acts: [], n: 0, seen: 0, q: [],
  cfg: Object.assign({ inn: 3, side: 1, night: 1, diff: 'pro' }, store.get('oncfg', {})) };
const r4 = (v) => Math.round(v * 1e4) / 1e4;
function hashSeed(a, b, c) { let h = (a ^ 0x9e3779b9) >>> 0; h = Math.imul(h ^ (b + 0x7f4a7c15), 2654435761) >>> 0; h = Math.imul(h ^ (c * 40503 + 17), 2246822519) >>> 0; return (h ^ (h >>> 15)) >>> 0; }
function onSeed(pi, tag) { return S.mulberry32(hashSeed(G.online.seed, pi, tag)); }

function pres(patch) {
  for (const k in patch) { if (patch[k] === null) delete ON.my[k]; else ON.my[k] = patch[k]; }
  if (!ON.room) return;
  ON.room.presence(patch).catch((e) => toast('연결 오류: ' + (e && e.code || '알 수 없음')));
}
const TAB = { cur: 'home', keys: ['home', 'season', 'online', 'roster', 'me'] }; // 홈 화면 탭 상태 (gzz_home.js)
const onlineVisible = () => !UI.title.hidden && TAB.cur === 'online';

/* ---------- 계정 + 서버 연결 (Render 등 자체 서버에 올렸을 때) ---------- */
const NET = { server: false, token: store.get('auth', null), user: null, hist: [], conn: false, busy: false, err: '', room: null };
async function api(path, body) {
  const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, NET.token ? { Authorization: 'Bearer ' + NET.token } : {}), body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) { /* JSON 아님 = 게임 서버가 아님 */ }
  if (!j) throw { msg: '게임 서버에 연결할 수 없어요 (정적 파일로 열었나요?)', code: r.status };
  if (!r.ok) throw { msg: j.error || '오류 ' + r.status, code: r.status };
  return j;
}
function setAuth(tok, user) {
  NET.token = tok; NET.user = user; store.set('auth', tok);
  if (!tok) { NET.hist = []; ON.host = null; ON.joinCode = null; if (NET.room) NET.room.close(); NET.room = null; ON.room = null; ON.peers = []; NET.conn = false; updateOnlineBadge(); }
}
async function refreshMe() {
  try { const j = await api('/api/me'); NET.user = j.user; NET.hist = j.hist || []; } catch (e) { if (e.code === 401) setAuth(null, null); }
  tabRefresh();
}
async function doAuth(kind, name, pw) {
  NET.busy = true; NET.err = ''; NET.name = name; tabRefresh();
  try {
    const j = await api('/api/' + kind, { name, pw });
    setAuth(j.token, j.user); toast((kind === 'signup' ? '가입 완료! ' : '') + j.user.name + ' 님 환영해요');
    connectRoom(); refreshMe();
  } catch (e) { NET.err = e.msg || '연결 실패'; }
  NET.busy = false; tabRefresh();
}
// 로그인·회원가입 폼 (온라인 탭, 내 정보 탭에서 같이 씀)
function renderAuth(B, intro) {
  B.innerHTML = `<p class="sub">${intro}</p>
    <form class="auth" autocomplete="on">
      <label>아이디<input class="auName" name="username" autocomplete="username" maxlength="12" value="${esc(NET.name || '')}" placeholder="2~12자 한글·영문·숫자" required></label>
      <label>비밀번호<input class="auPw" name="password" type="password" autocomplete="current-password" maxlength="64" placeholder="4자 이상" required></label>
      ${NET.err ? `<p class="err" role="alert">${esc(NET.err)}</p>` : ''}
      <div class="row2"><button class="mbtn primary" type="submit" ${NET.busy ? 'disabled' : ''}>로그인</button><button class="mbtn auSignup" type="button" ${NET.busy ? 'disabled' : ''}>회원가입</button></div>
      ${NET.busy ? '<p class="sub" style="margin:0">서버 응답 기다리는 중… (무료 서버는 자고 있으면 깨어나는 데 1분쯤 걸려요)</p>' : ''}
      <p class="fine" style="text-align:left;margin:4px 0 0">이메일·실명은 받지 않아요. 아이디, 암호화된 비밀번호, 대표 팀, 온라인 전적만 저장돼요.</p>
    </form>`;
  const f = B.querySelector('form'), go = (k) => {
    const n = f.querySelector('.auName').value.trim(), pw = f.querySelector('.auPw').value;
    if (!n || !pw) { NET.err = '아이디와 비밀번호를 입력해 주세요'; tabRefresh(); return; }
    doAuth(k, n, pw);
  };
  f.onsubmit = (e) => { e.preventDefault(); go('login'); };
  f.querySelector('.auSignup').onclick = () => go('signup');
}
function onlineResult(r) {
  if (!NET.server || !NET.token || !G.online || G.online.rec || !G.T) return;
  G.online.rec = 1;
  const me = G.T[G.userSide], op = G.T[1 - G.userSide];
  api('/api/result', { r, g: G.online.code + ':' + G.online.seed, my: me.runs, op: op.runs, team: me.idx, oteam: op.idx, oname: G.online.oname, inn: G.maxInn }).then(refreshMe, () => {});
}
// claude.ai room과 같은 모양(presence / onPeers)의 WebSocket 방
function makeNetRoom() {
  const peerId = 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  let ws = null, my = {}, map = new Map(), hs = [], retry = 0, closed = false, timer = 0;
  const me = () => ({ peer: peerId, isMe: true, name: NET.user && NET.user.name, presence: Object.freeze(Object.assign({}, my)) });
  const fire = () => { map.set(peerId, me()); const ps = [...map.values()]; hs.forEach((h) => h({ peers: ps })); };
  const put = (m) => { if (m.peer !== peerId) map.set(m.peer, { peer: m.peer, isMe: false, name: m.name, uid: m.uid, presence: Object.freeze(m.presence || {}) }); };
  function connect() {
    if (closed || (ws && ws.readyState < 2)) return;
    clearTimeout(timer);
    ws = new WebSocket(location.origin.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(NET.token) + '&peer=' + peerId);
    ws.onopen = () => { retry = 0; NET.conn = true; ws.send(JSON.stringify({ t: 'pres', patch: my, reset: 1 })); tabRefresh(); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.t === 'hello') { map.clear(); m.peers.forEach(put); fire(); }
      else if (m.t === 'peer') { put(m); fire(); }
      else if (m.t === 'leave') { map.delete(m.peer); fire(); }
    };
    ws.onclose = (e) => {
      NET.conn = false;
      if (e.code === 4001) { setAuth(null, null); toast('다시 로그인해 주세요', 3000); tabRefresh(); return; }
      if (closed) return;
      map.clear(); fire();
      timer = setTimeout(connect, Math.min(5000, 400 * 2 ** retry++));
      tabRefresh();
    };
  }
  setInterval(() => { if (ws && ws.readyState === 1) ws.send('{"t":"ping"}'); }, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !closed && (!ws || ws.readyState > 1)) { retry = 0; connect(); } });
  connect();
  return {
    presence: async (patch) => {
      for (const k in patch) { if (patch[k] === null) delete my[k]; else my[k] = patch[k]; }
      if (JSON.stringify(my).length > 7000) throw { code: 'too_big' };
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t: 'pres', patch }));
      map.set(peerId, me());
    },
    onPeers: (h) => { hs.push(h); fire(); return () => {}; },
    close: () => { closed = true; clearTimeout(timer); if (ws) ws.close(); },
  };
}
function useRoom(room) {
  ON.room = room;
  room.onPeers((ch) => { ON.peers = ch.peers; onRoomChange(); });
  pres(Object.assign({}, ON.my, { fc: 1 }));
  tabRefresh();
}
function connectRoom() {
  if (NET.room || !NET.token) return;
  NET.room = makeNetRoom(); useRoom(NET.room);
}
(async () => {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const room = await window.claude.use('room');
      if (room) { useRoom(room); return; }
    }
  } catch (e) { /* claude.ai 아님 */ }
  if (!/^https?:$/.test(location.protocol)) return;
  NET.server = true;
  if (NET.token) { await refreshMe(); if (NET.token) connectRoom(); }
  tabRefresh();
})();
function others() { return ON.peers.filter((p) => !p.isMe && p.presence && p.presence.fc === 1); }
function openRooms() { return others().filter((p) => p.presence.lob); }
function myRC() { return rosterCfgAll()[S.TEAMS[OPTS.me].id] || {}; }
function updateOnlineBadge() {
  const n = ON.room ? openRooms().length : 0, bd = $('#tab-online .badge2');
  if (bd) { bd.hidden = !n || TAB.cur === 'online'; bd.textContent = n; }
  const lv = $('#onLive'); if (lv) { lv.hidden = !ON.room || (NET.server && !NET.conn); $('#onLiveN').textContent = others().length + 1; }
}

/* ---------- 로비 UI (온라인 탭) ---------- */
const DIFF_NM = { rookie: '루키', pro: '프로', legend: '레전드' };
function cfgChips(c, hostView) {
  const side = c.side === 2 ? '홈/원정 랜덤' : hostView ? (c.side ? '방장 홈' : '방장 원정') : (c.side ? '내가 홈' : '내가 원정');
  return `<span class="chipset"><i>${c.inn}이닝</i><i>${side}</i><i>${c.night ? '🌙 야간' : '☀ 주간'}</i><i>판정 ${DIFF_NM[c.diff] || '프로'}</i></span>`;
}
function oseg(key, opts) {
  return `<div class="oseg" data-ok="${key}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(ON.cfg[key]) === String(v)}">${l}</button>`).join('')}</div>`;
}
function teamPickHTML(disabled) {
  return `<div class="tpick" role="radiogroup" aria-label="내 팀">${S.TEAMS.map((t, i) => {
    const fg = lum(t.c1) > 0.6 && lum(t.c2) > 0.6 ? '#111' : t.c2;
    return `<button type="button" role="radio" data-team="${i}" aria-checked="${i === OPTS.me}" ${disabled ? 'disabled' : ''} style="--tc:${t.c1};--tf:${fg}" title="${esc(t.city)} ${esc(t.name)}"><b>${esc(t.city)}</b></button>`;
  }).join('')}</div>`;
}
function renderOnline() {
  const B = $('#onBody'); if (!B) return;
  updateOnlineBadge();
  if (!NET.server && !ON.room) {
    B.innerHTML = `<div class="empty"><div class="big3">🌐</div><p class="sub">온라인 대전은 게임 서버(Render 등)에 올린 주소로 열었을 때만 돼요.</p></div>`;
    return;
  }
  if (NET.server && !NET.token) { renderAuth(B, '친구와 1:1로 붙으려면 로그인해 주세요. 처음이면 아이디·비밀번호를 정하고 <b>회원가입</b>을 누르면 돼요.'); return; }
  const acct = NET.user ? `<button class="acct" id="onAcct"><span class="av" style="--tc:${NET.user.fav != null ? S.TEAMS[NET.user.fav].c1 : 'var(--accent)'}">${esc(NET.user.name.slice(0, 1))}</span><span><b>${esc(NET.user.name)}</b> · 온라인 ${NET.user.w}승 ${NET.user.l}패${NET.user.d ? ' ' + NET.user.d + '무' : ''}</span><span class="go">내 정보 ›</span></button>` : '';
  if (!ON.room || (NET.server && !NET.conn)) {
    B.innerHTML = acct + `<div class="empty"><div class="spin"></div><p class="sub">서버에 연결하는 중… 무료 서버는 처음 깨어나는 데 1분쯤 걸릴 수 있어요.</p></div>`;
    bindOnline(B); return;
  }
  const me = S.TEAMS[OPTS.me];
  let h = acct;
  if (ON.host) {
    h += `<div class="waitcard"><div class="radar"><i></i><i></i><i></i><span class="badge" style="background:${me.c1};color:${lum(me.c1) > 0.6 ? '#111' : me.c2}">${esc(me.city)}</span></div>
      <div class="wt">방 <b>${ON.host}</b> · 친구를 기다리는 중</div>${cfgChips(ON.cfg, true)}
      <p class="sub" style="margin:8px 0 0">친구가 이 주소로 들어와서 <b>온라인</b> 탭의 열린 방을 누르면 바로 시작돼요.</p>
      <div class="row2" style="margin-top:10px"><button class="mbtn" id="onInvite">📤 친구 초대</button><button class="mbtn" id="onCancel">방 닫기</button></div></div>`;
  } else if (ON.joinCode) {
    h += `<div class="waitcard"><div class="spin"></div><div class="wt">방 ${esc(ON.joinCode)} 참가 요청 중…</div><p class="sub" style="margin:4px 0 0">방장 쪽에서 곧 시작돼요.</p><button class="mbtn" id="onCancel">취소</button></div>`;
  } else {
    const rooms = openRooms();
    h += `<div class="rhead">열린 방 ${rooms.length ? `<span class="cnt">${rooms.length}</span>` : ''}</div>`;
    if (!rooms.length) h += `<div class="empty sm"><p class="sub" style="margin:0">아직 열린 방이 없어요. 아래에서 방을 만들거나, 친구가 만들 때까지 기다려 주세요.</p></div>`;
    h += '<div class="plist">';
    rooms.forEach((p) => {
      const L = p.presence.lob, t = S.TEAMS[L.team] || me, same = L.team === OPTS.me;
      const fg = lum(t.c1) > 0.6 ? '#111' : t.c2;
      h += `<button class="roomcard" data-join="${esc(String(L.code))}" ${same ? 'disabled' : ''}>
        <span class="badge sm" style="background:${t.c1};color:${fg}">${esc(t.city)}</span>
        <span class="rc-main"><b>${p.name ? esc(p.name) + '의 방' : '방 ' + esc(String(L.code))}</b><small>${esc(t.city)} ${esc(t.name)}</small>${cfgChips({ inn: L.inn, side: L.side === 2 ? 2 : 1 - L.side, night: L.night, diff: L.diff }, false)}
        ${same ? '<small class="warn">같은 팀이라 참가 불가 — 아래에서 내 팀을 바꿔 주세요</small>' : ''}</span>
        <span class="rc-go">${same ? '' : '참가 ›'}</span></button>`;
    });
    h += '</div>';
    h += `<div class="rhead">내 팀 <span style="font-weight:500">· ${esc(me.city)} ${esc(me.name)}</span></div>${teamPickHTML(false)}`;
    h += `<div class="rhead">방 만들기 <span style="font-weight:500">· 내가 정한 설정으로 경기해요</span></div>
      <div class="ocfg">
        <div class="opt"><span>이닝</span>${oseg('inn', [[3, '3회'], [5, '5회'], [9, '9회']])}</div>
        <div class="opt"><span>내 위치</span>${oseg('side', [[0, '원정'], [1, '홈'], [2, '랜덤']])}</div>
        <div class="opt"><span>경기</span>${oseg('night', [[1, '야간'], [0, '주간']])}</div>
        <div class="opt"><span>판정</span>${oseg('diff', [['rookie', '루키'], ['pro', '프로'], ['legend', '레전드']])}</div>
      </div>
      <button class="cta" id="onHost" style="font-size:20px;min-height:52px">방 만들기</button>`;
    const os = others();
    if (os.length) h += `<div class="rhead">지금 접속 중</div><div class="who">${os.map((p) => `<span><i></i>${esc(p.name || '손님')}${p.presence.g ? ' <small>경기 중</small>' : p.presence.lob ? ' <small>방 대기</small>' : ''}</span>`).join('')}</div>`;
  }
  B.innerHTML = h;
  bindOnline(B);
}
function bindOnline(B) {
  const on = (id, fn) => { const e = B.querySelector(id); if (e) e.onclick = fn; };
  on('#onAcct', () => showTab('me'));
  on('#onHost', () => {
    ON.host = String(1000 + Math.floor(Math.random() * 9000));
    const c = ON.cfg; store.set('oncfg', c);
    pres({ lob: { code: ON.host, team: OPTS.me, side: c.side, inn: c.inn, night: c.night, diff: c.diff } });
    renderOnline(); AU.click();
  });
  on('#onCancel', () => { ON.host = null; ON.joinCode = null; pres({ lob: null, join: null }); renderOnline(); });
  on('#onInvite', async () => {
    const url = location.origin + location.pathname, text = `풀카운트 3D 1:1 하자! 온라인 탭에서 방 ${ON.host} 눌러서 들어와`;
    try { if (navigator.share) { await navigator.share({ title: '풀카운트 3D', text, url }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(text + '\n' + url); toast('초대 문구를 복사했어요. 메신저에 붙여 넣어 보내세요'); } catch (e) { toast(url); }
  });
  B.querySelectorAll('[data-join]').forEach((b) => (b.onclick = () => {
    ON.joinCode = b.dataset.join; pres({ join: { code: ON.joinCode, team: OPTS.me, rc: myRC() } }); renderOnline(); AU.click();
  }));
  B.querySelectorAll('.oseg').forEach((sg) => sg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const k = sg.dataset.ok; ON.cfg[k] = k === 'diff' ? b.dataset.v : +b.dataset.v; store.set('oncfg', ON.cfg);
    sg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); AU.click();
  }));
  B.querySelectorAll('[data-team]').forEach((b) => (b.onclick = () => {
    const i = +b.dataset.team; OPTS.me = i; if (OPTS.opp === i) OPTS.opp = (i + 1) % 10;
    store.set('opts', OPTS); renderTitle(); renderOnline(); AU.click();
  }));
}
function onRoomChange() {
  const os = others();
  updateOnlineBadge();
  if (!G.online) {
    if (ON.host) {
      const g = os.find((p) => p.presence.join && String(p.presence.join.code) === ON.host);
      if (g) {
        const j = g.presence.join, c = ON.cfg;
        const hs = c.side === 2 ? (Math.random() < 0.5 ? 1 : 0) : c.side;
        const go = { code: ON.host, seed: (Math.random() * 2147483647) | 0, hs, inn: c.inn, ht: OPTS.me, gt: j.team, rh: myRC(), rg: j.rc || {}, diff: c.diff, night: c.night };
        ON.host = null; pres({ lob: null, go });
        beginOnline(go, true, g.peer);
        return;
      }
    }
    if (ON.joinCode) {
      const h = os.find((p) => p.presence.go && String(p.presence.go.code) === ON.joinCode);
      if (h) { const go = h.presence.go; ON.joinCode = null; beginOnline(go, false, h.peer); return; }
      if (!os.some((p) => p.presence.lob && String(p.presence.lob.code) === ON.joinCode)) { ON.joinCode = null; pres({ join: null }); toast('방이 닫혔어요'); }
    }
    if (onlineVisible()) renderOnline();
    return;
  }
  const P = os.find((p) => p.peer === G.online.peer);
  if (!P) { if (!G.online.lost) { G.online.lost = clock; toast('상대 연결이 끊겼어요… 30초 기다려 볼게', 3000); } return; }
  if (G.online.lost) { G.online.lost = 0; toast('상대가 다시 연결됐어요'); }
  // 정리: 상대가 게임에 들어오면 시작 정보 삭제
  if (G.online.host && P.presence.g === G.online.code && ON.my.go) pres({ go: null });
  if (!G.online.host && ON.my.join) pres({ join: null });
  const acts = Array.isArray(P.presence.acts) && P.presence.g === G.online.code ? P.presence.acts : [];
  acts.forEach((a) => {
    if (!a || typeof a.n !== 'number' || a.n <= ON.seen) return;
    if (a.n !== ON.seen + 1) { onlineFail('통신이 밀려서 경기가 어긋났어요'); return; }
    ON.seen = a.n; ON.q.push(a);
  });
}
function beginOnline(go, host, peer) {
  const op = ON.peers.find((p) => p.peer === peer);
  G.online = { host, peer, code: String(go.code), seed: go.seed >>> 0, pi: 0, lost: 0, oname: op && op.name ? String(op.name) : null };
  ON.acts = []; ON.n = 0; ON.seen = 0; ON.q = [];
  pres({ acts: [], g: G.online.code });
  const mySide = host ? go.hs : 1 - go.hs;
  const me = host ? go.ht : go.gt, opp = host ? go.gt : go.ht;
  G.onlineRC = {}; G.onlineRC[S.TEAMS[go.ht].id] = go.rh || {}; G.onlineRC[S.TEAMS[go.gt].id] = go.rg || {};
  GR = S.mulberry32(G.online.seed);
  if (go.night != null) applyTime(!!go.night);
  toast(`온라인 경기 시작! 상대: ${G.online.oname ? G.online.oname + ' · ' : ''}${S.TEAMS[opp].city} ${S.TEAMS[opp].name}`, 2500);
  startGame({ me, opp, home: mySide === 1, inn: go.inn, online: true, diff: DIFF[go.diff] ? go.diff : OPTS.diff });
}
function sendAct(a) {
  if (!G.online) return;
  a.n = ++ON.n; ON.acts.push(a);
  if (ON.acts.length > 8) ON.acts.shift();
  pres({ acts: ON.acts.slice() });
}
function onlineFail(msg) {
  if (!G.online) return;
  toast(msg, 3500);
  endOnline(); quitToTitle();
}
function endOnline() {
  if (!G.online) return;
  G.online = null; G.onlineRC = null; GR = Math.random; ON.q = [];
  pres({ acts: null, g: null, go: null, join: null, lob: null });
}
// 매 프레임: 받은 행동 처리
function onlineTick() {
  if (!G.online || !G.T) return;
  if (G.online.lost && clock - G.online.lost > 30) { onlineFail('상대가 돌아오지 않아서 경기를 끝냈어요'); return; }
  const a = ON.q[0]; if (!a) { waitHint(); return; }
  if (a.k === 'quit') { ON.q.shift(); onlineResult('win'); onlineFail('상대가 경기를 나갔어요 (기권승)'); return; }
  if (a.k === 'sw') {
    const P = G.pitch;
    if (!P || P.pi < a.pi) return; // 아직 그 공을 안 던짐
    if (P.pi > a.pi) { ON.q.shift(); return; }
    if (G.phase === 'windup') return;
    ON.q.shift();
    P.remoteIn = true;
    if (a.take) P.cpu = { swing: false };
    else P.cpu = { swing: true, contact: !a.miss, bunt: !!a.bunt, foul: !!a.foul, ev: a.ev, la: a.la, phi: a.phi, q: a.q, st: a.st, tl: a.tl };
    return;
  }
  // 투수 쪽 행동 → 내가 타자이고 대기 상태일 때 적용
  if (!userBatting() || G.phase !== 'ready' || !G.awaitPitch) { waitHint(); return; }
  ON.q.shift();
  if (a.k === 'p') windup(a.t, { x: a.x, y: a.y }, a.m == null ? null : a.m);
  else if (a.k === 'pcv') { showFeedback([['상대 투수 피치클락 위반', 'bad'], ['자동 볼', 'm']], 1500); G.lastDirt = false; G.pendingWP = null; call('ball'); }
  else if (a.k === 'ibb') { G.phase = 'call'; hideDocks(); showCall('고의4구', '#37d67a', 1200); toast(`상대가 ${curBatter().name} 고의4구`); walk('IBB'); }
  else if (a.k === 'pc') {
    const tm = fieldTeam(), p = tm.ros.bullpen.concat(tm.ros.rotation).find((x) => x.key === a.key);
    if (p && !tm.used.includes(p)) { changePitcher(tm, p, true); toast(`상대 투수 교체: ${p.name}`); }
  }
}
let _hintAt = 0;
function waitHint() {
  if (!G.online || !G.T || clock - _hintAt < 2.5) return;
  const P = G.pitch;
  if (userBatting() && G.phase === 'ready') { _hintAt = clock; showPlayText('상대 투수가 공을 고르는 중…', 2000); }
  else if (userPitching() && P && P.released && !P.remoteIn && P.ft / P.pt.dur >= 1) { _hintAt = clock; showPlayText('상대 타자 반응 기다리는 중…', 2000); }
}
