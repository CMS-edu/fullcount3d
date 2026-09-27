/* ===================== AUDIO (WebAudio 합성) ===================== */
const AU = {
  ctx: null, master: null, on: store.get('sound', true), crowdGain: null, crowdFilter: null, noiseBuf: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = this.on ? 0.8 : 0; this.master.connect(c.destination);
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = last * 0.6 + w * 0.4; d[i] = last; }
    this.noiseBuf = b;
    // 관중 웅성임 (루프)
    const src = c.createBufferSource(); src.buffer = b; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.6;
    const g = c.createGain(); g.gain.value = 0.05;
    src.connect(bp); bp.connect(g); g.connect(this.master); src.start();
    this.crowdGain = g; this.crowdFilter = bp;
  },
  setOn(v) { this.on = v; store.set('sound', v); if (this.master) this.master.gain.setTargetAtTime(v ? 0.8 : 0, this.ctx.currentTime, 0.05); },
  noise(t, dur, f, q, gain, type = 'bandpass', attack = 0.002) {
    const c = this.ctx; if (!c || !this.on) return;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.playbackRate.value = 1 + Math.random() * 0.2;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  tone(t, dur, f0, f1, gain, type = 'sine') {
    const c = this.ctx; if (!c || !this.on) return;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  now() { return this.ctx ? this.ctx.currentTime : 0; },
  crack(q = 1) { const t = this.now(); this.noise(t, 0.09 + q * 0.05, 2400, 1.2, 0.9 * (0.5 + q * 0.5), 'bandpass', 0.001); this.tone(t, 0.08, 900, 300, 0.35 * q, 'triangle'); this.noise(t, 0.2, 700, 0.8, 0.25); },
  foulTip() { const t = this.now(); this.noise(t, 0.06, 3200, 2, 0.4, 'bandpass', 0.001); },
  mitt() { const t = this.now(); this.noise(t, 0.12, 380, 1.4, 0.8, 'lowpass', 0.001); this.tone(t, 0.07, 160, 70, 0.4); },
  glove() { const t = this.now(); this.noise(t, 0.08, 600, 1.2, 0.35, 'lowpass', 0.001); },
  swish() { const t = this.now(); this.noise(t, 0.18, 1400, 0.7, 0.18, 'bandpass', 0.05); },
  click() { const t = this.now(); this.tone(t, 0.05, 1200, 900, 0.12, 'square'); },
  whistle() { const t = this.now(); this.tone(t, 0.25, 1800, 1700, 0.08, 'sine'); },
  cheer(level = 1, dur = 2.4) {
    const c = this.ctx; if (!c || !this.on) return; const t = c.currentTime;
    this.noise(t, dur, 900, 0.4, 0.22 * level, 'bandpass', 0.25);
    this.noise(t + 0.05, dur * 0.9, 2200, 0.6, 0.1 * level, 'bandpass', 0.3);
    this.crowdGain.gain.cancelScheduledValues(t); this.crowdGain.gain.setTargetAtTime(0.05 + 0.1 * level, t, 0.1); this.crowdGain.gain.setTargetAtTime(0.05, t + dur * 0.6, 0.8);
  },
  groan() { const c = this.ctx; if (!c || !this.on) return; const t = c.currentTime; this.noise(t, 1.2, 300, 0.7, 0.16, 'bandpass', 0.2); },
  boom() { const t = this.now(); this.noise(t, 1.1, 180, 0.8, 0.7, 'lowpass', 0.002); this.tone(t, 0.5, 90, 40, 0.5); },
  drum(pattern = 'x.x.xxx.', bpm = 150) {
    const c = this.ctx; if (!c || !this.on) return; const t0 = c.currentTime + 0.05, step = 60 / bpm / 2;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === 'x') { this.tone(t0 + i * step, 0.18, 150, 55, 0.55); this.noise(t0 + i * step, 0.05, 1800, 1, 0.12, 'highpass'); }
      if (pattern[i] === 'c') { this.noise(t0 + i * step, 0.08, 2600, 1.5, 0.3, 'bandpass'); }
    }
  },
};

