/* ===================== 온라인 1:1 (room presence 기반 락스텝) ===================== */
// 원리: 두 기기가 같은 시드로 같은 계산을 하고, 사람의 선택(투구/스윙/작전)만 주고받는다.
const ON = { room: null, peers: [], my: {}, host: null, joinCode: null, acts: [], n: 0, seen: 0, q: [], ui: false };
const r4 = (v) => Math.round(v * 1e4) / 1e4;
function hashSeed(a, b, c) { let h = (a ^ 0x9e3779b9) >>> 0; h = Math.imul(h ^ (b + 0x7f4a7c15), 2654435761) >>> 0; h = Math.imul(h ^ (c * 40503 + 17), 2246822519) >>> 0; return (h ^ (h >>> 15)) >>> 0; }
function onSeed(pi, tag) { return S.mulberry32(hashSeed(G.online.seed, pi, tag)); }

function pres(patch) {
  for (const k in patch) { if (patch[k] === null) delete ON.my[k]; else ON.my[k] = patch[k]; }
  if (!ON.room) return;
  ON.room.presence(patch).catch((e) => toast('연결 오류: ' + (e && e.code || '알 수 없음')));
}

/* ---------- 계정 + 서버 연결 (Render 등 자체 서버에 올렸을 때) ---------- */
const NET = { server: false, token: store.get('auth', null), user: null, conn: false, busy: false, err: '', room: null };
async function api(path, body) {
  const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, NET.token ? { Authorization: 'Bearer ' + NET.token } : {}), body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (e) { /* JSON 아님 = 게임 서버가 아님 */ }
  if (!j) throw { msg: '게임 서버에 연결할 수 없어요 (정적 파일로 열었나요?)', code: r.status };
  if (!r.ok) throw { msg: j.error || '오류 ' + r.status, code: r.status };
  return j;
}
function setAuth(tok, user) {
  NET.token = tok; NET.user = user; store.set('auth', tok);
  if (!tok) { if (NET.room) NET.room.close(); NET.room = null; ON.room = null; ON.peers = []; }
}
async function refreshMe() {
  try { NET.user = (await api('/api/me')).user; } catch (e) { if (e.code === 401) setAuth(null, null); }
  if (ON.ui) renderOnline();
}
async function doAuth(kind, name, pw) {
  NET.busy = true; NET.err = ''; NET.name = name; renderOnline();
  try {
    const j = await api('/api/' + kind, { name, pw });
    setAuth(j.token, j.user); toast((kind === 'signup' ? '가입 완료! ' : '') + j.user.name + ' 님 환영해요');
    connectRoom();
  } catch (e) { NET.err = e.msg || '연결 실패'; }
  NET.busy = false; renderOnline();
}
function onlineResult(r) {
  if (!NET.server || !NET.token || !G.online || G.online.rec) return;
  G.online.rec = 1;
  api('/api/result', { r, g: G.online.code + ':' + G.online.seed }).then(refreshMe, () => {});
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
    ws.onopen = () => { retry = 0; NET.conn = true; ws.send(JSON.stringify({ t: 'pres', patch: my, reset: 1 })); if (ON.ui) renderOnline(); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.t === 'hello') { map.clear(); m.peers.forEach(put); fire(); }
      else if (m.t === 'peer') { put(m); fire(); }
      else if (m.t === 'leave') { map.delete(m.peer); fire(); }
    };
    ws.onclose = (e) => {
      NET.conn = false;
      if (e.code === 4001) { setAuth(null, null); toast('로그인이 만료됐어요. 다시 로그인해 주세요', 3000); if (ON.ui) renderOnline(); return; }
      if (closed) return;
      map.clear(); fire();
      timer = setTimeout(connect, Math.min(5000, 400 * 2 ** retry++));
      if (ON.ui) renderOnline();
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
  if (ON.ui) renderOnline();
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
})();
function others() { return ON.peers.filter((p) => !p.isMe && p.presence && p.presence.fc === 1); }
function myRC() { return rosterCfgAll()[S.TEAMS[OPTS.me].id] || {}; }

