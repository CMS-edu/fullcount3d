/* ===================== 채팅 (온라인 경기 중 1:1 · 온라인 탭 로비) ===================== */
// 서버(WebSocket)가 있을 때만 됨. 경기 채팅은 락스텝(acts)과 완전히 별개라 경기 진행에 영향 없음.
const CHAT = { lobby: [], game: [], open: false, unread: 0 };
const QUICK = ['👍', '🔥', '😂', '😱', '👏', 'ㅋㅋㅋ', '나이스!', '와 대박', '아 ㅠㅠ', '빨리 던져', 'GG'];
const chatOK = () => !!(ON.room && ON.room.chat);
const isMine = (m) => !!(ON.room && m.from && m.from === ON.room.peerId);
const hhmm = (t) => { const d = new Date(t); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const emojiOnly = (s) => s.length <= 8 && /\p{Extended_Pictographic}/u.test(s) && /^[\p{Extended_Pictographic}\p{Emoji_Component}‍️\s]+$/u.test(s);
const wideChat = () => matchMedia('(min-width: 1100px) and (min-height: 600px)').matches;

function msgHTML(m) {
  if (m.sys) return `<div class="cm sys"><span>${esc(m.text)}</span></div>`;
  const me = isMine(m);
  return `<div class="cm${me ? ' me' : ''}${emojiOnly(m.text) ? ' emo' : ''}">${me ? '' : `<b>${esc(m.name || '?')}</b>`}<span>${esc(m.text)}</span><time>${hhmm(m.at)}</time></div>`;
}
function renderList(el, list, empty) {
  if (!el) return;
  el.innerHTML = list.map(msgHTML).join('') || `<div class="cm sys"><span>${empty}</span></div>`;
  el.scrollTop = el.scrollHeight;
}
function sendChat(ch, text) {
  text = String(text || '').trim();
  if (!text) return false;
  if (!chatOK()) { toast('채팅은 게임 서버에 연결됐을 때만 돼요'); return false; }
  if (ch === 'game' && !G.online) return false;
  const extra = ch === 'game' ? { to: G.online.peer, g: G.online.code } : null;
  if (!ON.room.chat(ch, text, extra)) { toast('연결이 끊겨서 못 보냈어요. 잠시 뒤 다시 보내 주세요'); return false; }
  return true;
}
// 서버에서 온 메시지 (hist = 접속할 때 받는 로비 기록)
function onChatMsg(m) {
  if (m.hist) { CHAT.lobby = m.hist.slice(-30); renderLobbyChat(); return; }
  if (m.ch === 'lobby') {
    CHAT.lobby.push(m); if (CHAT.lobby.length > 60) CHAT.lobby.shift();
    renderLobbyChat();
    if (!isMine(m) && onlineVisible()) AU.pop();
    return;
  }
  // 경기 채팅: 지금 경기의 상대(또는 나)가 보낸 것만
  if (!G.online || (!isMine(m) && m.from !== G.online.peer) || (m.g && m.g !== G.online.code)) return;
  CHAT.game.push(m); if (CHAT.game.length > 80) CHAT.game.shift();
  renderGameChat();
  if (!isMine(m)) {
    AU.pop();
    if ($('#chatBox').hidden) { CHAT.unread++; updateChatBtn(); chatBubble(m); }
  }
}

/* ---------- 경기 중 채팅 ---------- */
function renderGameChat() { if (!$('#chatBox').hidden) renderList($('#chatList'), CHAT.game, ''); }
function updateChatBtn() {
  const bd = $('#chatBtn .badge2'); if (!bd) return;
  bd.hidden = !CHAT.unread; bd.textContent = CHAT.unread > 9 ? '9+' : CHAT.unread;
}
function applyChatOpen() {
  $('#chatBox').hidden = !CHAT.open;
  $('#chatBtn').setAttribute('aria-expanded', String(CHAT.open));
  if (CHAT.open) { CHAT.unread = 0; renderGameChat(); $('#chatBubble').classList.remove('show'); }
  updateChatBtn();
}
function chatBubble(m) {
  const el = $('#chatBubble');
  el.innerHTML = `<b>${esc(m.name || '상대')}</b>${esc(m.text)}`;
  el.classList.remove('show'); void el.offsetWidth; flashEl(el, 'show', 3500, 'chatb');
}
function chatGameStart() {
  CHAT.game = [{ sys: 1, text: `${G.online.oname || '상대'}님과 경기 시작! 인사해 보세요 👋` }];
  CHAT.unread = 0;
  $('#chatBtn').hidden = !chatOK();
  $('#chatWho').textContent = G.online.oname ? `vs ${G.online.oname}` : '';
  CHAT.open = chatOK() && wideChat(); // 넓은 화면(PC)은 경기 옆에 처음부터 펼쳐 둠
  applyChatOpen();
}
function chatGameEnd() {
  CHAT.open = false; CHAT.unread = 0;
  $('#chatBtn').hidden = true; $('#chatBox').hidden = true; $('#chatBubble').classList.remove('show');
  const i = $('#chatIn'); if (document.activeElement === i) i.blur();
}
$('#chatQuick').innerHTML = QUICK.map((q) => `<button type="button" class="qc">${q}</button>`).join('');
$('#chatQuick').addEventListener('click', (e) => { const b = e.target.closest('.qc'); if (b) sendChat('game', b.textContent); });
$('#chatForm').addEventListener('submit', (e) => { e.preventDefault(); const i = $('#chatIn'); if (sendChat('game', i.value)) i.value = ''; });
$('#chatIn').addEventListener('keydown', (e) => {
  e.stopPropagation(); // 채팅 치는 동안 게임 단축키(스페이스 = 스윙 등) 막기
  if (e.key === 'Escape') { e.target.blur(); CHAT.open = false; applyChatOpen(); }
});
$('#chatBtn').addEventListener('click', () => {
  CHAT.open = !CHAT.open; applyChatOpen(); AU.click();
  if (CHAT.open && !isTouch) $('#chatIn').focus();
});
$('#chatX').addEventListener('click', () => { CHAT.open = false; applyChatOpen(); });
$('#chatBubble').addEventListener('click', () => { CHAT.open = true; applyChatOpen(); });

/* ---------- 온라인 탭 로비 채팅 ---------- */
function renderLobbyChat() {
  const box = $('#onChat'); if (!box) return;
  box.hidden = !chatOK() || (NET.server && !NET.conn);
  if (!box.hidden) renderList($('#lobbyList'), CHAT.lobby.slice(-30), '아직 메시지가 없어요. 먼저 인사해 보세요!');
}
$('#lobbyForm').addEventListener('submit', (e) => { e.preventDefault(); const i = $('#lobbyIn'); if (sendChat('lobby', i.value)) i.value = ''; });
$('#lobbyIn').addEventListener('keydown', (e) => e.stopPropagation());
