/* ===================== 홈 화면 탭 (경기 · 시즌 · 온라인 · 구단 · 내 정보) ===================== */
const TAB_ENTER = {
  home: () => renderTitle(),
  season: () => { seaLoad(); renderSeason(); },
  online: () => renderOnline(),
  roster: () => { if (!ED.base) edLoad(OPTS.me); renderRoster(); },
  me: () => renderMe(),
};
function showTab(k, quiet) {
  if (!TAB_ENTER[k]) k = 'home';
  if (TAB.cur === 'roster' && k !== 'roster' && ED.dirty) edSave();
  if (TAB.cur === 'season' && k !== 'season') simBusy = false;
  const changed = TAB.cur !== k;
  TAB.cur = k; store.set('tab', k);
  TAB.keys.forEach((x) => {
    $('#pane-' + x).hidden = x !== k;
    $('#tab-' + x).setAttribute('aria-selected', String(x === k));
  });
  if (changed) $('#panes').scrollTop = 0;
  TAB_ENTER[k]();
  updateOnlineBadge();
  if (!quiet && changed) AU.click();
}
// 로그인 상태·접속 상태가 바뀌면 지금 보고 있는 탭만 다시 그림 (입력 중인 폼은 건드리지 않게 온라인/내 정보만)
function tabRefresh() {
  updateOnlineBadge();
  if (UI.title.hidden) return;
  if (TAB.cur === 'online') renderOnline();
  else if (TAB.cur === 'me') renderMe();
}
$$('.tabbar .tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('.tabbar').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const i = TAB.keys.indexOf(TAB.cur), n = TAB.keys[(i + (e.key === 'ArrowRight' ? 1 : TAB.keys.length - 1)) % TAB.keys.length];
  showTab(n); $('#tab-' + n).focus();
});