/* ---------- 로비 UI ---------- */
function openOnline() { ON.ui = true; renderOnline(); openModal('#onModal'); }
function renderOnline() {
  const B = $('#onBody'); if (!B) return;
  const me = S.TEAMS[OPTS.me];
  if (NET.server && !NET.token) {
    B.innerHTML = `<p class="sub">친구와 대전하려면 로그인해 주세요. 처음이면 아이디·비밀번호를 정하고 <b>회원가입</b>을 누르면 돼요.</p>
      <form class="auth" id="authForm" autocomplete="on">
        <label>아이디<input id="auName" name="username" autocomplete="username" maxlength="12" value="${esc(NET.name || '')}" placeholder="2~12자 한글·영문·숫자" required></label>
        <label>비밀번호<input id="auPw" name="password" type="password" autocomplete="current-password" maxlength="64" placeholder="4자 이상" required></label>
        ${NET.err ? `<p class="err" role="alert">${esc(NET.err)}</p>` : ''}
        <div class="row2"><button class="mbtn primary" type="submit" id="auLogin" ${NET.busy ? 'disabled' : ''}>로그인</button><button class="mbtn" type="button" id="auSignup" ${NET.busy ? 'disabled' : ''}>회원가입</button></div>
      </form>`;
    const f = $('#authForm'), go = (k) => { const n = $('#auName').value.trim(), pw = $('#auPw').value; if (!n || !pw) { NET.err = '아이디와 비밀번호를 입력해 주세요'; renderOnline(); return; } doAuth(k, n, pw); };
    f.onsubmit = (e) => { e.preventDefault(); go('login'); };
    $('#auSignup').onclick = () => go('signup');
    if (NET.busy) B.insertAdjacentHTML('beforeend', '<p class="sub">서버 응답 기다리는 중… (무료 서버는 자고 있으면 깨어나는 데 1분쯤 걸려요)</p>');
    return;
  }
  const acct = NET.server && NET.user ? `<div class="acct"><span>👤 <b>${esc(NET.user.name)}</b> · 온라인 ${NET.user.w}승 ${NET.user.l}패${NET.user.d ? ' ' + NET.user.d + '무' : ''}</span><button class="linkbtn" id="auOut">로그아웃</button></div>` : '';
  if (!ON.room || (NET.server && !NET.conn)) {
    B.innerHTML = NET.server ? acct + `<p class="sub">서버에 연결하는 중… 무료 서버는 처음 깨어나는 데 1분쯤 걸릴 수 있어요.</p>` : `<p class="sub">온라인 대전은 게임 서버(Render 등)에 올린 주소로 열었을 때만 돼요.</p>`;
    bindOut();
    return;
  }
  let h = acct + `<p class="sub">내 팀: <b>${esc(me.city)} ${esc(me.name)}</b> · ${OPTS.inn}이닝 · ${OPTS.home ? '홈(후공)' : '원정(선공)'}<br><span style="font-size:12px">팀·이닝·홈/원정은 시작 화면에서 바꾸고 와. 방장 설정으로 경기해.</span></p>`;
  if (ON.host) {
    h += `<div class="pcard" style="cursor:default"><b>방 코드 ${ON.host}</b><span class="role">대기 중</span><span class="r">친구가 이 게임을 열고 "온라인 1:1"에서 이 방의 참가를 누르면 바로 시작돼요.</span></div><button class="mbtn" id="onCancel">방 닫기</button>`;
  } else if (ON.joinCode) {
    h += `<div class="pcard" style="cursor:default"><b>방 ${ON.joinCode} 참가 요청 중…</b><span class="r">방장 쪽에서 곧 시작돼요.</span></div><button class="mbtn" id="onCancel">취소</button>`;
  } else {
    h += `<button class="mbtn primary" id="onHost">방 만들기</button><div class="rhead">열린 방</div>`;
    const rooms = others().filter((p) => p.presence.lob);
    if (!rooms.length) h += `<p class="sub">아직 열린 방이 없어요. 친구가 방을 만들면 여기 떠요.</p>`;
    rooms.forEach((p) => {
      const L = p.presence.lob, t = S.TEAMS[L.team] || me, same = L.team === OPTS.me;
      h += `<button class="pcard" data-join="${esc(String(L.code))}" data-peer="${esc(p.peer)}" ${same ? 'disabled' : ''}><b>${p.name ? esc(p.name) + '의 방' : '방 ' + esc(String(L.code))} · ${esc(t.city)} ${esc(t.name)}</b><span class="role">${L.home ? '방장 홈' : '방장 원정'}</span><span class="r">${L.inn}이닝${same ? ' · 같은 팀이라 참가 불가 (시작 화면에서 내 팀 변경)' : ' · 눌러서 참가'}</span></button>`;
    });
  }
  h += `<p class="sub" style="margin-top:10px">지금 접속: ${others().length + 1}명</p>`;
  B.innerHTML = h;
  bindOut();
  const hb = $('#onHost'); if (hb) hb.onclick = () => { ON.host = String(1000 + Math.floor(Math.random() * 9000)); pres({ lob: { code: ON.host, team: OPTS.me, home: OPTS.home, inn: OPTS.inn } }); renderOnline(); AU.click(); };
  const cb = $('#onCancel'); if (cb) cb.onclick = () => { ON.host = null; ON.joinCode = null; pres({ lob: null, join: null }); renderOnline(); };
  B.querySelectorAll('[data-join]').forEach((b) => (b.onclick = () => {
    ON.joinCode = b.dataset.join; pres({ join: { code: ON.joinCode, team: OPTS.me, rc: myRC() } }); renderOnline(); AU.click();
  }));
}
function bindOut() {
  const o = $('#auOut'); if (o) o.onclick = () => { if (G.online) return toast('경기 중엔 로그아웃할 수 없어요'); ON.host = null; ON.joinCode = null; setAuth(null, null); renderOnline(); };
}
function onRoomChange() {
  const os = others();
  if (!G.online) {
    if (ON.host) {
      const g = os.find((p) => p.presence.join && String(p.presence.join.code) === ON.host);
      if (g) {
        const j = g.presence.join;
        const go = { code: ON.host, seed: (Math.random() * 2147483647) | 0, hs: OPTS.home ? 1 : 0, inn: OPTS.inn, ht: OPTS.me, gt: j.team, rh: myRC(), rg: j.rc || {}, diff: OPTS.diff };
        ON.host = null; pres({ lob: null, go });
        beginOnline(go, true, g.peer);
        return;
      }
    }
    if (ON.joinCode) {
      const h = os.find((p) => p.presence.go && String(p.presence.go.code) === ON.joinCode);
      if (h) { const go = h.presence.go; ON.joinCode = null; beginOnline(go, false, h.peer); return; }
    }
    if (ON.ui && !$('#onModal').hidden) renderOnline();
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
  G.online = { host, peer, code: String(go.code), seed: go.seed >>> 0, pi: 0, lost: 0 };
  ON.acts = []; ON.n = 0; ON.seen = 0; ON.q = []; ON.ui = false;
  pres({ acts: [], g: G.online.code });
  const mySide = host ? go.hs : 1 - go.hs;
  const me = host ? go.ht : go.gt, opp = host ? go.gt : go.ht;
  G.onlineRC = {}; G.onlineRC[S.TEAMS[go.ht].id] = go.rh || {}; G.onlineRC[S.TEAMS[go.gt].id] = go.rg || {};
  GR = S.mulberry32(G.online.seed);
  closeModal('#onModal');
  const op = ON.peers.find((p) => p.peer === peer), on = op && op.name ? op.name + ' · ' : '';
  toast(`온라인 경기 시작! 상대: ${on}${S.TEAMS[opp].city} ${S.TEAMS[opp].name}`, 2500);
  startGame({ me, opp, home: mySide === 1, inn: go.inn, online: true });
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
$('#onlineBtn').addEventListener('click', () => { AU.click(); openOnline(); });
$('#onClose').addEventListener('click', () => { ON.ui = false; closeModal('#onModal'); });

