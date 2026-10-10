import { BAR, SECTIONS, STANDBY_SECONDS, sectionAt } from './show.js';

const STEP = BAR / 16;
const LOOKAHEAD = 0.2;

const MIN = [0, 3, 7];
const MAJ = [0, 4, 7];
// Am - F - C - G
const CHORDS = [
  { root: 45, q: MIN },
  { root: 41, q: MAJ },
  { root: 48, q: MAJ },
  { root: 43, q: MAJ },
];

// [step, midi, lengthInSteps] per bar of the 4-bar progression.
const VERSE_MELODY = [
  [[0, 76, 2], [3, 76, 2], [6, 74, 2], [8, 72, 4], [12, 69, 3]],
  [[0, 72, 2], [2, 72, 2], [4, 69, 2], [8, 72, 3], [12, 74, 3]],
  [[0, 76, 3], [4, 79, 2], [6, 76, 2], [8, 74, 2], [10, 72, 5]],
  [[0, 74, 4], [4, 71, 2], [6, 67, 6]],
];
const CHORUS_MELODY = [
  [[0, 81, 6], [6, 79, 2], [8, 76, 4], [12, 79, 3]],
  [[0, 77, 4], [4, 76, 2], [6, 72, 2], [8, 77, 6]],
  [[0, 76, 2], [2, 79, 2], [4, 84, 6], [10, 79, 4]],
  [[0, 83, 4], [4, 79, 4], [8, 74, 6]],
];
const PENTA = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Music {
  constructor() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.recordDest = ctx.createMediaStreamDestination();
    comp.connect(this.recordDest);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      this.distCurve[i] = Math.tanh(x * 6);
    }

    this.reverb = this.makeReverb();
    this.t0 = null;
    this.nextStep = 0;
    this.timer = null;
    this.soloRand = rng(42);
    this.crowdGain = null;
  }

  makeReverb() {
    const ctx = this.ctx;
    const conv = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    conv.buffer = buf;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    conv.connect(wet);
    wet.connect(this.master);
    return conv;
  }

  // Show time in seconds; negative during standby.
  get time() {
    if (this.t0 === null) return -STANDBY_SECONDS;
    return this.ctx.currentTime - this.t0;
  }

  begin() {
    this.t0 = this.ctx.currentTime + STANDBY_SECONDS;
    this.startCrowd();
    this.timer = setInterval(() => this.schedule(), 25);
  }

  pause() { return this.ctx.suspend(); }
  resume() { return this.ctx.resume(); }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    const g = this.master.gain;
    g.setTargetAtTime(0, this.ctx.currentTime, 0.5);
  }

  schedule() {
    const lastStep = SECTIONS[SECTIONS.length - 1].end * 16;
    while (this.nextStep < lastStep) {
      const when = this.t0 + this.nextStep * STEP;
      if (when > this.ctx.currentTime + LOOKAHEAD) break;
      this.playStep(this.nextStep, Math.max(when, this.ctx.currentTime));
      this.nextStep++;
    }
  }

  // ---------- crowd ----------
  startCrowd() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
    this.crowdGain = g;
  }

  cheer(time, amount = 0.5, length = 3) {
    if (!this.crowdGain) return;
    const g = this.crowdGain.gain;
    g.setTargetAtTime(amount, time, 0.15);
    g.setTargetAtTime(0.04, time + length * 0.4, length * 0.3);
  }

  // ---------- instruments ----------
  env(gainNode, time, peak, attack, hold, release) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, time);
    g.linearRampToValueAtTime(peak, time + attack);
    g.setValueAtTime(peak, time + attack + hold);
    g.exponentialRampToValueAtTime(0.0001, time + attack + hold + release);
    return time + attack + hold + release + 0.05;
  }

  tone(time, freq, dur, { type = 'sawtooth', gain = 0.1, attack = 0.01, release = 0.1, cutoff = 4000, q = 0.7, detune = 0, send = 0, dist = false, vibrato = 0 } = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    let node = osc;
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.value = vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(time);
      lfo.stop(time + dur + release + 0.1);
    }
    if (dist) {
      const ws = ctx.createWaveShaper();
      ws.curve = this.distCurve;
      node.connect(ws);
      node = ws;
    }
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    f.Q.value = q;
    const g = ctx.createGain();
    node.connect(f).connect(g).connect(this.master);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s).connect(this.reverb);
    }
    const end = this.env(g, time, gain, attack, Math.max(0, dur - attack), release);
    osc.start(time);
    osc.stop(end);
  }

  noiseHit(time, { gain = 0.3, decay = 0.1, type = 'highpass', freq = 7000, q = 0.7, send = 0 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    src.connect(f).connect(g).connect(this.master);
    if (send) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s).connect(this.reverb);
    }
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    src.start(time, Math.random());
    src.stop(time + decay + 0.05);
  }

  kick(time, gain = 0.9) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);
    osc.connect(g).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.4);
  }

  snare(time, gain = 0.45) {
    this.noiseHit(time, { gain, decay: 0.16, type: 'bandpass', freq: 2200, q: 0.5, send: 0.3 });
    this.tone(time, 190, 0.03, { type: 'triangle', gain: gain * 0.6, release: 0.08, cutoff: 3000 });
  }

  hat(time, open = false, gain = 0.12) {
    this.noiseHit(time, { gain, decay: open ? 0.28 : 0.045, freq: 8000 });
  }

  crash(time, gain = 0.3) {
    this.noiseHit(time, { gain, decay: 1.6, freq: 5000, send: 0.4 });
  }

  tom(time, pitch, gain = 0.6) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(pitch, time);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, time + 0.25);
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
    osc.connect(g).connect(this.master);
    osc.start(time);
    osc.stop(time + 0.35);
  }

  stick(time) {
    this.tone(time, 2400, 0.01, { type: 'square', gain: 0.12, release: 0.03, cutoff: 6000 });
  }

  // ---------- sequencing ----------
  playStep(step, time) {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const sec = sectionAt(bar);
    if (!sec) return;
    const m = sec.music;
    const chord = CHORDS[bar % 4];
    const barInSec = bar - sec.start;
    const lastBarOfSec = bar === sec.end - 1;
    const big = sec.energy > 1.1;

    if (s === 0 && barInSec === 0) {
      if (sec.name !== 'Intro' && sec.name !== 'Breakdown') this.crash(time, big ? 0.4 : 0.3);
      if (sec.energy >= 1) this.cheer(time, 0.3, 4);
    }

    this.playDrums(m.drums, bar, s, time, lastBarOfSec, sec);

    if (m.bass && s % 2 === 0) {
      const oct = s === 6 || s === 14 ? 12 : 0;
      this.tone(time, mtof(chord.root - 12 + oct), STEP * 1.6, {
        type: 'sawtooth', gain: sec.energy < 0.4 ? 0.12 : 0.18, cutoff: 500, q: 2, release: 0.05,
      });
    }

    if (m.pad && s === 0) {
      for (const iv of chord.q) {
        const f = mtof(chord.root + 12 + iv);
        for (const det of [-8, 8]) {
          this.tone(time, f, BAR * 0.95, {
            type: 'sawtooth', gain: 0.028, attack: 0.25, release: 0.4, cutoff: sec.energy > 0.9 ? 2200 : 1300, detune: det, send: 0.5,
          });
        }
      }
    }

    if (m.lead === 'vocal' || m.lead === 'chorus') {
      const mel = (m.lead === 'chorus' ? CHORUS_MELODY : VERSE_MELODY)[bar % 4];
      for (const [st, note, len] of mel) {
        if (st === s) {
          const shift = big ? 12 : 0;
          this.tone(time, mtof(note - 12 + shift), len * STEP, {
            type: 'triangle', gain: 0.17, attack: 0.04, release: 0.15, cutoff: 2600, vibrato: 5, send: 0.45,
          });
          this.tone(time, mtof(note - 12 + shift), len * STEP, {
            type: 'sawtooth', gain: 0.035, attack: 0.05, release: 0.15, cutoff: 1500, q: 4, send: 0.3,
          });
        }
      }
    }

    if (m.lead === 'arp') {
      const tones = [0, ...chord.q, 12].map((iv) => chord.root + 24 + iv);
      const order = [0, 1, 2, 3, 4, 3, 2, 1];
      const note = tones[order[s % 8] % tones.length];
      this.tone(time, mtof(note), STEP * 0.8, {
        type: 'square', gain: sec.energy < 0.4 ? 0.05 : 0.06, cutoff: 2400, release: 0.12, send: 0.5,
      });
    }

    if (m.lead === 'guitar') this.playSolo(bar, s, time, sec);

    if (m.drums === 'end' && step === sec.start * 16) {
      for (const iv of [0, 7, 12, 15, 19]) {
        this.tone(time, mtof(45 + iv), BAR * 2.5, { type: 'sawtooth', gain: 0.05, attack: 0.02, release: 2, cutoff: 2000, dist: true, send: 0.6 });
      }
      this.cheer(time + 0.5, 0.6, 6);
    }
  }

  playDrums(kind, bar, s, time, lastBar, sec) {
    if (kind === 'none') return;
    if (kind === 'intro') {
      if (bar === 0) {
        if (s % 4 === 0) this.stick(time);
        return;
      }
      if (s % 4 === 0) this.hat(time, false, 0.08);
      if (s === 0 || (bar === 3 && s >= 8 && s % 2 === 0)) this.tom(time, bar === 3 ? 160 - s * 4 : 90, 0.5);
      if (bar === 3 && s >= 12) this.snare(time, 0.35);
      return;
    }
    if (kind === 'end') {
      if (bar === sec.start && s === 0) { this.kick(time); this.crash(time, 0.45); }
      return;
    }
    if (kind === 'break') {
      const pattern = bar % 2 === 0;
      if (s % 4 === 0 || (pattern && s === 6)) this.kick(time, 0.8);
      if (s === 4 || s === 12) this.snare(time, 0.5);
      if (s % 2 === 1) this.tom(time, 120 + (s % 4) * 30, 0.35);
      if (bar === sec.end - 2 && s >= 8) this.tom(time, 220 - (s - 8) * 15, 0.5);
      if (bar === sec.end - 1) {
        this.snare(time, 0.25 + s * 0.02);
        if (s === 0) this.crash(time, 0.5);
      }
      return;
    }
    const full = kind === 'full';
    if (s === 0 || s === 8 || (full && s === 10)) this.kick(time, full ? 0.9 : 0.75);
    if (full && (s === 4 || s === 12)) this.snare(time);
    if (!full && (s === 4 || s === 12)) this.noiseHit(time, { gain: 0.2, decay: 0.05, type: 'bandpass', freq: 3000 });
    if (s % 2 === 0) this.hat(time, full && s === 14, full ? 0.12 : 0.09);
    if (lastBar && full && s >= 12) this.snare(time, 0.3 + (s - 12) * 0.05);
  }

  playSolo(bar, s, time, sec) {
    const r = this.soloRand;
    const intense = bar - sec.start >= 4;
    const density = intense ? 0.85 : 0.55;
    if (s % (intense ? 1 : 2) !== 0) return;
    if (r() > density) return;
    if (!this.soloIdx) this.soloIdx = 6;
    this.soloIdx = Math.max(2, Math.min(PENTA.length - 1, this.soloIdx + Math.floor(r() * 5) - 2));
    const note = PENTA[this.soloIdx] + (intense && r() > 0.7 ? 12 : 0);
    const len = intense ? STEP * 0.9 : STEP * (r() > 0.7 ? 3 : 1.8);
    this.tone(time, mtof(note - 12), len, {
      type: 'sawtooth', gain: 0.07, attack: 0.005, release: 0.1, cutoff: 3200, q: 2, dist: true, vibrato: intense ? 0 : 4, send: 0.35,
    });
  }
}
