// 풀카운트 3D 서버 — 정적 파일 + 회원가입/로그인 + 실시간 방(WebSocket)
// 게임 쪽 온라인 코드는 "각자 presence(작은 JSON)를 올리고, 모두의 presence를 받는" 구조라서
// 서버는 판정 없이 presence만 중계한다. (경기 계산은 두 기기가 같은 시드로 똑같이 함)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const { openStore } = require('./store');

const PORT = process.env.PORT || 8000;
const DIST = path.join(__dirname, '..', 'dist');
let SECRET = process.env.SECRET;
if (!SECRET) {
  SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('[주의] SECRET 환경변수가 없어서 임시 키를 씀 — 서버가 재시작되면 모두 다시 로그인해야 해요');
}

/* ---------- 토큰 (HMAC 서명, 서버 재시작해도 SECRET만 같으면 유지) ---------- */
const b64 = (s) => Buffer.from(s).toString('base64url');
function sign(user) {
  const body = b64(JSON.stringify({ id: user.id, name: user.name, exp: Date.now() + 30 * 864e5 }));
  return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
}
function verify(tok) {
  if (typeof tok !== 'string') return null;
  const [body, mac] = tok.split('.');
  if (!body || !mac) return null;
  const want = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (mac.length !== want.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch (e) { return null; }
}

/* ---------- 비밀번호 (scrypt) ---------- */
function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPw(pw, stored) {
  const [s, h] = String(stored).split(':');
  if (!s || !h) return false;
  const got = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 32), want = Buffer.from(h, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

/* ---------- 로그인 시도 제한 (IP당 10분에 20번) ---------- */
const tries = new Map();
function limited(ip) {
  const now = Date.now(), t = (tries.get(ip) || []).filter((x) => now - x < 600e3);
  t.push(now); tries.set(ip, t);
  return t.length > 20;
}

/* ---------- HTTP ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((ok, bad) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 1e4) { bad(new Error('too big')); req.destroy(); } });
    req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { bad(e); } });
  });
}
const userOut = (u) => ({ id: u.id, name: u.name, w: u.w | 0, l: u.l | 0, d: u.d | 0 });
const NAME_RE = /^[0-9A-Za-z가-힣_]{2,12}$/;

async function api(req, res, store) {
  const url = req.url.split('?')[0];
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  if (req.method === 'POST' && (url === '/api/signup' || url === '/api/login')) {
    if (limited(ip)) return send(res, 429, { error: '시도가 너무 많아요. 10분 뒤에 다시 해 주세요' });
    let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { error: '잘못된 요청' }); }
    const name = String(b.name || '').trim(), pw = String(b.pw || '');
    if (url === '/api/signup') {
      if (!NAME_RE.test(name)) return send(res, 400, { error: '아이디는 2~12자 한글·영문·숫자·_ 만 돼요' });
      if (pw.length < 4 || pw.length > 64) return send(res, 400, { error: '비밀번호는 4~64자로 해 주세요' });
      if (await store.byName(name)) return send(res, 409, { error: '이미 있는 아이디예요' });
      const u = await store.create(name, hashPw(pw));
      return send(res, 200, { token: sign(u), user: userOut(u) });
    }
    const u = await store.byName(name);
    if (!u || !checkPw(pw, u.pw)) return send(res, 401, { error: '아이디 또는 비밀번호가 틀렸어요' });
    return send(res, 200, { token: sign(u), user: userOut(u) });
  }
  const auth = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
  if (!auth) return send(res, 401, { error: '로그인이 필요해요' });
  if (req.method === 'GET' && url === '/api/me') {
    const u = await store.byId(auth.id);
    return u ? send(res, 200, { user: userOut(u) }) : send(res, 401, { error: '계정을 찾을 수 없어요' });
  }
  if (req.method === 'POST' && url === '/api/result') {
    let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { error: '잘못된 요청' }); }
    const r = { win: 'w', lose: 'l', draw: 'd' }[b.r];
    if (!r) return send(res, 400, { error: '잘못된 결과' });
    // 같은 경기 결과를 두 번 올리지 않게 (경기 코드 + 시드 기준)
    const key = auth.id + ':' + String(b.g || '').slice(0, 40);
    if (seenResults.has(key)) return send(res, 200, { ok: 1 });
    seenResults.add(key); if (seenResults.size > 5000) seenResults.clear();
    await store.addResult(auth.id, r);
    return send(res, 200, { ok: 1 });
  }
  send(res, 404, { error: '없는 주소' });
}
const seenResults = new Set();

function serveStatic(req, res) {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.normalize(path.join(DIST, p));
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': p === '/index.html' ? 'no-cache' : 'public, max-age=86400' });
  fs.createReadStream(f).pipe(res);
}

/* ---------- 실시간 방 ---------- */
// peer id는 브라우저 탭마다 하나 (재접속해도 유지) → 잠깐 끊겼다 돌아와도 같은 사람으로 봄
const peers = new Map(); // peer -> { ws, uid, name, presence }
const peerOut = (peer, P) => ({ peer, name: P.name, uid: P.uid, presence: P.presence });
function broadcast(obj, except) {
  const s = JSON.stringify(obj);
  for (const [id, P] of peers) if (id !== except && P.ws.readyState === 1) P.ws.send(s);
}
function onConnection(ws, req) {
  const q = new URL(req.url, 'http://x').searchParams;
  const auth = verify(q.get('token'));
  if (!auth) { ws.close(4001, 'auth'); return; }
  const peer = String(q.get('peer') || '').replace(/[^\w-]/g, '').slice(0, 40);
  if (!peer) { ws.close(4002, 'peer'); return; }
  const old = peers.get(peer);
  if (old && old.uid !== auth.id) { ws.close(4003, 'peer taken'); return; }
  if (old) { old.ws.removeAllListeners('close'); try { old.ws.close(4000, 'replaced'); } catch (e) { /* */ } }
  const P = { ws, uid: auth.id, name: auth.name, presence: old ? old.presence : {} };
  peers.set(peer, P);
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.send(JSON.stringify({ t: 'hello', me: peer, peers: [...peers].map(([id, x]) => peerOut(id, x)) }));
  broadcast({ t: 'peer', ...peerOut(peer, P) }, peer);
  ws.on('message', (raw) => {
    ws.isAlive = true;
    if (raw.length > 8192) return;
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'ping') return ws.send('{"t":"pong"}');
    if (m.t !== 'pres' || !m.patch || typeof m.patch !== 'object') return;
    const pr = m.reset ? {} : Object.assign({}, P.presence);
    for (const k in m.patch) { if (m.patch[k] === null) delete pr[k]; else pr[k] = m.patch[k]; }
    P.presence = pr;
    broadcast({ t: 'peer', ...peerOut(peer, P) }, peer);
  });
  ws.on('close', () => {
    if (peers.get(peer) !== P) return;
    peers.delete(peer);
    broadcast({ t: 'leave', peer });
  });
}

(async () => {
  const store = await openStore();
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api/')) api(req, res, store).catch((e) => { console.error(e); send(res, 500, { error: '서버 오류' }); });
    else if (req.url === '/healthz') { res.writeHead(200); res.end('ok'); }
    else serveStatic(req, res);
  });
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16384 });
  wss.on('connection', onConnection);
  // 죽은 연결 정리 (모바일에서 앱 전환 등)
  setInterval(() => {
    wss.clients.forEach((ws) => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); });
  }, 20000);
  server.listen(PORT, () => console.log('풀카운트 3D 서버: http://localhost:' + PORT));
})();
