import { T, STANDBY_SECONDS, sectionAt } from './show.js';

const LOOKAHEAD = 0.2;

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Synth engine + 16th-note sequencer. Each show's `arrange(m, info)` decides what plays on every step.
export class Music {
  constructor(show) {
    this.show = show;
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
    for (let i = 0; i < 1024; i++) this.distCurve[i] = Math.tanh(((i / 1023) * 2 - 1) * 6);

    this.reverb = this.makeReverb(show.reverb ?? 2.2);
    this.t0 = null;
    this.nextStep = 0;
    this.timer = null;
    this.rand = rng(42);
    this.state = {};
    this.crowdGain = null;
  }

  get step() {
    return T.bar / 16;
  }

  makeReverb(seconds) {
    const ctx = this.ctx;
    const conv = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * seconds);
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
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
  }

  schedule() {
    const sections = this.show.sections;
    const lastStep = sections[sections.length - 1].end * 16;
    while (this.nextStep < lastStep) {
      const when = this.t0 + this.nextStep * this.step;
      if (when > this.ctx.currentTime + LOOKAHEAD) break;
      const step = this.nextStep;
      const bar = Math.floor(step / 16);
      const sec = sectionAt(bar);
      if (sec) {
        this.show.arrange(this, {
          step, bar, s: step % 16, time: Math.max(when, this.ctx.currentTime), sec,
          barInSec: bar - sec.start, lastBar: bar === sec.end - 1, firstStep: step === sec.start * 16,
        });
      }
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
    this.crowdIdle = this.show.crowdLevel ?? 0.05;
    g.gain.value = this.crowdIdle;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
    this.crowdGain = g;
  }

  cheer(time, amount = 0.5, length = 3) {
    if (!this.crowdGain) return;
    const g = this.crowdGain.gain;
    g.setTargetAtTime(amount, time, 0.15);
    g.setTargetAtTime(this.crowdIdle * 0.8, time + length * 0.4, length * 0.3);
  }

  applause(time, amount = 0.25, length = 3) {
    for (let i = 0; i < length * 30; i++) {
      const tt = time + Math.random() * length;
      const fade = 1 - (tt - time) / length;
      this.noiseHit(tt, { gain: amount * fade * (0.5 + Math.random() * 0.5), decay: 0.03, type: 'bandpass', freq: 1500 + Math.random() * 2000, q: 1.2 });
    }
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

  tone(time, freq, dur, { type = 'sawtooth', gain = 0.1, attack = 0.01, release = 0.1, cutoff = 4000, q = 0.7, detune = 0, send = 0, dist = false, vibrato = 0, glide = 0 } = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (glide) {
      osc.frequency.setValueAtTime(freq * glide, time);
      osc.frequency.exponentialRampToValueAtTime(freq, time + 0.08);
    }
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

  noiseHit(time, { gain = 0.3, decay = 0.1, type = 'highpass', freq = 7000, q = 0.7, send = 0, attack = 0 } = {}) {
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
    if (attack) {
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(gain, time + attack);
    } else {
      g.gain.setValueAtTime(gain, time);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
    src.start(time, Math.random());
    src.stop(time + attack + decay + 0.05);
  }

  // Rising filtered noise for EDM build-ups.
  sweep(time, dur, gain = 0.15) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(300, time);
    f.frequency.exponentialRampToValueAtTime(9000, time + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.1);
    src.connect(f).connect(g).connect(this.master);
    src.start(time);
    src.stop(time + dur + 0.2);
  }

  kick(time, gain = 0.9, low = 42) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(low, time + 0.12);
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

  clap(time, gain = 0.4) {
    for (let i = 0; i < 3; i++) this.noiseHit(time + i * 0.011, { gain: gain * 0.6, decay: 0.03, type: 'bandpass', freq: 1300, q: 1 });
    this.noiseHit(time + 0.033, { gain, decay: 0.16, type: 'bandpass', freq: 1200, q: 0.8, send: 0.4 });
  }

  hat(time, open = false, gain = 0.12) {
    this.noiseHit(time, { gain, decay: open ? 0.28 : 0.045, freq: 8000 });
  }

  ride(time, gain = 0.08) {
    this.noiseHit(time, { gain, decay: 0.35, freq: 6500, type: 'highpass', send: 0.2 });
    this.tone(time, 3150, 0.02, { type: 'sine', gain: gain * 0.25, release: 0.3, cutoff: 8000 });
  }

  brush(time, gain = 0.05, len = 0.2) {
    this.noiseHit(time, { gain, decay: len, type: 'bandpass', freq: 3500, q: 0.6, attack: 0.04 });
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

  bell(time, freq, gain = 0.06, len = 1.2) {
    this.tone(time, freq, 0.01, { type: 'sine', gain, release: len, cutoff: 9000, send: 0.6 });
    this.tone(time, freq * 2.76, 0.01, { type: 'sine', gain: gain * 0.3, release: len * 0.4, cutoff: 9000, send: 0.4 });
  }

  pluck(time, freq, gain = 0.1, len = 0.25) {
    this.tone(time, freq, 0.01, { type: 'triangle', gain, release: len, cutoff: 2500, send: 0.3 });
  }

  brass(time, notes, dur, gain = 0.06) {
    for (const n of notes) {
      for (const det of [-6, 6]) {
        this.tone(time, mtof(n), dur, { type: 'sawtooth', gain, attack: 0.03, release: 0.25, cutoff: 2200, q: 1.5, detune: det, send: 0.35 });
      }
    }
  }

  pad(time, notes, dur, { gain = 0.028, cutoff = 1300, attack = 0.25 } = {}) {
    for (const n of notes) {
      for (const det of [-8, 8]) {
        this.tone(time, mtof(n), dur, { type: 'sawtooth', gain, attack, release: 0.4, cutoff, detune: det, send: 0.5 });
      }
    }
  }

  voice(time, note, dur, gain = 0.17) {
    this.tone(time, mtof(note), dur, { type: 'triangle', gain, attack: 0.04, release: 0.15, cutoff: 2600, vibrato: 5, send: 0.45 });
    this.tone(time, mtof(note), dur, { type: 'sawtooth', gain: gain * 0.2, attack: 0.05, release: 0.15, cutoff: 1500, q: 4, send: 0.3 });
  }
}
