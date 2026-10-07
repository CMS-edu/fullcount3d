/* ===================== 음악 (WebAudio로 직접 합성하는 오리지널 곡) ===================== */
// 실제 응원가·등장곡은 저작권이 있어서 쓰지 않고, 전부 여기서 작곡·합성함.
//  · 타이틀 테마(신스팝) · 응원 비트(우리 공격) · 구장 오르간(상대 공격) — 배경 루프
//  · 등장곡: 선수 이름으로 정해지는 나만의 곡 (스킬에 따라 록·일렉트로·에픽·펑크·힙합·행진·트로트·K팝·로파이)
//  · 짧은 음악 신호: 플레이볼 · 홈런 · 득점 · 삼진 · 공수교대 · 승리 · 패배
const MU = { on: store.get('music', true), ready: false, c: null, out: null, rev: null, players: [], bg: null, bgKind: null, walk: null, sting: null, duck: 1, hidden: false };
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const nm = (s) => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(s); return 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };

/* ---------- 악기 ---------- */
function muEnv(g, t, a, peak, d, s, rel, end) { // 공격·감쇠·유지·놓기
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(peak * s, t + a, d);
  g.gain.setValueAtTime(peak * s, Math.max(t + a, end)); g.gain.exponentialRampToValueAtTime(0.0001, end + rel);
}
function muOsc(c, type, f, t, end, dest, detune = 0) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune; o.connect(dest); o.start(t); o.stop(end); return o; }
function muNoise(c, t, dur, dest, rate = 1) { const s = c.createBufferSource(); s.buffer = AU.noiseBuf; s.loop = true; s.playbackRate.value = rate; s.connect(dest); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05); return s; }
let _dist = null;
function muDistCurve() { if (_dist) return _dist; const n = 2048, cv = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / n) * 2 - 1; cv[i] = Math.tanh(x * 6) * 0.8; } return (_dist = cv); }
const INS = {
  lead(c, d, t, f, dur, v) { const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(4200, t); fl.frequency.exponentialRampToValueAtTime(1600, t + 0.25); fl.Q.value = 2;
    fl.connect(g); g.connect(d); muEnv(g, t, 0.01, 0.16 * v, 0.12, 0.6, 0.09, t + dur); muOsc(c, 'square', f, t, t + dur + 0.2, fl); muOsc(c, 'sawtooth', f, t, t + dur + 0.2, fl, 7); },
  lead2(c, d, t, f, dur, v) { const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 3200; fl.connect(g); g.connect(d); muEnv(g, t, 0.012, 0.12 * v, 0.15, 0.7, 0.12, t + dur);
    [-9, 0, 9].forEach((dt) => muOsc(c, 'sawtooth', f, t, t + dur + 0.25, fl, dt)); const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 0; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.3); lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.25); },
  pluck(c, d, t, f, dur, v) { const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(5000, t); fl.frequency.exponentialRampToValueAtTime(500, t + 0.25); fl.connect(g); g.connect(d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(0.45, dur + 0.2)); muOsc(c, 'square', f, t, t + 0.5, fl); muOsc(c, 'triangle', f * 2, t, t + 0.5, fl); },
  arp(c, d, t, f, dur, v) { INS.pluck(c, d, t, f, Math.min(dur, 0.12), v * 0.8); },
  bell(c, d, t, f, dur, v) { [[1, 0.12, 1.4], [2.76, 0.05, 0.5], [5.4, 0.025, 0.2]].forEach(([k, a, dc]) => { const g = c.createGain(); g.connect(d); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(a * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dc); muOsc(c, 'sine', f * k, t, t + dc + 0.05, g); }); },
  bass(c, d, t, f, dur, v) { const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(1100, t); fl.frequency.exponentialRampToValueAtTime(420, t + 0.15); fl.connect(g); g.connect(d);
    muEnv(g, t, 0.006, 0.32 * v, 0.1, 0.75, 0.06, t + dur); muOsc(c, 'triangle', f, t, t + dur + 0.15, fl); muOsc(c, 'sawtooth', f, t, t + dur + 0.15, fl, 5); },
  sub(c, d, t, f, dur, v) { const g = c.createGain(); g.connect(d); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.45 * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.3, dur + 0.25));
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); o.connect(g); o.start(t); o.stop(t + dur + 0.4); },
  slap(c, d, t, f, dur, v) { INS.bass(c, d, t, f, Math.min(dur, 0.18), v * 1.1); const g = c.createGain(); g.connect(d); g.gain.setValueAtTime(0.12 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); muNoise(c, t, 0.05, g, 2); },
  pad(c, d, t, f, dur, v) { const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1500; fl.connect(g); g.connect(d); muEnv(g, t, 0.25, 0.05 * v, 0.6, 0.85, 0.5, t + dur);
    [-12, 0, 12].forEach((dt) => muOsc(c, 'sawtooth', f, t, t + dur + 0.6, fl, dt)); },
  choir(c, d, t, f, dur, v) { const g = c.createGain(), b1 = c.createBiquadFilter(), b2 = c.createBiquadFilter(); b1.type = b2.type = 'bandpass'; b1.frequency.value = 800; b2.frequency.value = 1150; b1.Q.value = b2.Q.value = 4;
    b1.connect(g); b2.connect(g); g.connect(d); muEnv(g, t, 0.3, 0.16 * v, 0.6, 0.9, 0.5, t + dur);
    [-6, 6].forEach((dt) => { const o = muOsc(c, 'sawtooth', f, t, t + dur + 0.6, b1, dt); o.connect(b2); }); },
  brass(c, d, t, f, dur, v) { const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 1.5; fl.frequency.setValueAtTime(350, t); fl.frequency.linearRampToValueAtTime(2800, t + 0.06); fl.frequency.setTargetAtTime(1500, t + 0.07, 0.15);
    fl.connect(g); g.connect(d); muEnv(g, t, 0.03, 0.14 * v, 0.2, 0.75, 0.1, t + dur);
    const o1 = muOsc(c, 'sawtooth', f, t, t + dur + 0.2, fl, -5), o2 = muOsc(c, 'sawtooth', f, t, t + dur + 0.2, fl, 6);
    if (dur > 0.25) { const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.008, t + 0.35); lfo.connect(lg); lg.connect(o1.frequency); lg.connect(o2.frequency); lfo.start(t); lfo.stop(t + dur + 0.2); } },
  organ(c, d, t, f, dur, v) { const g = c.createGain(), trem = c.createGain(), lfo = c.createOscillator(), lg = c.createGain(); trem.gain.value = 0.8; lfo.frequency.value = 6.4; lg.gain.value = 0.22; lfo.connect(lg); lg.connect(trem.gain); lfo.start(t); lfo.stop(t + dur + 0.15);
    trem.connect(g); g.connect(d); muEnv(g, t, 0.008, 0.07 * v, 0.1, 0.9, 0.06, t + dur);
    [[1, 1], [2, 0.65], [3, 0.4], [4, 0.25], [6, 0.12]].forEach(([k, a]) => { const og = c.createGain(); og.gain.value = a; og.connect(trem); muOsc(c, 'sine', f * k, t, t + dur + 0.15, og); }); },
  clav(c, d, t, f, dur, v) { const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1300; fl.Q.value = 2.5; fl.connect(g); g.connect(d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); muOsc(c, 'square', f, t, t + 0.25, fl); },
  accord(c, d, t, f, dur, v) { const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1700; fl.Q.value = 0.8; fl.connect(g); g.connect(d); muEnv(g, t, 0.02, 0.12 * v, 0.2, 0.85, 0.08, t + dur);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 6.2; lg.gain.value = f * 0.01; lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + 0.15);
    [[-14, 'square'], [0, 'sawtooth'], [14, 'square']].forEach(([dt, ty]) => { const o = muOsc(c, ty, f, t, t + dur + 0.15, fl, dt); lg.connect(o.frequency); }); },
  guitar(c, d, t, f, dur, v) { const ws = c.createWaveShaper(), g = c.createGain(), fl = c.createBiquadFilter(), pre = c.createGain(); ws.curve = muDistCurve(); fl.type = 'lowpass'; fl.frequency.value = 2600; pre.gain.value = 0.5;
    pre.connect(ws); ws.connect(fl); fl.connect(g); g.connect(d); muEnv(g, t, 0.005, 0.11 * v, 0.15, 0.7, 0.06, t + dur);
    [1, 1.5, 2].forEach((k, i) => muOsc(c, 'sawtooth', f * k, t, t + dur + 0.1, pre, i ? 4 : -4)); },
  timp(c, d, t, f, dur, v) { const g = c.createGain(); g.connect(d); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    const o = c.createOscillator(); o.frequency.setValueAtTime(f * 1.05, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12); o.connect(g); o.start(t); o.stop(t + 1.2);
    const ng = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 400; ng.gain.setValueAtTime(0.2 * v, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); fl.connect(ng); ng.connect(d); muNoise(c, t, 0.3, fl); },
  // 드럼 (f 무시)
  kick(c, d, t, f, dur, v) { const g = c.createGain(); g.connect(d); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.9 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    const o = c.createOscillator(); o.frequency.setValueAtTime(155, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); o.connect(g); o.start(t); o.stop(t + 0.35); },
  snare(c, d, t, f, dur, v) { const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1900; fl.Q.value = 0.7; fl.connect(g); g.connect(d); g.gain.setValueAtTime(0.42 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17); muNoise(c, t, 0.2, fl);
    const g2 = c.createGain(); g2.connect(d); g2.gain.setValueAtTime(0.22 * v, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); muOsc(c, 'triangle', 190, t, t + 0.1, g2); },
  hat(c, d, t, f, dur, v) { const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 7600; fl.connect(g); g.connect(d); g.gain.setValueAtTime(0.16 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045); muNoise(c, t, 0.06, fl, 1.6); },
  ohat(c, d, t, f, dur, v) { const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 7000; fl.connect(g); g.connect(d); g.gain.setValueAtTime(0.14 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); muNoise(c, t, 0.3, fl, 1.5); },
  clap(c, d, t, f, dur, v) { const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = 1500; fl.Q.value = 1.1; fl.connect(d);
    [0, 0.011, 0.023].forEach((o, i) => { const g = c.createGain(); g.connect(fl); g.gain.setValueAtTime(0.0001, t + o); g.gain.linearRampToValueAtTime(0.5 * v, t + o + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + o + (i === 2 ? 0.16 : 0.02)); muNoise(c, t + o, 0.18, g, 1.2); }); },
  tom(c, d, t, f, dur, v) { const g = c.createGain(); g.connect(d); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.55 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    const o = c.createOscillator(); o.frequency.setValueAtTime(f || 130, t); o.frequency.exponentialRampToValueAtTime((f || 130) * 0.62, t + 0.25); o.connect(g); o.start(t); o.stop(t + 0.32); },
  crash(c, d, t, f, dur, v) { const g = c.createGain(), fl = c.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 4500; fl.connect(g); g.connect(d); g.gain.setValueAtTime(0.22 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8); muNoise(c, t, 1.9, fl, 1.3); },
};

