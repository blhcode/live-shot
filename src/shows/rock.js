import * as THREE from 'three';
import { T, sectionAt } from '../show.js';
import { mtof } from '../music.js';
import { Cast, buildPerson, resetPose, walkCycle, pathAt, clamp01, seat } from '../people.js';
import { drumKit, sticks, keyboard, guitar, handMic } from '../props.js';

const STAGE_Y = 1.2;
const RISER_Y = STAGE_Y + 0.6;

const MIN = [0, 3, 7];
const MAJ = [0, 4, 7];
const CHORDS = [{ root: 45, q: MIN }, { root: 41, q: MAJ }, { root: 48, q: MAJ }, { root: 43, q: MAJ }];
const VERSE = [
  [[0, 76, 2], [3, 76, 2], [6, 74, 2], [8, 72, 4], [12, 69, 3]],
  [[0, 72, 2], [2, 72, 2], [4, 69, 2], [8, 72, 3], [12, 74, 3]],
  [[0, 76, 3], [4, 79, 2], [6, 76, 2], [8, 74, 2], [10, 72, 5]],
  [[0, 74, 4], [4, 71, 2], [6, 67, 6]],
];
const CHORUS = [
  [[0, 81, 6], [6, 79, 2], [8, 76, 4], [12, 79, 3]],
  [[0, 77, 4], [4, 76, 2], [6, 72, 2], [8, 77, 6]],
  [[0, 76, 2], [2, 79, 2], [4, 84, 6], [10, 79, 4]],
  [[0, 83, 4], [4, 79, 4], [8, 74, 6]],
];
const PENTA = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];

const SINGER_PATH = [
  [-2, -12.5, -1], [1.5, -12.5, -1], [3.5, 0, 0.6],
  [12, 0, 0.6], [13, 0, 1.3], [16, 0, 1.3],
  [24, 0, 1.0], [25, -2.6, -1.8], [32, -2.6, -1.8],
  [33.5, -7, 0.8], [35.5, -7, 0.8], [37.5, 7, 0.8], [39.5, 7, 0.8], [40, 3.2, -1.2],
  [44, 3.2, -1.2], [45, 0, 0.9], [52, 0, 0.9], [53, 0, 1.6], [56, 0, 1.6], [57, 0, 0.8],
];
const GUITAR_PATH = [
  [0, -5, -1.2], [24, -5, -1.2], [25.5, -0.5, 0.3], [29, -0.5, 0.3], [30, -0.5, 1.5],
  [32, -0.5, 1.5], [33.5, -5, -1.2], [56, -5, -1.2], [57, -4, 0.5], [64, -4, 0.5],
];

class RockCast extends Cast {
  constructor(scene) {
    super(scene);
    const singer = this.add('singer', buildPerson({ shirt: 0xff2d7a, pants: 0x161616, hair: 0xf2d16b, hairStyle: 'long', skin: 0xf1c27d }));
    handMic(singer);
    const gtr = this.add('guitar', buildPerson({ shirt: 0x14b8a6, pants: 0x2b3a55, hair: 0x111111, hairStyle: 'mohawk', skin: 0x8d5524 }));
    guitar(gtr);
    const drums = this.add('drums', buildPerson({ shirt: 0xf97316, pants: 0x1f2937, hair: 0x7c2d12, skin: 0xc68642 }));
    drums.root.position.set(0, RISER_Y, -4.4);
    this.kit = drumKit(scene, { x: 0, y: RISER_Y, z: -4.4 });
    sticks(drums);
    const keys = this.add('keys', buildPerson({ shirt: 0x8b5cf6, pants: 0x111827, hair: 0xd1d5db, skin: 0xe0ac8a }));
    keys.root.position.set(5.6, STAGE_Y, -1.6);
    keys.root.rotation.y = -0.35;
    this.keyboard = keyboard(scene, { x: 5.6, y: STAGE_Y, z: -1.6, ry: -0.35 });
    this.followDefault = 'singer';
  }

