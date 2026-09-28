/* ===================== UI ===================== */
const UI = {
  title: $('#title'), hud: $('#hud'), call: $('#call'), banner: $('#banner'), feedback: $('#feedback'), playText: $('#playText'), toast: $('#toast'),
  dockBat: $('#dockBat'), dockPit: $('#dockPit'), pad: $('#pad'), padCanvas: $('#pad canvas'), meter: $('#meter'), needle: $('#meter .needle'),
  tracker: $('#tracker'), batLine: $('#batLine'), pitLine: $('#pitLine'), speedBox: $('#speedBox'), speedV: $('#speedV'), speedT: $('#speedT'),
  skip: $('#skipBtn'), bunt: $('#buntBtn'), steal: $('#stealBtn'), pitchBtns: $('#pitchBtns'), stam: $('#stamBar'),
};
const timersUI = {};
function flashEl(el, cls, ms, key) {
  clearTimeout(timersUI[key]); el.classList.add(cls);
  if (ms) timersUI[key] = setTimeout(() => el.classList.remove(cls), ms);
}
function showCall(html, color, ms = 1100) { UI.call.innerHTML = html; UI.call.style.color = color || '#fff'; UI.call.classList.remove('show'); void UI.call.offsetWidth; flashEl(UI.call, 'show', ms, 'call'); }
function showBanner(big, small, ms = 1800) {
  UI.banner.querySelector('.big').textContent = big; UI.banner.querySelector('.small').textContent = small || '';
  UI.banner.classList.remove('show'); void UI.banner.offsetWidth; flashEl(UI.banner, 'show', ms, 'banner');
}
function hideBanner() { UI.banner.classList.remove('show'); }
function showFeedback(parts, ms = 1300) {
  UI.feedback.innerHTML = parts.map((p) => `<span class="${p[1]}">${p[0]}</span>`).join('');
  flashEl(UI.feedback, 'show', ms, 'fb');
}
function showPlayText(t, ms = 2400) { UI.playText.textContent = t; flashEl(UI.playText, 'show', ms, 'pt'); }
function toast(t, ms = 2200) { UI.toast.textContent = t; flashEl(UI.toast, 'show', ms, 'toast'); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const fmtAvg = (v) => (v >= 1 ? v.toFixed(3) : v.toFixed(3).slice(1));

/* ---------- 스코어 버그 ---------- */
function updateBug() {
  if (!G.T) return;
  const rows = [$('#rowA'), $('#rowH')];
  G.T.forEach((tm, i) => {
    const r = rows[i];
    r.querySelector('i').style.background = tm.t.c1;
    r.querySelector('b').textContent = tm.t.city;
    r.querySelector('.sc').textContent = tm.runs;
    r.classList.toggle('bat', G.half === i && G.phase !== 'over');
  });
  $('#innAr').textContent = G.half === 0 ? '▲' : '▼';
  $('#innN').textContent = G.inning;
  const bs = $$('.bug-bases i');
  bs[0].classList.toggle('on', !!G.bases[1]); bs[1].classList.toggle('on', !!G.bases[2]); bs[2].classList.toggle('on', !!G.bases[0]);
  const on = (sel, n) => $$(sel).forEach((el, k) => el.classList.toggle('on', k < n));
  on('.bug-count .bb i', G.b); on('.bug-count .ss i', G.s); on('.bug-count .oo i', G.outs);
}
function updateLines() {
  const bt = batTeam(), ft = fieldTeam(), b = curBatter(), p = ft.pitcher;
  if (!b || !p) return;
  const today = b.g.pa ? `${b.g.ab}타수 ${b.g.h}안타${b.g.hr ? ` ${b.g.hr}홈런` : ''}` : '첫 타석';
  UI.batLine.innerHTML = `${avatarHTML(b, 'xs')}<span class="k">타자</span><b>${bt.order + 1}번 ${esc(b.name)}</b><span class="m">${b.posK} · ${b.hand === 'L' ? '좌' : '우'}타</span><span>${fmtAvg(b.avg)} ${b.hr}HR</span><span class="${b.g.h ? 'hot' : 'm'}">${today}</span>`;
  const fat = S.fatigueOf(p, p.g.pc);
  UI.pitLine.innerHTML = `${avatarHTML(p, 'xs')}<span class="k">투수</span><b>${esc(p.name)}</b><span class="m">${p.hand === 'L' ? '좌' : '우'}투 · ERA ${p.era.toFixed(2)}</span><span class="${fat > 0.5 ? 'hot' : ''}">${p.g.pc}구</span>`;
  if (UI.stam) UI.stam.style.width = Math.round((1 - fat) * 100) + '%';
  UI.stam.style.background = fat > 0.6 ? '#ff4b4b' : fat > 0.3 ? '#ffc93c' : '#37d67a';
}

// 핫존 색: 리그 평균 대비 타율 차이 d (+면 빨강 = 강함, -면 파랑 = 약함)
function heatCol(d, max) { const a = Math.min(max || 0.85, Math.abs(d) * 5 + 0.08); return d >= 0 ? `rgba(255,64,64,${a.toFixed(2)})` : `rgba(64,140,255,${a.toFixed(2)})`; }
// 타자 성향 글: "당겨 47% · 밀어 22% · 땅볼 52%"
function tendText(b) { return b.spray ? `당겨 ${Math.round(b.spray[0] * 100)}% · 밀어 ${Math.round(b.spray[2] * 100)}% · 땅볼 ${Math.round(b.gb * 100)}%` : ''; }
// 작은 핫존 (포수 시점: 우타자는 몸쪽이 왼쪽)
function miniHeat(b) {
  if (!b.tz) return '';
  const cols = b.hand === 'R' ? [0, 1, 2] : [2, 1, 0];
  return `<div class="hz" aria-hidden="true">${[0, 1, 2].map((r) => cols.map((c) => { const i = r * 3 + c; return `<i style="background:${heatCol(b.tz[i][2] - BAT_LG.cells[i][2])}"></i>`; }).join('')).join('')}</div>`;
}
// 실제 구종 구사율 글: "직구 48% · 슬라이더 27% · 포크 15%"
function mixText(p, n) { return p.mix ? p.mix.slice(0, n || 6).map(([t, sh]) => { const g = mvTag(p, t); return `${S.PITCHES[t].name} ${Math.round(sh * 100)}%${g ? `(${g})` : ''}`; }).join(' · ') : ''; }
// 리그 평균보다 눈에 띄게 움직이는 공에 붙이는 말 (가로: 팔 쪽 +, 세로: 위 +, 단위 인치)
function mvTag(p, t) {
  const d = p.mvIn && p.mvIn[t]; if (!d) return '';
  const [h, v] = d, run = t === 'FB' || t === 'TS' || t === 'CH';
  if (t === 'FB' && v >= 1.8) return '솟아오름';
  if ((t === 'FK' || t === 'CH' || t === 'CB') && v <= -2) return '뚝 떨어짐';
  if (run ? h >= 2.5 : h <= -2.5) return '많이 휨';
  return '';
}
// 타석에 들어서는 타자 / 새로 올라온 투수 소개 카드 (사진 + 기록)
function playerCard(pl, tm, pit) {
  const el = $('#pcard'); if (!el || !pl || !tm) return;
  const role = pit ? `${pl.role === 'SP' ? '선발' : pl.role === 'CL' ? '마무리' : '불펜'} · ${pl.hand === 'L' ? '좌' : '우'}투${armSlotName(pl) ? ' ' + armSlotName(pl) : ''}` : `${tm.order + 1}번 타자 · ${pl.posK || ''} · ${pl.hand === 'L' ? '좌' : '우'}타`;
  const stat = pit ? `ERA ${pl.era.toFixed(2)} · ${Math.round(pl.ip)}이닝 · ${pl.k}K` : `타율 ${fmtAvg(pl.avg)} · ${pl.hr}홈런 · OPS ${(pl.obp + pl.slg).toFixed(3)}`;
  const today = !pit && pl.g && pl.g.pa ? `<span class="hot">오늘 ${pl.g.ab}타수 ${pl.g.h}안타${pl.g.hr ? ` ${pl.g.hr}홈런` : ''}</span>` : '';
  const cr = photoCredit(pl);
  el.style.setProperty('--tc', tm.t.c1);
  const mix = pit && pl.mix ? `<span class="mixl">${mixText(pl, 4)}</span>` : !pit && pl.spray ? `<span class="mixl">${tendText(pl)}</span>` : '';
  el.innerHTML = `${avatarHTML(pl, 'md')}<div class="pc-t"><small>${esc(tm.t.city)}${pl.num ? ' · #' + esc(pl.num) : ''} · ${role}</small><b>${esc(pl.name)}</b><span>${stat}</span>${mix}${today}${cr ? `<em>${cr}</em>` : ''}</div>${pit ? '' : miniHeat(pl)}`;
  el.classList.remove('show'); void el.offsetWidth; flashEl(el, 'show', 2900, 'pcard');
}

/* ---------- 투구 트래커 ---------- */
function drawTracker() {
  const c = UI.tracker, g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const b = curBatter(); if (!b) return;
  const z = S.zoneOf(b.height);
  // 월드 → 캔버스: 포수 시점(x 그대로), 사용자가 투수면 투수 시점(x 반전)
  const flip = userPitching() ? -1 : 1;
  const sx = (x) => W / 2 + flip * x * (W / 1.0), sy = (y) => H - 14 - (y - 0.25) * ((H - 26) / 1.2);
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2;
  g.strokeRect(sx(-z.half * flip), sy(z.top), (z.half * 2 * W) / 1.0, sy(z.bot) - sy(z.top));
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
  for (let k = 1; k < 3; k++) {
    const xx = sx(-z.half * flip) + (k * z.half * 2 * W) / 3; g.beginPath(); g.moveTo(xx, sy(z.top)); g.lineTo(xx, sy(z.bot)); g.stroke();
    const yy = sy(z.top) + (k * (sy(z.bot) - sy(z.top))) / 3; g.beginPath(); g.moveTo(sx(-z.half * flip), yy); g.lineTo(sx(z.half * flip), yy); g.stroke();
  }
  // 홈플레이트
  g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(sx(-0.216) - (flip < 0 ? 0.432 * W : 0), H - 8, 0.432 * W, 4);
  G.pitchLog.forEach((p, i) => {
    const col = p.res === 'ball' ? '#37d67a' : p.res === 'play' ? '#5aa9ff' : '#ffc93c';
    g.fillStyle = col; g.beginPath(); g.arc(sx(p.x), sy(p.y), 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0b1535'; g.font = `bold 11px ${FONT_UI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), sx(p.x), sy(p.y) + 0.5);
  });
}

/* ---------- 전광판 ---------- */
function drawBoard() {
  const g = board.small.getContext('2d'), W = 256, H = 96;
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (!G.T) { g.fillStyle = '#ffb627'; g.font = `bold 26px ${FONT_DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('풀카운트 3D', W / 2, 40); g.font = `bold 11px ${FONT_UI}`; g.fillStyle = '#7fe3ff'; g.fillText('오늘도 야구장으로!', W / 2, 68); blitBoard(); return; }
  if (board.flash > 0 && board.msg) {
    const on = Math.floor(board.flash * 4) % 2 === 0;
    g.fillStyle = on ? '#ffb627' : '#ff4b4b'; g.font = `bold 40px ${FONT_DISP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(board.msg, W / 2, 40);
    g.font = `bold 12px ${FONT_UI}`; g.fillStyle = '#fff'; g.fillText(board.sub || '', W / 2, 76);
    blitBoard(); return;
  }
  const cols = G.limitInn, x0 = 50, cw = Math.min(13, (W - x0 - 52) / cols);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold 9px ${FONT_UI}`; g.fillStyle = '#9ba7d9';
  for (let i = 0; i < cols; i++) g.fillText(String(i + 1), x0 + cw * i + cw / 2, 7);
  const rx = x0 + cw * cols + 4;
  ['R', 'H', 'E', 'B'].forEach((k, j) => g.fillText(k, rx + j * 12 + 6, 7));
  G.T.forEach((tm, r) => {
    const y = 19 + r * 13;
    g.fillStyle = tm.t.c1; g.fillRect(2, y - 5, 4, 10);
    g.fillStyle = '#fff'; g.font = `bold 11px ${FONT_UI}`; g.textAlign = 'left'; g.fillText(tm.t.city, 9, y + 0.5); g.textAlign = 'center';
    g.font = `bold 10px ${FONT_UI}`;
    for (let i = 0; i < cols; i++) {
      const v = tm.line[i];
      g.fillStyle = v == null ? '#333' : '#ffb627';
      if (v != null) g.fillText(String(v), x0 + cw * i + cw / 2, y + 0.5);
    }
    g.fillStyle = '#ffffff'; g.fillText(String(tm.runs), rx + 6, y + 0.5); g.fillStyle = '#ffb627'; g.fillText(String(tm.hits), rx + 18, y + 0.5); g.fillText(String(tm.err || 0), rx + 30, y + 0.5); g.fillText(String(tm.bb), rx + 42, y + 0.5);
  });
  g.fillStyle = '#2a2a2a'; g.fillRect(0, 40, W, 1);
  const b = curBatter(), p = fieldTeam().pitcher;
  if (b && p) {
    g.textAlign = 'left'; g.font = `bold 11px ${FONT_UI}`;
    g.fillStyle = '#7fe3ff'; g.fillText('타자', 4, 51); g.fillStyle = '#fff'; g.fillText(`${batTeam().order + 1} ${b.name}`, 30, 51);
    g.fillStyle = '#ffb627'; g.fillText(`${fmtAvg(b.avg)}  ${b.hr}HR`, 150, 51);
    g.fillStyle = '#7fe3ff'; g.fillText('투수', 4, 65); g.fillStyle = '#fff'; g.fillText(p.name, 30, 65);
    g.fillStyle = '#ffb627'; g.fillText(`${p.g.pc}구`, 150, 65);
  }
  const dots = (lbl, n, max, col, x) => {
    g.fillStyle = '#9ba7d9'; g.font = `bold 10px ${FONT_UI}`; g.fillText(lbl, x, 84);
    for (let i = 0; i < max; i++) { g.fillStyle = i < n ? col : '#262626'; g.beginPath(); g.arc(x + 12 + i * 9, 84, 3.4, 0, Math.PI * 2); g.fill(); }
  };
  dots('B', G.b, 3, '#37d67a', 4); dots('S', G.s, 2, '#ffc93c', 50); dots('O', G.outs, 2, '#ff4b4b', 88);
  if (G.lastSpeed) { g.fillStyle = '#fff'; g.font = `bold 14px ${FONT_DISP}`; g.textAlign = 'right'; g.fillText(`${Math.round(G.lastSpeed)} km/h`, W - 6, 84); }
  blitBoard();
}
function boardFlash(msg, sub, sec = 4) { board.msg = msg; board.sub = sub; board.flash = sec; }

/* ---------- 투구 버튼 ---------- */
function buildPitchButtons() {
  const p = fieldTeam().pitcher;
  UI.pitchBtns.innerHTML = '';
  p.pitches.forEach((k, i) => {
    const b = document.createElement('button'); b.className = 'pbtn'; b.dataset.k = k;
    const kmh = Math.round(p.spd && p.spd[k] ? p.spd[k] : p.vel * S.PITCHES[k].ratio), mx = p.mix && p.mix.find((x) => x[0] === k);
    b.innerHTML = `<b>${S.PITCHES[k].name}</b><span>${kmh}km/h${mx ? ` · ${Math.round(mx[1] * 100)}%` : ''}</span>`;
    b.setAttribute('aria-pressed', String(k === G.selType)); b.setAttribute('aria-label', `${S.PITCHES[k].name} 선택 (단축키 ${i + 1})`);
    b.addEventListener('click', () => { selectPitchType(k); AU.click(); });
    UI.pitchBtns.appendChild(b);
  });
}
function selectPitchType(k) { G.selType = k; $$('.pbtn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.k === k))); drawPad(); }

/* ---------- 존 패드 (투수 시점: 화면 오른쪽 = 월드 -x) ---------- */
const PAD = { wM: 0.95, yTop: 0, yBot: 0 };
function padMap() {
  const z = S.zoneOf(curBatter().height);
  PAD.yTop = z.top + 0.34; PAD.yBot = z.bot - 0.34; PAD.z = z;
  return z;
}
function drawPad(sel) {
  const c = UI.padCanvas, g = c.getContext('2d'), W = c.width, H = c.height;
  const z = padMap();
  const X = (x) => W / 2 - (x / PAD.wM) * W, Y = (y) => ((PAD.yTop - y) / (PAD.yTop - PAD.yBot)) * H;
  g.clearRect(0, 0, W, H);
  // 타자 실루엣 쪽 표시
  const b = curBatter(), bx = b.hand === 'R' ? -1 : 1; // 타자 위치(월드 x 부호)
  g.fillStyle = 'rgba(255,255,255,0.08)'; const sxp = X(bx * 0.72); g.fillRect(Math.min(sxp, X(bx * 0.47)), 0, Math.abs(X(bx * 0.72) - X(bx * 0.47)) + 20, H);
  g.fillStyle = 'rgba(255,255,255,0.55)'; g.font = `bold 20px ${FONT_UI}`; g.textAlign = 'center'; g.fillText(b.hand === 'R' ? '우타' : '좌타', X(bx * 0.62), 24);
  // 존
  const x0 = X(z.half), x1 = X(-z.half), y0 = Y(z.top), y1 = Y(z.bot);
  g.fillStyle = 'rgba(255,201,60,0.12)'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  // 타자 핫존 (실제 기록): 칸마다 이 타자의 타율 — 리그 같은 칸 평균보다 높으면 빨강(강함), 낮으면 파랑(약함)
  if (b.tz) {
    const xs = [z.half, z.half / 3, -z.half / 3, -z.half]; // 몸쪽(타자 쪽)부터 칸 경계, bx를 곱해서 월드 x로
    g.textAlign = 'center'; g.font = `bold 21px ${FONT_UI}`;
    for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) {
      const i = r * 3 + col, avg = b.tz[i][2], d = avg - BAT_LG.cells[i][2];
      const xa = X(bx * xs[col]), xb = X(bx * xs[col + 1]), ya = Y(z.top - ((z.top - z.bot) * r) / 3), yb = Y(z.top - ((z.top - z.bot) * (r + 1)) / 3);
      const L = Math.min(xa, xb), wd = Math.abs(xb - xa);
      g.fillStyle = heatCol(d, 0.62); g.fillRect(L, ya, wd, yb - ya);
      g.fillStyle = 'rgba(255,255,255,0.93)'; g.fillText(fmtAvg(avg), L + wd / 2, (ya + yb) / 2 + 7);
    }
  }
  const cap = $('#pad .cap'); if (cap) cap.textContent = b.tz ? '코스 탭 · 빨강 = 이 타자가 강한 곳' : '코스를 탭하세요';
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 1.5;
  for (let k = 1; k < 3; k++) {
    g.beginPath(); g.moveTo(x0 + ((x1 - x0) * k) / 3, y0); g.lineTo(x0 + ((x1 - x0) * k) / 3, y1); g.stroke();
    g.beginPath(); g.moveTo(x0, y0 + ((y1 - y0) * k) / 3); g.lineTo(x1, y0 + ((y1 - y0) * k) / 3); g.stroke();
  }
  // 구종 브레이크 힌트
  const pk = S.PITCHES[G.selType || 'FB'], ha = Math.abs(pk.arm);
  const how = pk.drop > 0.2 ? '떨어짐' : ha > 0.3 ? '크게 휘어짐' : ha > 0.12 ? '휘어짐' : ha > 0.07 ? '살짝 휘어짐' : '빠름';
  g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = `bold 18px ${FONT_UI}`; g.textAlign = 'center';
  g.fillText(`${pk.name} · ${how}`, W / 2, H - 12);
  const t = sel || G.aimTarget;
  if (t) {
    g.strokeStyle = '#37d67a'; g.lineWidth = 4; g.beginPath(); g.arc(X(t.x), Y(t.y), 16, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#37d67a'; g.beginPath(); g.arc(X(t.x), Y(t.y), 4, 0, Math.PI * 2); g.fill();
  }
}
// 타격 시점 존의 핫·콜드 존: 투수 패드와 같은 색(빨강 = 이 타자가 강한 코스, 파랑 = 약한 코스).
// 캔버스는 타자(포수) 시점이라 우타자는 몸쪽이 왼쪽. 공이 날아오는 동안에는 숫자를 빼고 색만 남김
function drawZoneHeat(nums) {
  const Z = zoneGuide, b = G.T ? curBatter() : null;
  Z.heat.visible = !!(b && b.tz && G.heatOn);
  if (!Z.heat.visible) return;
  if (nums == null) nums = G.phase !== 'flight';
  const c = Z.heatCanvas, g = c.getContext('2d'), W = c.width, H = c.height, cw = W / 3, ch = H / 3;
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(8,12,22,0.62)'; g.fillRect(0, 0, W, H); // 잔디·흙 위에서도 빨강·파랑이 탁해지지 않게 옅은 어두운 바탕
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold 36px ${FONT_UI}`;
  g.shadowColor = 'rgba(0,0,0,0.65)';
  for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) {
    const i = r * 3 + col, avg = b.tz[i][2], d = avg - BAT_LG.cells[i][2];
    const x = (b.hand === 'R' ? col : 2 - col) * cw, y = r * ch;
    g.shadowBlur = 0; g.fillStyle = heatCol(d * 1.25, 0.75); g.fillRect(x, y, cw, ch);
    if (nums) { g.shadowBlur = 6; g.fillStyle = 'rgba(255,255,255,0.92)'; g.fillText(fmtAvg(avg), x + cw / 2, y + ch / 2 + 2); }
  }
  Z.heatNums = nums; Z.heatTex.needsUpdate = true;
}
function padToWorld(ev) {
  const r = UI.padCanvas.getBoundingClientRect();
  const fx = clamp((ev.clientX - r.left) / r.width, 0, 1), fy = clamp((ev.clientY - r.top) / r.height, 0, 1);
  return { x: (0.5 - fx) * PAD.wM, y: PAD.yTop - fy * (PAD.yTop - PAD.yBot) };
}

/* ---------- 타이틀 ---------- */
const OPTS = Object.assign({ me: 0, opp: 1, home: 1, inn: 3, diff: 'rookie', time: matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day' }, store.get('opts', {}));
function recOf(i) { const r = store.get('rec', {})[S.TEAMS[i].id]; return r || { w: 0, l: 0, d: 0 }; }
function badgeStyle(el, t) { el.style.background = t.c1; el.style.color = lum(t.c1) > 0.6 && lum(t.c2) > 0.6 ? '#111' : t.c2; el.textContent = t.city; }
// 화면 전체를 내 팀 색으로: 팀 색이 너무 어두우면(검정·짙은 남색) 밝고 선명하게 바꿔서 씀
function vividOf(t, lo, hi) {
  const hsl = {}, c = new T.Color(t.c1); c.getHSL(hsl);
  if (hsl.s < 0.2) { c.set(t.c2); c.getHSL(hsl); } // 무채색(KT 검정 등)이면 보조색
  c.setHSL(hsl.h, Math.max(hsl.s, 0.6), clamp(hsl.l, lo, hi));
  return c;
}
function applyTeamTheme(me, opp) {
  const st = document.documentElement.style, W = new T.Color('#ffffff');
  const hex = (c) => '#' + c.getHexString(), rgb = (c) => [c.r, c.g, c.b].map((x) => Math.round(x * 255)).join(', ');
  const v = vividOf(me, 0.36, 0.52), br = vividOf(me, 0.6, 0.68), o = vividOf(opp, 0.36, 0.52);
  const set = { '--team': hex(v), '--team-dk': hex(v.clone().multiplyScalar(0.55)), '--team-lt2': hex(v.clone().lerp(W, 0.35)), '--team-rgb': rgb(v),
    '--team-ink': lum(hex(v)) > 0.62 ? '#151a33' : '#ffffff', '--team-br': hex(br), '--team-br-hi': hex(br.clone().lerp(W, 0.25)), '--team-br-rgb': rgb(br),
    '--team-br-ink': lum(hex(br)) > 0.55 ? '#151a33' : '#ffffff', '--opp': hex(o), '--opp-dk': hex(o.clone().multiplyScalar(0.55)) };
  for (const k in set) st.setProperty(k, set[k]);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = set['--team-dk']; // 폰 브라우저 윗줄 색
}
function renderTitle() {
  if (OPTS.opp === OPTS.me) OPTS.opp = (OPTS.me + 1) % 10;
  const tm = S.TEAMS[OPTS.me], to = S.TEAMS[OPTS.opp];
  applyTeamTheme(tm, to);
  const tick = `${tm.city} ${tm.name}  VS  ${to.city} ${to.name}   ·   ${OPTS.inn}이닝 ${OPTS.time === 'night' ? '야간' : '주간'} 경기   ·   ${OPTS.home ? '홈에서 후공' : '원정 선공'}   ·   오늘도 풀카운트!`;
  $('#tickA').textContent = tick; $('#tickB').textContent = tick;
  badgeStyle($('#badgeMe'), tm); badgeStyle($('#badgeOpp'), to);
  $('#nameMe').textContent = `${tm.city} ${tm.name}`; $('#nameOpp').textContent = `${to.city} ${to.name}`;
  const r = recOf(OPTS.me); $('#recMe').textContent = `${r.w}승 ${r.l}패 ${r.d}무`;
  $$('#pane-home .seg').forEach((sg) => { const k = sg.dataset.opt; sg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(String(OPTS[k]) === b.dataset.v))); });
  const all = store.get('rec', {}); let w = 0, l = 0, d = 0; Object.values(all).forEach((x) => { w += x.w; l += x.l; d += x.d; });
  $('#recAll').textContent = w + l + d ? `통산 ${w}승 ${l}패 ${d}무` : '첫 경기를 시작해 보세요';
  applyTime(OPTS.time === 'night');
  paintCrowd(OPTS.home ? tm : to, OPTS.home ? to : tm); paintLed(OPTS.home ? tm : to, OPTS.home ? to : tm);
}
$$('.arrow[data-pick]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.pick, d = +b.dataset.d;
  let v = OPTS[k];
  do { v = (v + d + 10) % 10; } while (v === (k === 'me' ? OPTS.opp : OPTS.me));
  OPTS[k] = v; renderTitle(); AU.click();
  const el = k === 'me' ? $('#badgeMe') : $('#badgeOpp'); el.style.transform = 'scale(1.08)'; setTimeout(() => (el.style.transform = ''), 140);
}));
$$('#pane-home .seg').forEach((sg) => sg.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const k = sg.dataset.opt, v = b.dataset.v;
  OPTS[k] = k === 'inn' || k === 'home' ? +v : v; renderTitle(); AU.click();
}));
$('#howBtn').addEventListener('click', () => { const h = $('#howto'); h.hidden = !h.hidden; $('#howBtn').setAttribute('aria-expanded', String(!h.hidden)); $('#howBtn').textContent = h.hidden ? '조작법 보기' : '조작법 닫기'; });