/* ---------- 곡 만들기 도구 ---------- */
// 곡 = { bpm, len(16분음표 칸 수), ev[칸] = [{i, f[], d(칸), v}], loop, vol, rev }
function mkSong(bpm, bars, o = {}) { return Object.assign({ bpm, len: bars * 16, ev: Array.from({ length: bars * 16 }, () => []), loop: false, vol: 1, rev: 0.35 }, o); }
function put(S, i, st, notes, d = 1, v = 1) { if (st < 0 || st >= S.len) return; S.ev[st].push({ i, f: (Array.isArray(notes) ? notes : [notes]).map((n) => (n == null ? 0 : mtof(typeof n === 'string' ? nm(n) : n))), d, v }); }
// 선율: 'G4:2 C5:2 r:2 …' (숫자 = 16분음표 길이)
function mel(S, i, st, txt, v = 1, tr = 0) { let p = st; txt.trim().split(/\s+/).forEach((tok) => { const [n, l] = tok.split(':'), L = +l || 1; if (n !== 'r') put(S, i, p, nm(n) + tr, L, v); p += L; }); return p; }
// 드럼 한 마디: 'x...' (x 세게 · o 약하게)
function beat(S, i, bar, pat, v = 1, f) { for (let k = 0; k < 16 && k < pat.length; k++) { const ch = pat[k]; if (ch === 'x' || ch === 'o') put(S, i, bar * 16 + k, f || 0, 1, ch === 'x' ? v : v * 0.55); } }
const CH = { maj: [0, 4, 7], min: [0, 3, 7], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], d7: [0, 4, 7, 10], sus: [0, 5, 7], five: [0, 7, 12] };
const chord = (root, ty) => CH[ty].map((x) => root + x);