  update(t) {
    const bar = t / T.bar;
    const beatPh = ((t / T.beat) % 1 + 1) % 1;
    const sec = sectionAt(Math.max(0, bar));
    const energy = t < 0 ? 0.15 : sec ? sec.energy : 0.3;
    this.singer(t, bar, beatPh, energy, sec);
    this.guitarist(t, bar, beatPh, energy, sec);
    this.drummer(t, bar, beatPh, energy, sec);
    this.keys(t, bar, beatPh, energy, sec);
  }

  singer(t, bar, beatPh, energy, sec) {
    const p = this.members.singer;
    resetPose(p);
    const pos = pathAt(SINGER_PATH, bar);
    p.root.position.set(pos.x, STAGE_Y, pos.z);
    const [L, R] = p.arms;
    if (pos.moving) {
      const speed = bar < 4 ? 2.4 : 1.4;
      walkCycle(p, t * Math.PI * 2 * speed, 1);
      p.root.rotation.y = Math.atan2(pos.dx, pos.dz) * 0.8;
      if (bar < 4) L.upper.rotation.z = -2.6;
    } else {
      p.root.rotation.y = THREE.MathUtils.lerp(p.root.rotation.y, 0, 0.1);
      p.pelvis.rotation.z = Math.sin(t * Math.PI / (T.beat * 2)) * 0.06 * (0.5 + energy);
      p.pelvis.position.y = 0.95 - Math.abs(Math.sin(beatPh * Math.PI)) * 0.04 * energy;
      L.upper.rotation.z = -0.5 - Math.sin(t * 1.3) * 0.3 * energy;
      L.upper.rotation.x = -0.6 - energy * 0.4;
      L.lower.rotation.x = -0.4;
    }
    R.upper.rotation.x = -1.3;
    R.upper.rotation.z = 0.25;
    R.lower.rotation.x = -1.7;
    p.head.rotation.x = -0.08;

    if (sec && sec.name === 'Drum break') {
      const clap = Math.abs(Math.sin(beatPh * Math.PI));
      L.upper.rotation.set(-2.6, 0, -0.2 - clap * 0.25);
      R.upper.rotation.set(-2.6, 0, 0.2 + clap * 0.25);
      R.lower.rotation.x = -0.2;
      p.root.rotation.y = -0.4;
    }
    const jk = (bar - 50.25) / 0.6;
    if (jk > 0 && jk < 1) {
      p.root.position.y = STAGE_Y + Math.sin(jk * Math.PI) * 0.9;
      p.legs.forEach((l) => { l.thigh.rotation.x = -0.9; l.shin.rotation.x = 1.4; });
      L.upper.rotation.z = -2.8;
    }
    if (sec && sec.name === 'Breakdown') {
      p.pelvis.position.y = 0.6;
      p.legs[0].thigh.rotation.x = -1.4; p.legs[0].shin.rotation.x = 1.4;
      p.legs[1].thigh.rotation.x = 0.2; p.legs[1].shin.rotation.x = 1.3;
      p.head.rotation.x = 0.25;
    }
    if (bar >= 64) {
      const k = clamp01((bar - 64.5) / 0.5);
      L.upper.rotation.z = -2.8 * (1 - k);
      R.upper.rotation.x = -1.3 * (1 - k);
      p.pelvis.rotation.x = k * 0.9;
    }
  }

