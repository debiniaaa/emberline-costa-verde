// EMBERLINE: Costa Verde — audio.js
// One job: all sound, synthesized live with WebAudio. No audio files exist.
// A sunset synthwave loop (bass + pads + hats) and every effect: gunshots,
// punches, sirens, engine hum, crashes, pickups, mission jingles.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.muted = false;
    this.musicTimer = null;
    this.sirenNodes = null;
    this.engineNodes = null;
    this.step = 0;
    this.nextNoteTime = 0;
    this.bpm = 104;
  }

  // Called from the first user gesture; safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
      this.startMusic();
    } catch (err) {
      this.ctx = null; // headless / no audio device: the game stays silent, never crashes
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  // ---- music: A-minor sunset groove, 8 steps a bar, scheduled ahead ----
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    // Am – F – C – G progression, one bar each, bass roots in Hz.
    this.roots = [55.0, 43.65, 65.41, 49.0];
    this.chords = [
      [220.0, 261.63, 329.63], [174.61, 220.0, 261.63],
      [261.63, 329.63, 392.0], [196.0, 246.94, 293.66],
    ];
    this.musicTimer = setInterval(() => this.scheduleMusic(), 90);
  }

  scheduleMusic() {
    if (!this.ctx) return;
    const stepDur = 60 / this.bpm / 2;
    while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
      const t = this.nextNoteTime;
      const bar = Math.floor(this.step / 8) % 4;
      const s = this.step % 8;
      if (s === 0 || s === 3 || s === 6) this.playBass(this.roots[bar], t, stepDur * 1.8);
      if (s === 0) this.playPad(this.chords[bar], t, stepDur * 8);
      if (s % 2 === 0) this.playHat(t, s === 4 ? 0.10 : 0.045);
      if (s === 2 || s === 5 || s === 7) this.playPluck(this.chords[bar][(s + bar) % 3] * 2, t);
      this.step++;
      this.nextNoteTime += stepDur;
    }
  }

  playBass(freq, t, dur) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = 320;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  playPad(freqs, t, dur) {
    freqs.forEach((fr) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07, t + dur * 0.3);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.musicGain);
      o.start(t); o.stop(t + dur + 0.05);
    });
  }

  playHat(t, vol) {
    const len = Math.floor(this.ctx.sampleRate * 0.03);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.value = vol;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(this.musicGain);
    src.start(t);
  }

  playPluck(freq, t) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + 0.2);
  }

  // ---- effects ----
  noiseBurst(dur, filterFreq, vol, type = 'lowpass') {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start();
  }

  tone(freq, dur, vol, type = 'sine', slideTo = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  gunshot() { this.noiseBurst(0.14, 1800, 0.8); this.tone(160, 0.1, 0.5, 'square', 60); }
  punch() { this.noiseBurst(0.08, 500, 0.5); }
  crash() { this.noiseBurst(0.3, 700, 0.7); this.tone(90, 0.25, 0.4, 'sawtooth', 40); }
  pickup() { this.tone(660, 0.09, 0.35); setTimeout(() => this.tone(990, 0.12, 0.35), 90); }
  click() { this.tone(1200, 0.04, 0.2, 'square'); }
  denied() { this.tone(180, 0.16, 0.3, 'square', 120); }
  missionStart() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 0.35), i * 110)); }
  missionComplete() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 0.35), i * 130)); }
  missionFail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 0.3, 'triangle'), i * 150)); }
  phoneRing() { this.tone(880, 0.12, 0.25); setTimeout(() => this.tone(880, 0.12, 0.25), 180); }

  startSiren() {
    if (!this.ctx || this.sirenNodes) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = 700;
    g.gain.value = 0.06;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.9;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 280;
    lfo.connect(lfoGain); lfoGain.connect(o.frequency);
    o.connect(g); g.connect(this.sfxGain);
    o.start(); lfo.start();
    this.sirenNodes = { o, lfo, g };
  }

  stopSiren() {
    if (!this.sirenNodes) return;
    try { this.sirenNodes.o.stop(); this.sirenNodes.lfo.stop(); } catch (e) {}
    this.sirenNodes = null;
  }

  startEngine() {
    if (!this.ctx || this.engineNodes) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 55;
    f.type = 'lowpass'; f.frequency.value = 500;
    g.gain.value = 0.05;
    o.connect(f); f.connect(g); g.connect(this.sfxGain);
    o.start();
    this.engineNodes = { o, g };
  }

  setEngine(speedRatio) {
    if (!this.engineNodes) return;
    this.engineNodes.o.frequency.value = 50 + speedRatio * 140;
    this.engineNodes.g.gain.value = 0.03 + speedRatio * 0.06;
  }

  stopEngine() {
    if (!this.engineNodes) return;
    try { this.engineNodes.o.stop(); } catch (e) {}
    this.engineNodes = null;
  }
}