/* ---------- 고정 곡 ---------- */
const SONGS = {};
// 타이틀 테마: 밝은 신스팝, 124bpm, C – G – Am – F | C – G – F – G
SONGS.title = (() => {
  const S = mkSong(124, 8, { loop: true, vol: 0.85, title: '풀카운트 메인 테마' });
  const prog = [[48, 'maj'], [43, 'maj'], [45, 'min'], [41, 'maj'], [48, 'maj'], [43, 'maj'], [41, 'maj'], [43, 'maj']];
  prog.forEach(([r, ty], b) => {
    put(S, 'pad', b * 16, chord(r + 12, ty), 16, 0.9);
    for (let k = 0; k < 16; k += 2) put(S, 'bass', b * 16 + k, r - 12 + (k % 8 === 6 ? 12 : 0), 2, k % 4 ? 0.7 : 1);
    const ct = chord(r + 24, ty); for (let k = 0; k < 16; k++) if (k % 2 === 0 || b >= 4) put(S, 'arp', b * 16 + k, ct[(k + b) % ct.length] + (k % 8 >= 4 ? 12 : 0), 1, 0.45);
    beat(S, 'kick', b, 'x...x...x...x...'); beat(S, 'snare', b, b === 7 ? '....x.......x.xx' : '....x.......x...', 0.8); beat(S, 'hat', b, '.x.x.x.x.x.x.x.x', 0.6); beat(S, 'ohat', b, '..x...x...x...x.', 0.35);
  });
  put(S, 'crash', 0, 0, 1, 0.7);
  mel(S, 'lead2', 0, 'G4:2 C5:2 E5:2 G5:4 E5:2 D5:2 C5:2  D5:2 B4:2 D5:2 G5:6 F5:2 E5:2  E5:2 C5:2 E5:2 A5:4 G5:2 E5:2 C5:2  F5:4 E5:2 D5:2 C5:4 D5:4', 0.9);
  mel(S, 'lead2', 64, 'G4:2 C5:2 E5:2 G5:4 A5:2 G5:2 E5:2  D5:2 G5:2 B5:4 A5:2 G5:2 F5:2 D5:2  C6:4 A5:2 F5:2 A5:4 G5:4  G5:2 A5:2 B5:2 D6:6 r:4', 0.9);
  return S;
})();
// 우리 공격 응원 비트: 큰북 + "짝짝 짝짝짝" 박수 + 브라스 콜, 132bpm (G)
SONGS.cheer = (() => {
  const S = mkSong(132, 4, { loop: true, vol: 0.62, title: '응원 비트' });
  for (let b = 0; b < 4; b++) {
    beat(S, 'kick', b, 'x...x...x.x.x...'); beat(S, 'tom', b, b === 3 ? '........x.x.x.xx' : '', 0.8, 50); beat(S, 'clap', b, 'x...x...x.x.x...', 0.85);
    beat(S, 'snare', b, '....x.......x...', 0.5);
    const r = [43, 48, 43, 50][b]; for (let k = 0; k < 16; k += 4) put(S, 'bass', b * 16 + k, r - 12, 3, 0.9);
  }
  mel(S, 'brass', 0, 'G4:2 G4:2 r:2 B4:2 D5:4 B4:2 D5:2  G5:6 F#5:2 E5:4 D5:4', 0.95);
  mel(S, 'brass', 32, 'E5:2 E5:2 r:2 D5:2 C5:4 B4:2 A4:2  G4:4 B4:4 D5:4 G5:4', 0.95);
  mel(S, 'brass', 0, 'B4:2 B4:2 r:2 D5:2 G4:4 D5:2 G4:2  B4:6 A4:2 G4:4 F#4:4', 0.5);
  return S;
})();
// 상대 공격·쉬는 시간: 구장 오르간, 100bpm (F) — 2·4박 화음 + 걷는 베이스
SONGS.organ = (() => {
  const S = mkSong(100, 8, { loop: true, vol: 0.62, title: '구장 오르간', rev: 0.5 });
  const prog = [[53, 'maj'], [50, 'min'], [46, 'maj'], [48, 'd7'], [53, 'maj'], [45, 'min'], [46, 'maj'], [48, 'd7']];
  prog.forEach(([r, ty], b) => {
    put(S, 'organ', b * 16 + 4, chord(r + 12, ty), 3, 0.8); put(S, 'organ', b * 16 + 12, chord(r + 12, ty), 3, 0.8);
    [0, 4, 8, 12].forEach((k, i) => put(S, 'bass', b * 16 + k, r - 12 + [0, 4, 7, 9][i], 4, 0.75));
    beat(S, 'hat', b, 'x..xx..xx..xx..x', 0.35);
  });
  mel(S, 'organ', 0, 'r:8 A5:2 C6:2 F6:4  E6:2 D6:2 C6:4 A5:8  r:8 F5:2 G5:2 A5:4  G5:8 r:8', 0.8);
  mel(S, 'organ', 64, 'r:8 C6:2 A5:2 F5:4  E5:2 F5:2 G5:4 A5:8  r:8 D6:2 C6:2 A5:4  C6:12 r:4', 0.8);
  return S;
})();
// 짧은 신호들
SONGS.playball = (() => { const S = mkSong(140, 2, { vol: 1 }); put(S, 'crash', 0, 0, 1); put(S, 'timp', 0, 'C3', 4); put(S, 'timp', 24, 'G2', 4); put(S, 'timp', 28, 'C3', 4);
  mel(S, 'brass', 0, 'C5:2 C5:2 C5:2 G4:2 C5:4 E5:4  G5:12 r:4'); mel(S, 'brass', 0, 'E4:2 E4:2 E4:2 D4:2 E4:4 G4:4  C5:12 r:4', 0.7); put(S, 'pad', 16, chord(48, 'maj'), 14, 1.2); put(S, 'crash', 16, 0, 1); return S; })();
