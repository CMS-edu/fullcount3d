/* ===================== 작전: 수비 위치 · 주자 리드 ===================== */
// 수비 쪽은 투구 준비 중에 칩 한 번 탭으로 바꿈 (반 이닝 동안 유지, CPU는 상황 보고 타석마다 고름)
//   기본 · 전진 수비(내야가 앞으로 → 3루 주자 땅볼 홈인 차단, 대신 내야를 빠지는 안타↑)
//   · 번트 대비(1·3루수가 앞으로 → 번트 안타↓·번트 때 선행 주자 포스아웃, 강공엔 약함)
//   · 장타 방지(외야가 뒤로·코너가 라인 쪽 → 2·3루타↓, 짧은 안타↑)
// 공격 쪽 주자 리드: 짧게(견제에 거의 안 걸림, 도루·추가 진루 불리) · 보통 · 크게(도루·추가 진루 유리, 견제·직선타 더블아웃 위험↑)
const DEF_T = [
  { id: 'base', nm: '기본', tip: '기본 수비 위치' },
  { id: 'in', nm: '전진', tip: '전진 수비 — 3루 주자의 땅볼 홈인을 막지만, 내야를 빠지는 안타가 늘어요' },
  { id: 'bunt', nm: '번트 대비', tip: '번트 대비 — 1·3루수가 앞으로. 번트 안타를 막고 선행 주자를 노려요 (강공엔 약함)' },
  { id: 'deep', nm: '장타 방지', tip: '장타 방지 — 외야가 뒤로. 2·3루타는 줄지만 짧은 안타가 늘어요' },
];
const LEAD_T = { '-1': { nm: '짧게', tip: '리드 짧게 — 견제에 거의 안 걸리지만 도루·추가 진루가 불리해요' }, 0: { nm: '보통', tip: '리드 보통' }, 1: { nm: '크게', tip: '리드 크게 — 도루·추가 진루에 유리하지만 견제·직선타 더블아웃 위험이 커요' } };
const _pol = (phi, r) => ({ x: r * Math.sin((phi * Math.PI) / 180), z: -r * Math.cos((phi * Math.PI) / 180) });
const DEF_POS = { // 인덱스는 S.FIELD_HOME과 같음 (2 1루 3 2루 4 3루 5 유격 6 좌익 7 중견 8 우익)
  in: { 2: _pol(40, 26), 3: _pol(16, 34), 4: _pol(-38, 26), 5: _pol(-16, 34) },
  bunt: { 2: _pol(35, 24), 3: _pol(20, 38), 4: _pol(-35, 23), 5: _pol(-10, 42) },
  deep: { 2: _pol(42, 31), 4: _pol(-40, 30), 6: _pol(-30, 95), 7: _pol(0, 104), 8: _pol(30, 95) },
};
function defHome(i) { const d = DEF_POS[G.defT]; return (d && d[i]) || S.FIELD_HOME[i]; }
function defHomes() { return S.FIELD_HOME.map((h, i) => defHome(i)); }
function defInfo(id) { return DEF_T.find((d) => d.id === id) || DEF_T[0]; }
function resetTactics() { G.defT = 'base'; G.leadT = 0; G.leadUI = 0; }

// 수비 작전 적용 (온라인이면 상대 기기에도 다음 공 전에 같은 순서로 적용)
function setDefT(id, remote) {
  if (!defInfo(id) || G.defT === id) return;
  G.defT = id;
  if (G.online && !remote) sendAct({ k: 'dt', v: id });
  resetField(); placeRunners();
  if (userBatting() && id !== 'base') toast(`상대 수비: ${defInfo(id).nm}`, 1800);
  updateTacBtns();
}
// CPU 수비 작전 (내가 칠 때, 타석마다)
function cpuDefChoice() {
  const B = G.bases, late = G.inning >= G.maxInn - 1, gap = fieldTeam().runs - batTeam().runs, b = curBatter();
  if (B[2] && G.outs < 2 && late && Math.abs(gap) <= 1) return 'in';
  if ((B[0] || B[1]) && !B[2] && G.outs === 0 && Math.abs(gap) <= 2 && b.pow < 55 && R() < 0.6) return 'bunt';
  if (G.inning >= G.maxInn && gap >= 1 && gap <= 2) return 'deep';
  return 'base';
}
// CPU 주자 리드 (내가 던질 때): 발 빠른 주자는 크게, 느린 주자는 짧게
function cpuLeadChoice() {
  const r = G.bases.filter(Boolean).sort((a, b) => b.spd - a.spd)[0];
  return !r ? 0 : r.spd >= 70 ? 1 : r.spd < 45 ? -1 : 0;
}
// 타석 시작: CPU 쪽 작전 정하기 (온라인은 둘 다 사람이라 안 함)
function cpuTactics() {
  if (G.online || G.prac) return;
  if (userBatting()) { const d = cpuDefChoice(); if (d !== G.defT) { G.defT = d; if (d !== 'base') later(0.6, () => toast(`상대 수비: ${defInfo(d).nm}`, 1800)); } }
  else G.leadT = cpuLeadChoice();
}
function updateTacBtns() {
  const d = $('#defTBtn'), l = $('#leadBtn');
  d.hidden = !!G.prac; d.textContent = `수비: ${defInfo(G.defT).nm}`; d.setAttribute('aria-pressed', String(G.defT !== 'base'));
  d.disabled = G.phase !== 'aim' && G.phase !== 'meter';
  l.hidden = !!G.prac || !G.bases.some(Boolean); l.textContent = `리드: ${LEAD_T[G.leadUI || 0].nm}`; l.setAttribute('aria-pressed', String(!!G.leadUI));
  l.disabled = G.phase !== 'ready';
}
$('#defTBtn').addEventListener('click', () => {
  if (!userPitching() || (G.phase !== 'aim' && G.phase !== 'meter')) return;
  AU.click();
  const nx = DEF_T[(DEF_T.findIndex((x) => x.id === G.defT) + 1) % DEF_T.length];
  setDefT(nx.id); toast(nx.tip, 2200);
});
$('#leadBtn').addEventListener('click', () => {
  if (!userBatting() || G.phase !== 'ready') return;
  if (G.online && subBusy()) return;
  AU.click();
  const v = G.leadUI === 1 ? -1 : (G.leadUI || 0) + 1; // 보통 → 크게 → 짧게 → 보통
  G.leadUI = v; updateTacBtns();
  if (G.online) requestSub({ t: 'ld', v }, `리드 ${LEAD_T[v].nm}`); // 견제·도루 판정에 쓰이므로 상대 기기와 같은 공부터 적용
  else { G.leadT = v; toast(LEAD_T[v].tip, 2200); }
});