  guitarist(t, bar, beatPh, energy, sec) {
    const p = this.members.guitar;
    resetPose(p);
    const pos = pathAt(GUITAR_PATH, bar);
    p.root.position.set(pos.x, STAGE_Y, pos.z);
    p.root.rotation.y = pos.moving ? Math.atan2(pos.dx, pos.dz) * 0.7 : 0.35;
    if (pos.moving) walkCycle(p, t * Math.PI * 4, 1);
    const solo = sec && sec.name === 'Guitar solo';
    const strum = Math.sin((t / T.beat) * Math.PI * (solo ? 4 : 2));
    const [fret, pick] = p.arms;
    pick.upper.rotation.set(-0.45, 0, 0.15);
    pick.lower.rotation.set(-1.1 + strum * 0.35 * (0.4 + energy), 0, -0.5);
    fret.upper.rotation.set(-1.0, 0, -0.55);
    fret.lower.rotation.x = -0.6 + Math.sin(t * 7) * 0.05;
    if (!pos.moving) {
      p.pelvis.position.y = 0.95 - Math.abs(Math.sin(beatPh * Math.PI)) * 0.06 * energy;
      p.head.rotation.x = Math.abs(Math.sin(beatPh * Math.PI)) * 0.35 * energy;
      p.legs[0].thigh.rotation.z = -0.12;
      p.legs[1].thigh.rotation.z = 0.12;
    }
    if (solo) {
      p.pelvis.rotation.x = -0.15;
      p.root.rotation.y = 0;
      const k = (bar - 29) / 1.4;
      if (k >= 0 && k <= 1.6) {
        p.pelvis.position.y = 0.55;
        p.legs.forEach((l) => { l.thigh.rotation.x = 0.1; l.shin.rotation.x = 1.5; });
        p.pelvis.rotation.x = -0.25 - Math.sin(clamp01(k) * Math.PI) * 0.6;
        p.head.rotation.x = -0.5;
        fret.upper.rotation.x = -1.6;
      }
    }
  }

  drummer(t, bar, beatPh, energy, sec) {
    const p = this.members.drums;
    resetPose(p);
    seat(p);
    const isBreak = sec && sec.name === 'Drum break';
    const rate = isBreak ? 4 : energy > 0.7 ? 2 : 1;
    const ph = (t / T.beat) * rate;
    const hitL = Math.pow(Math.abs(Math.sin(ph * Math.PI)), 3);
    const hitR = Math.pow(Math.abs(Math.cos(ph * Math.PI)), 3);
    const [L, R] = p.arms;
    L.upper.rotation.set(-0.7 - hitL * 0.5, 0, -0.35);
    L.lower.rotation.x = -0.9 + hitL * 0.6;
    R.upper.rotation.set(-0.7 - hitR * 0.5, 0, 0.35);
    R.lower.rotation.x = -0.9 + hitR * 0.6;
    p.head.rotation.x = Math.abs(Math.sin(beatPh * Math.PI)) * 0.3 * energy;
    p.pelvis.rotation.x = 0.1;
    if (isBreak) p.pelvis.rotation.y = Math.sin(t * 3) * 0.35;
    const crashK = bar - 43;
    let wob = 0;
    if (crashK >= 0 && crashK < 2) {
      if (crashK < 0.3) L.upper.rotation.set(-2.4, 0, -0.9);
      wob = Math.exp(-crashK * 3) * 0.4;
    }
    const since = sec ? bar - sec.start : 9;
    if (since < 0.6 && t > 0) wob = Math.max(wob, (0.6 - since) * 0.4);
    this.kit.crash.rotation.x = Math.sin(t * 30) * wob;
    this.kit.crash.rotation.z = Math.cos(t * 26) * wob;
    this.kit.hihat.position.y = this.kit.hihatY + (beatPh < 0.1 ? 0.02 : 0);
    this.kit.kickHead.material.emissiveIntensity = 0.3 + Math.pow(1 - beatPh, 4) * (t > 0 ? 1.5 : 0) * energy;
  }