SONGS.hr = (() => { const S = mkSong(150, 4, { vol: 1.05 }); // 나팔 "돌격!" 신호 느낌의 오리지널 팡파르 + 드럼 롤
  mel(S, 'organ', 0, 'G4:2 C5:2 E5:2 G5:3 E5:1 G5:8'); mel(S, 'brass', 0, 'G4:2 C5:2 E5:2 G5:3 E5:1 G5:8', 0.9);
  for (let k = 16; k < 32; k++) put(S, 'snare', k, 0, 1, 0.35 + (k - 16) * 0.04);
  put(S, 'crash', 32, 0, 1); put(S, 'timp', 32, 'C3', 8); put(S, 'brass', 32, chord(60, 'maj'), 24, 1); put(S, 'organ', 32, chord(72, 'maj'), 24, 1); put(S, 'kick', 32, 0, 1); put(S, 'kick', 40, 0, 1);
  return S; })();
SONGS.score = (() => { const S = mkSong(140, 1, { vol: 0.95 }); mel(S, 'brass', 0, 'C5:2 E5:2 G5:2 C6:10'); put(S, 'brass', 6, chord(60, 'maj'), 10, 0.7); put(S, 'crash', 6, 0, 1); put(S, 'kick', 6, 0, 1); return S; })();
SONGS.k = (() => { const S = mkSong(150, 1, { vol: 1.3 }); mel(S, 'organ', 0, 'E5:1 G5:1 C6:3 r:1 G5:1 C6:6'); put(S, 'brass', 2, chord(60, 'maj'), 3, 0.6); put(S, 'brass', 7, chord(60, 'maj'), 6, 0.8); put(S, 'snare', 7, 0, 1); return S; })();
SONGS.inning = (() => { const S = mkSong(120, 2, { vol: 1.4, rev: 0.5 }); mel(S, 'organ', 0, 'C5:2 E5:2 G5:2 A5:2 G5:4 E5:4  F5:2 E5:2 D5:2 B4:2 C5:8'); put(S, 'organ', 16, chord(48, 'maj'), 8, 0.6); return S; })();
SONGS.win = (() => { const S = mkSong(128, 4, { vol: 0.88 });
  [[48, 'maj'], [53, 'maj'], [43, 'maj'], [48, 'maj']].forEach(([r, ty], b) => { put(S, 'pad', b * 16, chord(r + 12, ty), 16, 1.1); for (let k = 0; k < 16; k += 2) put(S, 'bass', b * 16 + k, r - 12, 2, 0.9); beat(S, 'kick', b, 'x...x...x...x...'); beat(S, 'snare', b, b === 3 ? 'x.x.x.x.xxxxxxxx' : '....x.......x...', 0.8); beat(S, 'hat', b, 'xxxxxxxxxxxxxxxx', 0.4); });
  put(S, 'crash', 0, 0, 1); put(S, 'crash', 32, 0, 1);
  mel(S, 'brass', 0, 'C5:2 E5:2 G5:2 C6:6 B5:2 A5:2  A5:4 C6:4 F6:8  D6:2 B5:2 G5:2 D6:6 C6:2 B5:2  C6:16', 1);
  mel(S, 'lead2', 0, 'E5:2 G5:2 C6:2 E6:6 D6:2 C6:2  C6:4 F6:4 A6:8  B5:2 G5:2 D6:2 G6:6 E6:2 D6:2  E6:16', 0.5);
  put(S, 'timp', 48, 'C3', 8); put(S, 'crash', 48, 0, 1); return S; })();