/* ---------- 내 정보 ---------- */
const ME = { pwOpen: false, delOpen: false, msg: '', err: '' };
const fmtDate = (t) => { const d = new Date(t); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
function localRec() {
  const all = store.get('rec', {}); let w = 0, l = 0, d = 0;
  Object.values(all).forEach((x) => { w += x.w; l += x.l; d += x.d; });
  return { w, l, d };
}
function pct(w, l) { return w + l ? (w / (w + l)).toFixed(3).replace(/^0/, '') : '-'; }
function renderMe() {
  const B = $('#meBody'); if (!B) return;
  const lr = localRec();
  const offline = `<div class="rhead">이 기기 기록 (혼자 하기 · 시즌)</div>
    <div class="stats" style="margin-top:0"><div><b>${lr.w}</b>승</div><div><b>${lr.l}</b>패</div><div><b>${pct(lr.w, lr.l)}</b>승률</div></div>`;
  if (!NET.server) { B.innerHTML = `<p class="sub">계정 기능은 게임 서버 주소로 열었을 때 쓸 수 있어요.</p>` + offline; return; }
  if (!NET.token) { renderAuth(B, '로그인하면 온라인 전적과 최근 경기가 계정에 저장돼요.'); B.insertAdjacentHTML('beforeend', offline); return; }
  const u = NET.user;
  if (!u) { B.innerHTML = `<div class="empty"><div class="spin"></div><p class="sub">계정 정보를 불러오는 중…</p></div>`; return; }
  const fav = u.fav != null ? S.TEAMS[u.fav] : null, g = u.w + u.l + u.d;
  let h = `<div class="prof">
      <span class="av big" style="--tc:${fav ? fav.c1 : 'var(--accent)'};--tf:${fav ? (lum(fav.c1) > 0.6 ? '#111' : fav.c2) : 'var(--accent-ink)'}">${esc(u.name.slice(0, 1))}</span>
      <div><div class="pn">${esc(u.name)}</div><div class="pm">${fav ? `${esc(fav.city)} ${esc(fav.name)} 팬 · ` : ''}${u.created ? fmtDate(u.created) + ' 가입' : ''}</div></div>
      <span class="live" title="${NET.conn ? '온라인' : '연결 끊김'}"><i style="${NET.conn ? '' : 'background:#aab;animation:none'}"></i>${NET.conn ? '온라인' : '오프라인'}</span>
    </div>
    <div class="rhead">온라인 전적</div>
    <div class="stats stats4" style="margin-top:0"><div><b>${g}</b>경기</div><div><b>${u.w}</b>승</div><div><b>${u.l}</b>패</div><div><b>${pct(u.w, u.l)}</b>승률</div></div>`;
  h += `<div class="rhead">최근 온라인 경기</div>`;
  if (!NET.hist.length) h += `<div class="empty sm"><p class="sub" style="margin:0">아직 경기가 없어요. <b>온라인</b> 탭에서 친구와 붙어 보세요!</p></div>`;
  else h += `<div class="hist">${NET.hist.slice(0, 10).map((m) => {
    const t = S.TEAMS[m.team] || null, o = S.TEAMS[m.oteam] || null, R = { w: ['승', 'w'], l: ['패', 'l'], d: ['무', 'd'] }[String(m.r).trim()] || ['-', 'd'];
    return `<div class="hrow"><span class="res ${R[1]}">${R[0]}</span><span class="hm"><b>vs ${esc(m.oname || '상대')}</b><small>${t ? esc(t.city) : '?'} ${m.my != null ? m.my : '-'} : ${m.op != null ? m.op : '-'} ${o ? esc(o.city) : '?'}${m.inn ? ` · ${m.inn}이닝` : ''}</small></span><span class="hd">${m.at ? fmtDate(m.at).slice(5) : ''}</span></div>`;
  }).join('')}</div>`;
  h += `<div class="rhead">대표 팀 <span style="font-weight:500">· 프로필 색으로 쓰여요</span></div>
    <div class="tpick" id="favPick">${S.TEAMS.map((t, i) => `<button type="button" data-fav="${i}" aria-checked="${u.fav === i}" role="radio" style="--tc:${t.c1};--tf:${lum(t.c1) > 0.6 && lum(t.c2) > 0.6 ? '#111' : t.c2}" title="${esc(t.city)} ${esc(t.name)}"><b>${esc(t.city)}</b></button>`).join('')}</div>`;
  h += `<div class="rhead">계정 · 보안</div>
    <div class="setlist">
      <button class="setrow" id="meRefresh"><span>🔄 전적 새로고침</span><span>›</span></button>
      <button class="setrow" id="mePwT" aria-expanded="${ME.pwOpen}"><span>🔑 비밀번호 변경</span><span>${ME.pwOpen ? '⌃' : '›'}</span></button>
      ${ME.pwOpen ? `<form class="auth inset" id="mePw"><input type="text" name="username" autocomplete="username" value="${esc(u.name)}" hidden>
        <label>현재 비밀번호<input type="password" id="mePwOld" autocomplete="current-password" maxlength="64" required></label>
        <label>새 비밀번호<input type="password" id="mePwNew" autocomplete="new-password" maxlength="64" placeholder="4자 이상" required></label>
        <button class="mbtn primary" type="submit">변경하기</button></form>` : ''}
      <button class="setrow" id="meOut"><span>🚪 로그아웃</span><span>›</span></button>
      <button class="setrow danger" id="meDelT" aria-expanded="${ME.delOpen}"><span>⚠ 회원 탈퇴</span><span>${ME.delOpen ? '⌃' : '›'}</span></button>
      ${ME.delOpen ? `<form class="auth inset" id="meDel"><p class="sub" style="margin:0">계정과 온라인 전적이 모두 지워지고 되돌릴 수 없어요. 이 기기의 혼자 하기 기록은 남아요.</p>
        <label>비밀번호 확인<input type="password" id="meDelPw" autocomplete="current-password" maxlength="64" required></label>
        <button class="mbtn danger" type="submit" id="meDelGo">탈퇴하기</button></form>` : ''}
    </div>
    ${ME.err ? `<p class="err" role="alert" style="color:#d33;font-weight:700;font-size:13px">${esc(ME.err)}</p>` : ''}
    <p class="fine" style="text-align:left">저장되는 정보: 아이디, 암호화된 비밀번호(원문은 서버도 몰라요), 대표 팀, 온라인 전적과 최근 ${20}경기. 이메일·전화번호·실명은 받지 않아요.</p>`;
  B.innerHTML = h + offline;
  const on = (id, fn) => { const e = B.querySelector(id); if (e) e.onclick = fn; };
  on('#meRefresh', () => { refreshMe(); toast('새로고침했어요'); });
  on('#mePwT', () => { ME.pwOpen = !ME.pwOpen; ME.delOpen = false; ME.err = ''; renderMe(); });
  on('#meDelT', () => { ME.delOpen = !ME.delOpen; ME.pwOpen = false; ME.err = ''; renderMe(); });
  on('#meOut', () => { if (G.online) return toast('경기 중엔 로그아웃할 수 없어요'); setAuth(null, null); ME.pwOpen = ME.delOpen = false; toast('로그아웃했어요'); renderMe(); });
  B.querySelectorAll('[data-fav]').forEach((b) => (b.onclick = async () => {
    const i = +b.dataset.fav, v = u.fav === i ? null : i;
    try { NET.user = (await api('/api/profile', { fav: v })).user; renderMe(); AU.click(); } catch (e) { toast(e.msg || '저장 실패'); }
  }));
  const pf = B.querySelector('#mePw');
  if (pf) pf.onsubmit = async (e) => {
    e.preventDefault(); ME.err = '';
    try { await api('/api/password', { old: $('#mePwOld').value, pw: $('#mePwNew').value }); ME.pwOpen = false; toast('비밀번호를 바꿨어요'); }
    catch (x) { ME.err = x.msg || '변경 실패'; }
    renderMe();
  };
  const df = B.querySelector('#meDel');
  if (df) df.onsubmit = async (e) => {
    e.preventDefault();
    if (!confirmTwice('#meDelGo', '정말요? 한 번 더 누르면 탈퇴')) return;
    ME.err = '';
    try { await api('/api/delete', { old: $('#meDelPw').value }); ME.delOpen = false; setAuth(null, null); toast('탈퇴했어요. 그동안 고마웠어요!', 3000); }
    catch (x) { ME.err = x.msg || '탈퇴 실패'; }
    renderMe();
  };
}

if (window.__fc) Object.assign(window.__fc, { showTab, fxHomeRun, fxStrikeout, fxHit, fxWin, fxScore, fxContact, playerCard });

// 경기에서 돌아오면 보던 탭 그대로 (시즌 경기 → 시즌 탭, 온라인 경기 → 온라인 탭)
showTab(store.get('tab', 'home'), true);