  keys(t, bar, beatPh, energy, sec) {
    const p = this.members.keys;
    resetPose(p);
    p.pelvis.position.y = 0.95 - Math.abs(Math.sin(beatPh * Math.PI)) * 0.05 * energy;
    const quiet = sec && (sec.name === 'Breakdown' || sec.name === 'Pre-chorus');
    for (const a of p.arms) {
      const ph = (t / T.beat) * (quiet ? 4 : 2) + (a.side > 0 ? 0.5 : 0);
      a.upper.rotation.set(-0.75, 0, a.side * -0.05);
      a.lower.rotation.x = -0.75 + Math.max(0, Math.sin(ph * Math.PI)) * 0.15;
    }
    p.head.rotation.x = 0.25 + Math.abs(Math.sin(beatPh * Math.PI)) * 0.25 * energy;
    p.head.rotation.z = quiet ? Math.sin(t * 1.5) * 0.15 : 0;
    p.pelvis.rotation.x = 0.12;
    this.keyboard.panel.material.emissiveIntensity = 0.4 + Math.pow(1 - beatPh, 3) * 1.2;
  }
}

function drums(m, kind, bar, s, time, lastBar, sec) {
  if (kind === 'none') return;
  if (kind === 'intro') {
    if (bar === 0) { if (s % 4 === 0) m.stick(time); return; }
    if (s % 4 === 0) m.hat(time, false, 0.08);
    if (s === 0 || (bar === 3 && s >= 8 && s % 2 === 0)) m.tom(time, bar === 3 ? 160 - s * 4 : 90, 0.5);
    if (bar === 3 && s >= 12) m.snare(time, 0.35);
    return;
  }
  if (kind === 'end') {
    if (bar === sec.start && s === 0) { m.kick(time); m.crash(time, 0.45); }
    return;
  }
  if (kind === 'break') {
    if (s % 4 === 0 || (bar % 2 === 0 && s === 6)) m.kick(time, 0.8);
    if (s === 4 || s === 12) m.snare(time, 0.5);
    if (s % 2 === 1) m.tom(time, 120 + (s % 4) * 30, 0.35);
    if (bar === sec.end - 2 && s >= 8) m.tom(time, 220 - (s - 8) * 15, 0.5);
    if (bar === sec.end - 1) { m.snare(time, 0.25 + s * 0.02); if (s === 0) m.crash(time, 0.5); }
    return;
  }
  const full = kind === 'full';
  if (s === 0 || s === 8 || (full && s === 10)) m.kick(time, full ? 0.9 : 0.75);
  if (full && (s === 4 || s === 12)) m.snare(time);
  if (!full && (s === 4 || s === 12)) m.noiseHit(time, { gain: 0.2, decay: 0.05, type: 'bandpass', freq: 3000 });
  if (s % 2 === 0) m.hat(time, full && s === 14, full ? 0.12 : 0.09);
  if (lastBar && full && s >= 12) m.snare(time, 0.3 + (s - 12) * 0.05);
}