SONGS.lose = (() => { const S = mkSong(76, 2, { vol: 1.4, rev: 0.6 }); put(S, 'pad', 0, chord(57, 'min'), 16, 1); put(S, 'pad', 16, chord(53, 'maj'), 8, 1); put(S, 'pad', 24, chord(52, 'min'), 8, 1);
  mel(S, 'organ', 0, 'E5:4 D5:4 C5:4 B4:4  A4:8 G#4:8', 0.8); return S; })();
// 끝판왕 등판 테마: 팀파니 + 합창 + 브라스, 더 길고 웅장하게
SONGS.closer = (() => { const S = mkSong(96, 4, { vol: 1, rev: 0.6, title: '끝판왕 테마' });
  [[45, 'min'], [41, 'maj'], [48, 'maj'], [43, 'maj']].forEach(([r, ty], b) => { put(S, 'choir', b * 16, chord(r + 12, ty), 16, 1); put(S, 'timp', b * 16, r - 12 + 12, 4, 1); put(S, 'timp', b * 16 + 8, r - 12 + 12, 4, 0.7); put(S, 'bass', b * 16, r - 12, 16, 0.9);
    beat(S, 'tom', b, 'x.....x.x...x.xx', 0.6, 45); });
  put(S, 'crash', 0, 0, 1); put(S, 'crash', 48, 0, 1);
  mel(S, 'brass', 0, 'A4:4 C5:4 E5:8  F5:4 E5:2 D5:2 C5:8  E5:4 G5:4 C6:8  B5:4 A5:2 G5:2 A5:8', 1); return S; })();

/* ---------- 등장곡 생성 ---------- */
const MU_STYLE = {
  rock: { bpm: 140, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 6, 0], lead: 'lead2', chordI: 'guitar', bass: 'bass', minor: true,
    drums: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, rhy: [[2, 2, 2, 2], [4, 2, 2], [2, 2, 4], [3, 1, 2, 2]] },
  electro: { bpm: 128, scale: [0, 2, 3, 5, 7, 8, 10], prog: [5, 3, 0, 4], lead: 'lead', chordI: 'arp', bass: 'sub', minor: true,
    drums: { kick: 'x...x...x...x...', clap: '....x.......x...', hat: '..x...x...x...x.', ohat: '.x.x.x.x.x.x.x.x' }, rhy: [[1, 1, 2, 1, 1, 2], [2, 1, 1, 2, 2], [1, 1, 1, 1, 4]] },
  epic: { bpm: 100, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], lead: 'brass', chordI: 'choir', bass: 'timp', minor: true,
    drums: { tom: 'x.....x.x...x.xx', kick: 'x.......x.......' }, rhy: [[4, 4], [2, 2, 4], [6, 2]] },
  funk: { bpm: 108, scale: [0, 2, 3, 5, 7, 9, 10], prog: [0, 3, 0, 3], lead: 'brass', chordI: 'clav', bass: 'slap', minor: true, sev: true,
    drums: { kick: 'x..x..x...x.....', snare: '....x..o....x..o', hat: 'xxxxxxxxxxxxxxxx' }, rhy: [[1, 1, 2, 1, 3], [2, 1, 1, 2, 2], [3, 1, 2, 2]] },
  hiphop: { bpm: 92, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 3, 4], lead: 'bell', chordI: 'pad', bass: 'sub', minor: true,
    drums: { kick: 'x......x.x......', snare: '....x.......x...', hat: 'x.xxx.x.x.xxx.x.' }, rhy: [[2, 2, 4], [1, 1, 2, 4], [4, 2, 2]] },
  march: { bpm: 116, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 0], lead: 'brass', chordI: 'brass', bass: 'bass',
    drums: { kick: 'x.......x.......', snare: 'x.xx..x.x.xx..x.', crash: '' }, rhy: [[2, 2, 2, 2], [3, 1, 4], [2, 2, 4]] },
  trot: { bpm: 124, scale: [0, 2, 4, 7, 9], prog: [0, 3, 4, 0], lead: 'accord', chordI: 'organ', bass: 'bass', pent: true, oompah: true,
    drums: { kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.' }, rhy: [[3, 1, 2, 2], [2, 2, 4], [1, 1, 2, 4]] },
  kpop: { bpm: 120, scale: [0, 2, 4, 5, 7, 9, 11], prog: [5, 3, 0, 4], lead: 'lead2', chordI: 'pad', bass: 'bass',
    drums: { kick: 'x...x...x...x...', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, rhy: [[2, 1, 1, 2, 2], [1, 1, 2, 4], [2, 2, 2, 2]] },
  lofi: { bpm: 82, scale: [0, 2, 4, 5, 7, 9, 11], prog: [3, 2, 1, 4], lead: 'bell', chordI: 'pad', bass: 'bass', sev: true,
    drums: { kick: 'x.......x..x....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, rhy: [[4, 4], [2, 2, 4], [6, 2]] },
};
const STYLE_NM = { rock: '록', electro: '일렉트로', epic: '에픽', funk: '펑크', hiphop: '힙합', march: '행진곡', trot: '트로트', kpop: 'K팝', lofi: '로파이' };
const SONG_NM = {
  rock: ['헤비 스윙', '레드존', '불타는 배트', '풀스윙 로큰롤'], electro: ['썬더 대시', '네온 러너', '스파크 런', '번개 질주'], epic: ['라스트 찬스', '영웅의 시간', '9회말 투아웃', '결전의 타석'],
  funk: ['그루브 히터', '컨택 펑크', '리듬 앤 배트'], hiphop: ['초구 플로우', '스윙 바운스', '배터스 박스'], march: ['끈기의 행진', '버티는 자', '한 걸음 더'],
  trot: ['안타 아리랑', '홈런 블루스', '사랑의 1루타', '내야 땅볼 연가'], kpop: ['풀카운트 러브', '스트라이크 하트', '빛나는 타석'], lofi: ['고요한 눈', '스트라이크존 산책', '볼넷 한 잔'],
};
const SKILL_STYLE = { slug: 'rock', pull: 'rock', speed: 'electro', clutch: 'epic', contact: 'funk', first: 'hiphop', eye: 'lofi', tough: 'march',
  heat: 'rock', magic: 'electro', ctrl: 'electro', gb: 'march', escape: 'epic', eater: 'march', closer: 'epic', pickoff: 'funk', sub: 'lofi' };
function muRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function muHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
// 선수의 등장곡: 이름으로 시드를 정해서 같은 선수는 늘 같은 곡
function walkSong(p) {
  const key = (p.eng || p.name) + '|' + (p.kbo || ''), rnd = muRng(muHash(key) ^ 0x9e3779b9); rnd(); rnd(); rnd();
  // 스킬이 있으면 스킬 분위기, 없으면 선수 유형으로 후보를 좁힌 뒤 이름으로 고름 (같은 선수 = 늘 같은 곡)
  const pool = p.role ? (p.role === 'SP' ? ['rock', 'epic', 'march', 'electro'] : ['electro', 'rock', 'hiphop', 'funk'])
    : p.pow >= 70 ? ['rock', 'hiphop', 'epic', 'rock'] : p.spd >= 68 ? ['electro', 'kpop', 'funk', 'electro'] : p.con >= 68 ? ['funk', 'kpop', 'march', 'trot']
    : ['rock', 'electro', 'funk', 'hiphop', 'kpop', 'trot', 'march', 'lofi'];
  const style = (p.skill && SKILL_STYLE[p.skill]) || pool[Math.floor(rnd() * pool.length)];
  const St = MU_STYLE[style], bars = St.bpm >= 110 ? 4 : 3, S = mkSong(St.bpm, bars, { vol: 0.95, rev: style === 'epic' || style === 'lofi' ? 0.55 : 0.32 });
  const root = 50 + Math.floor(rnd() * 8), sc = St.scale, deg = (d) => root + sc[((d % sc.length) + sc.length) % sc.length] + 12 * Math.floor(d / sc.length);
  const triad = (d) => [deg(d), deg(d + 2), deg(d + 4)].concat(St.sev ? [deg(d + 6)] : []);
  for (let b = 0; b < bars; b++) {
    const d0 = St.prog[b % St.prog.length], ch = triad(d0), bs = deg(d0) - 12;
    // 반주
    if (St.chordI === 'guitar') for (let k = 0; k < 16; k += 2) put(S, 'guitar', b * 16 + k, deg(d0) - 12, k % 8 === 6 ? 2 : 1, k % 4 ? 0.7 : 1);
    else if (St.chordI === 'arp') for (let k = 0; k < 16; k++) put(S, 'arp', b * 16 + k, ch[k % ch.length] + 12 + (k % 8 >= 4 ? 12 : 0), 1, 0.5);
    else if (St.chordI === 'clav') ['x.x..x.x.x..x.x.'].forEach((pat) => { for (let k = 0; k < 16; k++) if (pat[k] === 'x') put(S, 'clav', b * 16 + k, ch.map((n) => n + 12), 1, 0.7); });
    else if (St.oompah) { for (let k = 0; k < 16; k += 8) { put(S, 'bass', b * 16 + k, bs, 3, 1); put(S, St.chordI, b * 16 + k + 4, ch.map((n) => n + 12), 3, 0.7); } }
    else if (St.chordI === 'brass') { put(S, 'brass', b * 16, ch, 3, 0.6); put(S, 'brass', b * 16 + 8, ch, 3, 0.55); }
    else put(S, St.chordI, b * 16, ch.map((n) => n + 12), 16, style === 'epic' ? 1 : 0.8);
    // 베이스
    if (!St.oompah) { if (St.bass === 'timp') { put(S, 'timp', b * 16, bs + 12, 4, 0.9); put(S, 'timp', b * 16 + 10, bs + 12, 4, 0.6); }
      else if (St.bass === 'slap') { 'x..x..x.x..x.x..'.split('').forEach((c, k) => { if (c === 'x') put(S, 'slap', b * 16 + k, k % 6 === 3 ? bs + 12 : bs, 1, 0.9); }); }
      else if (St.bass === 'sub') { put(S, 'sub', b * 16, bs, 6, 1); put(S, 'sub', b * 16 + 10, bs, 4, 0.8); }
      else for (let k = 0; k < 16; k += 4) put(S, 'bass', b * 16 + k, bs + (k === 12 && rnd() < 0.5 ? 7 : 0), 3, 0.9); }
    // 드럼
    for (const dk in St.drums) beat(S, dk === 'tom' ? 'tom' : dk, b, b === bars - 1 && dk === 'snare' ? 'x.x.x.x.xxxxxxxx' : St.drums[dk], 0.85, dk === 'tom' ? 47 : undefined);
  }
  // 선율: 동기(A) → 화음 따라 옮김(A') → 변주(B) → 으뜸음으로 마무리
  const rhy = St.rhy[Math.floor(rnd() * St.rhy.length)], motif = []; let d = 7 + Math.floor(rnd() * 3);
  rhy.forEach(() => { d += [-2, -1, 1, 2, 0, 3][Math.floor(rnd() * 6)]; d = Math.max(4, Math.min(13, d)); motif.push(d); });
  const play = (bar, shift, vary) => { let st = bar * 16; for (let h = 0; h < 2; h++) { rhy.forEach((L, i) => { const dd = motif[i] + shift + (vary && i === rhy.length - 1 ? (h ? -2 : 1) : 0); put(S, St.lead, st, deg(dd), L, 0.95); st += L; }); } };
  for (let b = 0; b < bars - 1; b++) play(b, b === 0 ? 0 : St.prog[b % St.prog.length] - St.prog[0], b === bars - 2);
  put(S, St.lead, (bars - 1) * 16, deg(7), 6, 1); put(S, St.lead, (bars - 1) * 16 + 8, deg(St.prog[0] + 7), 8, 1);
  put(S, 'crash', 0, 0, 1, 0.8); put(S, 'crash', (bars - 1) * 16 + 8, 0, 1, 0.6);
  const names = SONG_NM[style];
  S.title = `${names[Math.floor(rnd() * names.length)]}`; S.style = STYLE_NM[style];
  return S;
}

/* ---------- 재생 엔진 (내다보며 미리 예약하는 스케줄러) ---------- */
function muInit() {
  if (MU.ready || !AU.ctx) return;
  const c = MU.c = AU.ctx;
  MU.out = c.createGain(); MU.out.gain.value = MU.on && !MU.hidden ? 0.55 : 0;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; MU.out.connect(comp); comp.connect(c.destination);
  const len = Math.round(c.sampleRate * 2.2), ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const dd = ir.getChannelData(ch); for (let i = 0; i < len; i++) dd[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
  MU.rev = c.createConvolver(); MU.rev.buffer = ir; const rg = c.createGain(); rg.gain.value = 0.3; MU.rev.connect(rg); rg.connect(MU.out);
  MU.ready = true;
  setInterval(muTick, 45);
  muScene();
}
function muPlay(S, o = {}) {
  if (!MU.ready) return null;
  const c = MU.c, g = c.createGain(), send = c.createGain(), t = c.currentTime;
  const vol = (o.vol != null ? o.vol : 1) * S.vol;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + (o.fadeIn || 0.04));
  send.gain.value = S.rev; g.connect(MU.out); g.connect(send); send.connect(MU.rev);
  const pl = { S, g, vol, t0: t + 0.08, pos: 0, sd: 60 / S.bpm / 4, loop: !!S.loop, dead: false, onEnd: o.onEnd, kind: o.kind, duck: 1 };
  MU.players.push(pl); return pl;
}
function muStop(pl, fade = 0.5) {
  if (!pl || pl.dead) return; pl.dead = true;
  const t = MU.c.currentTime; pl.g.gain.cancelScheduledValues(t); pl.g.gain.setValueAtTime(Math.max(0.0001, pl.g.gain.value), t); pl.g.gain.exponentialRampToValueAtTime(0.0001, t + fade);
  setTimeout(() => { try { pl.g.disconnect(); } catch (e) { /* */ } }, (fade + 0.6) * 1000);
}
function muTick() {
  if (!MU.ready) return;
  const c = MU.c, now = c.currentTime, ahead = now + 0.32;
  muDuckTick();
  MU.players = MU.players.filter((pl) => !pl.gone);
  for (const pl of MU.players) {
    if (pl.dead) { pl.gone = true; continue; }
    const S = pl.S;
    while (true) {
      const t = pl.t0 + pl.pos * pl.sd;
      if (t >= ahead) break;
      if (!pl.loop && pl.pos >= S.len) { pl.ended = pl.ended || t; break; }
      const st = pl.pos % S.len;
      if (t >= now - 0.05 && MU.on && !MU.hidden) for (const e of S.ev[st]) { const dur = e.d * pl.sd; for (const f of e.f) { try { INS[e.i](c, pl.g, t, f, dur, e.v); } catch (x) { /* 오래된 브라우저 */ } } }
      pl.pos++;
    }
    if (pl.ended && now > pl.ended + 1.4) { pl.dead = pl.gone = true; try { pl.g.disconnect(); } catch (e) { /* */ } if (pl.onEnd) pl.onEnd(); }
  }
}
// 투구 중에는 배경음을 줄임 (타격 집중), 타구가 날아가는 동안도 조금
function muDuckTick() {
  const bg = MU.bg; if (!bg || bg.dead) return;
  const ph = G.phase, want = ph === 'windup' || ph === 'flight' ? 0.3 : ph === 'play' ? 0.55 : 1;
  if (Math.abs(want - bg.duck) > 0.01) { bg.duck = want; const t = MU.c.currentTime; bg.g.gain.setTargetAtTime(bg.vol * want, t, 0.12); }
}

/* ---------- 장면 전환 ---------- */
function muSetBg(kind) {
  if (!MU.ready) return;
  if (MU.bgKind === kind && MU.bg && !MU.bg.dead) return;
  if (MU.bg) muStop(MU.bg, 0.8);
  MU.bgKind = kind; MU.bg = kind ? muPlay(SONGS[kind], { fadeIn: 1.2, kind }) : null;
}
// 지금 상황에 맞는 배경음: 타이틀 / 우리 공격 응원 / 상대 공격 오르간 (등장곡·신호가 나오는 중이면 기다림)
function muScene() {
  if (!MU.ready) return;
  if ((MU.walk && !MU.walk.dead) || (MU.sting && !MU.sting.dead)) return;
  if (!G.T || !UI.title.hidden) { muSetBg('title'); return; }
  if (G.phase === 'over') { muSetBg(null); return; }
  muSetBg(userBatting() ? 'cheer' : 'organ');
}
function muToTitle() { if (!MU.ready) return; if (MU.walk) { muStop(MU.walk, 0.4); MU.walk = null; } if (MU.sting) { muStop(MU.sting, 0.4); MU.sting = null; } muSetBg('title'); }
function muSting(name, o = {}) {
  if (!MU.ready || !SONGS[name]) return;
  if (MU.sting && !MU.sting.dead && !o.force) return;
  if (MU.walk) { muStop(MU.walk, 0.3); MU.walk = null; }
  if (MU.bg) { muStop(MU.bg, 0.25); MU.bg = null; MU.bgKind = null; }
  MU.stingName = name;
  MU.sting = muPlay(SONGS[name], { onEnd: () => { MU.sting = null; if (o.then) o.then(); else muScene(); } });
}
// 등장곡: 타석·등판 때. 지금 곡 제목을 화면 구석에 잠깐
function muWalk(p, tm, pitcher) {
  if (!MU.ready || !MU.on || G.prac) return;
  // 홈런·승패 팡파르는 끝까지, 짧은 신호(공수교대·득점·삼진·플레이볼)는 등장곡이 끊고 들어감
  if (MU.sting && !MU.sting.dead) { if (['hr', 'win', 'lose'].includes(MU.stingName)) return; muStop(MU.sting, 0.6); MU.sting = null; }
  if (MU.walk) muStop(MU.walk, 0.3);
  if (MU.bg) { muStop(MU.bg, 0.5); MU.bg = null; MU.bgKind = null; }
  const S = pitcher && p.skill === 'closer' ? SONGS.closer : walkSong(p);
  MU.walk = muPlay(S, { vol: tm === (G.T && G.T[G.userSide]) ? 1 : 0.8, onEnd: () => { MU.walk = null; muScene(); } });
  MU.walkT = performance.now(); MU.walkLen = (S.len * 60) / S.bpm / 4;
  muNowShow(`${p.name} 등장곡`, `「${S.title}」 · ${S.style || '테마'}`, tm);
}
// 투구가 시작되면 등장곡은 줄이며 끝냄 (실제 구장처럼)
function muPitchStart() { if (MU.walk && !MU.walk.dead) { muStop(MU.walk, 0.9); MU.walk = null; setTimeout(muScene, 950); } }
// CPU 투수는 등장곡을 4초쯤 들려준 뒤에 던짐
const muWait = () => (MU.walk && !MU.walk.dead && MU.on ? Math.max(0, Math.min(MU.walkLen, 4.2) - (performance.now() - MU.walkT) / 1000) : 0);
function muNowShow(a, b, tm) {
  const el = $('#muNow'); if (!el) return;
  el.style.setProperty('--tc', tm && tm.t ? tm.t.c1 : '#ffd84a'); el.classList.toggle('pit', userPitching());
  el.innerHTML = `<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span><small>${esc(a)}</small><b>${esc(b)}</b></span>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(MU.nowT); MU.nowT = setTimeout(() => el.classList.remove('show'), 5200);
}
function muSetOn(v) {
  MU.on = v; store.set('music', v);
  if (MU.ready) MU.out.gain.setTargetAtTime(v && !MU.hidden ? 0.55 : 0, MU.c.currentTime, 0.1);
  $$('.mus-sw').forEach((b) => b.setAttribute('aria-checked', String(v)));
  const hb = $('#musBtn'); if (hb) { hb.setAttribute('aria-pressed', String(v)); hb.textContent = v ? '🎵' : '🔇'; }
}
document.addEventListener('visibilitychange', () => { MU.hidden = document.hidden; if (MU.ready) MU.out.gain.setTargetAtTime(MU.on && !MU.hidden ? 0.55 : 0, MU.c.currentTime, 0.15); });
// 브라우저는 사용자가 한 번 눌러야 소리를 낼 수 있음 → 첫 터치에 오디오를 깨우고 음악 시작
{
  const _init = AU.init.bind(AU);
  AU.init = function () { _init(); muInit(); };
  const wake = () => { AU.init(); document.removeEventListener('pointerdown', wake, true); document.removeEventListener('keydown', wake, true); };
  document.addEventListener('pointerdown', wake, true); document.addEventListener('keydown', wake, true);
}