function arrange(m, { step, bar, s, time, sec, barInSec, lastBar }) {
  const mu = sec.music;
  const chord = CHORDS[bar % 4];
  const big = sec.energy > 1.1;
  if (s === 0 && barInSec === 0) {
    if (sec.name !== 'Intro' && sec.name !== 'Breakdown') m.crash(time, big ? 0.4 : 0.3);
    if (sec.energy >= 1) m.cheer(time, 0.3, 4);
  }
  drums(m, mu.drums, bar, s, time, lastBar, sec);
  if (mu.bass && s % 2 === 0) {
    const oct = s === 6 || s === 14 ? 12 : 0;
    m.tone(time, mtof(chord.root - 12 + oct), m.step * 1.6, { type: 'sawtooth', gain: sec.energy < 0.4 ? 0.12 : 0.18, cutoff: 500, q: 2, release: 0.05 });
  }
  if (mu.pad && s === 0) {
    m.pad(time, chord.q.map((iv) => chord.root + 12 + iv), T.bar * 0.95, { cutoff: sec.energy > 0.9 ? 2200 : 1300 });
  }
  if (mu.lead === 'vocal' || mu.lead === 'chorus') {
    for (const [st, note, len] of (mu.lead === 'chorus' ? CHORUS : VERSE)[bar % 4]) {
      if (st === s) m.voice(time, note - 12 + (big ? 12 : 0), len * m.step);
    }
  }
  if (mu.lead === 'arp') {
    const tones = [0, ...chord.q, 12].map((iv) => chord.root + 24 + iv);
    const note = tones[[0, 1, 2, 3, 4, 3, 2, 1][s % 8] % tones.length];
    m.tone(time, mtof(note), m.step * 0.8, { type: 'square', gain: sec.energy < 0.4 ? 0.05 : 0.06, cutoff: 2400, release: 0.12, send: 0.5 });
  }
  if (mu.lead === 'guitar') {
    const intense = barInSec >= 4;
    if (s % (intense ? 1 : 2) === 0 && m.rand() <= (intense ? 0.85 : 0.55)) {
      m.state.solo = Math.max(2, Math.min(PENTA.length - 1, (m.state.solo ?? 6) + Math.floor(m.rand() * 5) - 2));
      const note = PENTA[m.state.solo] + (intense && m.rand() > 0.7 ? 12 : 0);
      const len = intense ? m.step * 0.9 : m.step * (m.rand() > 0.7 ? 3 : 1.8);
      m.tone(time, mtof(note - 12), len, { type: 'sawtooth', gain: 0.07, attack: 0.005, release: 0.1, cutoff: 3200, q: 2, dist: true, vibrato: intense ? 0 : 4, send: 0.35 });
    }
  }
  if (mu.drums === 'end' && step === sec.start * 16) {
    for (const iv of [0, 7, 12, 15, 19]) {
      m.tone(time, mtof(45 + iv), T.bar * 2.5, { type: 'sawtooth', gain: 0.05, attack: 0.02, release: 2, cutoff: 2000, dist: true, send: 0.6 });
    }
    m.cheer(time + 0.5, 0.6, 6);
  }
}

export default {
  id: 'rock',
  title: 'THE NEON FOXES',
  card: 'The Neon Foxes',
  kind: 'Arena rock concert',
  blurb: 'A 4-piece rock band in a big arena. Moving lights, a giant LED wall, a guitar solo and a pyro finale.',
  lowerThird: 'LIVE IN CONCERT · "Neon Nights"',
  accent: '#ff2d7a',
  bpm: 120,
  preview: 58,
  subjects: { singer: 'Mia (vocals)', guitar: 'Dex (guitar)', drums: 'Jojo (drums)', keys: 'Sam (keys)', wide: 'Wide shot (whole band)' },
  sections: [
    { name: 'Intro', start: 0, end: 4, focus: 'wide', energy: 0.35, music: { drums: 'intro', pad: true } },
    { name: 'Verse 1', start: 4, end: 12, focus: 'singer', energy: 0.45, music: { drums: 'light', bass: true, pad: true, lead: 'vocal' } },
    { name: 'Pre-chorus', start: 12, end: 16, focus: 'keys', energy: 0.55, music: { drums: 'light', bass: true, pad: true, lead: 'arp' } },
    { name: 'Chorus', start: 16, end: 24, focus: 'wide', energy: 1.0, music: { drums: 'full', bass: true, pad: true, lead: 'chorus' } },
    { name: 'Guitar solo', start: 24, end: 32, focus: 'guitar', energy: 0.85, music: { drums: 'full', bass: true, lead: 'guitar' } },
    { name: 'Verse 2', start: 32, end: 40, focus: 'singer', energy: 0.5, music: { drums: 'light', bass: true, pad: true, lead: 'vocal' } },
    { name: 'Drum break', start: 40, end: 44, focus: 'drums', energy: 0.8, music: { drums: 'break' } },
    { name: 'Chorus 2', start: 44, end: 52, focus: 'singer', energy: 1.0, music: { drums: 'full', bass: true, pad: true, lead: 'chorus' } },
    { name: 'Breakdown', start: 52, end: 56, focus: 'keys', energy: 0.25, music: { drums: 'none', bass: true, pad: true, lead: 'arp' } },
    { name: 'Final chorus', start: 56, end: 64, focus: 'wide', energy: 1.25, music: { drums: 'full', bass: true, pad: true, lead: 'chorus' } },
    { name: 'Outro', start: 64, end: 67, focus: 'wide', energy: 0.6, music: { drums: 'end' } },
  ],
  moments: [
    { id: 'runon', bar: 1.5, dur: 2.5, subject: 'singer', label: 'Singer runs on stage' },
    { id: 'slide', bar: 29, dur: 1.5, subject: 'guitar', label: 'Guitar knee slide' },
    { id: 'crash', bar: 42.5, dur: 1.5, subject: 'drums', label: 'Drum fill + cymbal crash' },
    { id: 'jump', bar: 50, dur: 1.5, subject: 'singer', label: 'Singer jumps' },
    { id: 'pyro', bar: 62, dur: 2, subject: 'wide', label: 'Pyro finale' },
  ],
  venue: {
    stage: { w: 26, d: 9, h: STAGE_Y, front: 2 },
    risers: [{ x: 0, z: -4.2, w: 4, d: 3, h: 0.6 }],
    wedges: [-5, -0.8, 0.8, 5.5],
    speakers: true,
    barrier: 4.6,
    truss: { y: 9.5, zs: [1.5, -5.5], w: 24 },
    movers: { count: 6, y: 9.2, zs: [1.5, -5.5], span: 9 },
    screen: { style: 'led', w: 18, h: 6.75, y: 5.6, z: -6.9, title: 'THE NEON FOXES' },
    foh: { z: 23.5, w: 10, h: 3, d: 4 },
    crowd: { type: 'standing', count: 420, x: 15, z: [5.4, 18.9] },
    strobe: ['Final chorus'],
    palettes: {
      default: [0x3b82f6, 0x8b5cf6], 'Verse 1': [0xff2d7a, 0x3b82f6], 'Pre-chorus': [0x8b5cf6, 0x22d3ee],
      Chorus: [0xfacc15, 0xff2d7a], 'Guitar solo': [0xef4444, 0xf97316], 'Verse 2': [0x22d3ee, 0xff2d7a],
      'Drum break': [0xf97316, 0xffffff], 'Chorus 2': [0xfacc15, 0x22c55e], Breakdown: [0x6366f1, 0x0ea5e9],
      'Final chorus': [0xffffff, 0xff2d7a], Outro: [0xfacc15, 0xff2d7a],
    },
    pyro: [
      { bar: 16, xs: [-8, 8], n: 60 },
      { bar: 62, xs: [-8, -4.5, 4.5, 8] }, { bar: 62.5, xs: [-8, -4.5, 4.5, 8] },
      { bar: 63, xs: [-8, -4.5, 4.5, 8] }, { bar: 64, xs: [-8, -4.5, 4.5, 8] },
    ],
    confetti: [62, 66],
  },
  rigs: [
    { id: 1, name: 'PIT', pos: [-4, 1.75, 3.6], look: [0, 2.3, 0.3], fov: 42, floorY: 0,
      bounds: { x: [-12, 12], y: [1.0, 2.6], z: [2.6, 4.2] }, fovRange: [12, 70], speed: 3.2, tripod: true },
    { id: 2, name: 'FOH RISER', pos: [0, 4.7, 23], look: [0, 3, -2], fov: 32, floorY: 3,
      bounds: { x: [-4.5, 4.5], y: [4.2, 5.8], z: [22, 24.8] }, fovRange: [3.5, 55], speed: 2.2, tripod: true },
    { id: 3, name: 'STAGE WING', pos: [11.5, 2.85, 0.5], look: [0, 2.4, -1], fov: 55, floorY: STAGE_Y,
      bounds: { x: [9.6, 12.8], y: [2.2, 3.6], z: [-6, 2.3] }, fovRange: [18, 80], speed: 2.6, shake: 1 },
  ],
  createCast: (scene) => new RockCast(scene),
  arrange,
};
