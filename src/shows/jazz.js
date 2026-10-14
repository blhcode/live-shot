import { T, sectionAt } from '../show.js';
import { mtof } from '../music.js';
import { Cast, buildPerson, resetPose, followPath, clamp01, seat, bow } from '../people.js';
import { drumKit, sticks, grandPiano, uprightBass, sax, micStand } from '../props.js';

const STAGE_Y = 0.6;
const M7 = [0, 3, 7, 10];
const D7 = [0, 4, 7, 10];
const MAJ7 = [0, 4, 7, 11];
// Dm7 - G7 - Cmaj7 - A7
const CH = [{ root: 38, q: M7 }, { root: 43, q: D7 }, { root: 36, q: MAJ7 }, { root: 45, q: D7 }];
const BLUES = [60, 63, 65, 66, 67, 70, 72, 75, 77, 79, 82, 84];
const HEAD = [
  [[0, 77, 3], [4, 76, 2], [6, 74, 6], [12, 72, 3]],
  [[0, 71, 4], [6, 74, 2], [8, 77, 4], [12, 76, 3]],
  [[0, 76, 8], [10, 72, 2], [12, 74, 2], [14, 76, 2]],
  [[0, 79, 6], [8, 76, 2], [10, 73, 6]],
];

const SAX_PATH = [[0, -2.6, -0.6], [12, -2.6, -0.6], [12.6, -1.2, 0.3], [20, -1.2, 0.3], [20.6, -2.6, -0.6], [52, -2.6, -0.6]];
const SINGER_PATH = [[0, 0.3, 0.1], [12, 0.3, 0.1], [13, 1.2, -3.6], [39, 1.2, -3.6], [40, 0.3, 0.1], [52, 0.3, 0.1]];

class JazzCast extends Cast {
  constructor(scene) {
    super(scene);
    this.add('singer', buildPerson({ shirt: 0x7a0d1c, pants: 0x111111, skin: 0x8d5524, hair: 0x111111, hairStyle: 'long', dress: { color: 0x7a0d1c, long: true }, sparkle: true }));
    this.stand = micStand(scene, { x: 0.3, y: STAGE_Y, z: 0.45 });
    const saxman = this.add('sax', buildPerson({ shirt: 0x1f2937, pants: 0x111111, skin: 0xc68642, hair: 0x333333, hat: 'cap' }));
    this.horn = sax(saxman);
    const pianist = this.add('piano', buildPerson({ shirt: 0x064e3b, pants: 0x111111, skin: 0xf1c27d, hair: 0xb45309, hairStyle: 'ponytail' }));
    pianist.root.position.set(3.0, STAGE_Y, -1.8);
    pianist.root.rotation.y = Math.PI / 2;
    grandPiano(scene, { x: 3.75, y: STAGE_Y, z: -1.8, ry: -Math.PI / 2 });
    const bassist = this.add('bass', buildPerson({ shirt: 0x7c2d12, pants: 0x1f2937, skin: 0x8d5524, hair: 0x111111, hairStyle: 'afro' }));
    bassist.root.position.set(-1.0, STAGE_Y, -2.4);
    bassist.root.rotation.y = 0.25;
    this.bassInstrument = uprightBass(scene, { x: -0.75, y: STAGE_Y, z: -2.05, ry: 0.25 });
    const drummer = this.add('drums', buildPerson({ shirt: 0xe5e7eb, pants: 0x111111, skin: 0xe0ac8a, hair: 0x9ca3af }));
    drummer.root.position.set(-4.0, STAGE_Y, -3.0);
    drummer.root.rotation.y = 0.45;
    this.kit = drumKit(scene, { x: -4.0, y: STAGE_Y, z: -3.0, shell: 0x5b2c06, head: 0x331a00, scale: 0.85, ry: 0.45 });
    sticks(drummer, 0x999999);
    this.followDefault = 'singer';
  }

  update(t) {
    const bar = t / T.bar;
    const beatPh = ((t / T.beat) % 1 + 1) % 1;
    const sec = sectionAt(Math.max(0, bar));
    const energy = t < 0 ? 0.15 : sec ? sec.energy : 0.3;
    const name = t >= 0 && sec ? sec.name : '';
    const sway = Math.sin((t / T.beat) * Math.PI * 0.5);
    const bounce = Math.abs(Math.sin(beatPh * Math.PI));
    const ending = bar >= 50;

    // Singer
    {
      const p = this.members.singer;
      resetPose(p);
      const pos = followPath(p, SINGER_PATH, bar, t, STAGE_Y, 0);
      const singing = name === 'Head' || name === 'Final head';
      if (!pos.moving) {
        p.pelvis.rotation.z = sway * 0.05;
        if (singing) {
          const [L, R] = p.arms;
          R.upper.rotation.set(-1.0, 0, 0.1);
          R.lower.rotation.x = -1.3;
          L.upper.rotation.set(-0.4 - Math.max(0, Math.sin(t * 0.8)) * 0.8, 0, -0.6);
          L.lower.rotation.x = -0.5;
          p.head.rotation.x = -0.1;
          if (bar >= 46 && bar < 48) {
            const k = clamp01((bar - 46) / 0.5);
            L.upper.rotation.set(-2.2 * k, 0, -0.9);
            p.head.rotation.x = -0.35 * k;
            p.pelvis.rotation.x = -0.15 * k;
          }
        } else {
          // Snapping fingers on 2 and 4 while the band solos.
          for (const a of p.arms) {
            a.upper.rotation.set(-0.5, 0, a.side * 0.2);
            a.lower.rotation.x = -1.2 + (Math.floor(t / T.beat) % 2 && beatPh < 0.15 ? 0.2 : 0);
          }
          p.root.rotation.y = -0.6;
        }
      }
      if (ending) bow(p, clamp01((bar - 50) / 0.5) * (1 - clamp01((bar - 51.2) / 0.5)));
    }

    // Sax
    {
      const p = this.members.sax;
      resetPose(p);
      const pos = followPath(p, SAX_PATH, bar, t, STAGE_Y, 0.25);
      const playing = name === 'Sax solo' || name === 'Trading fours' || name === 'Head' || name === 'Final head';
      const [L, R] = p.arms;
      L.upper.rotation.set(-0.5, 0, -0.1);
      L.lower.rotation.x = -1.3;
      R.upper.rotation.set(-0.3, 0, 0.2);
      R.lower.rotation.x = -1.1;
      this.horn.rotation.x = 0.25;
      if (playing && !pos.moving) {
        p.pelvis.rotation.x = Math.sin(t * 1.3) * 0.08 * energy * 2;
        p.pelvis.rotation.z = sway * 0.06;
        p.head.rotation.x = 0.15;
      }
      if (!playing) {
        L.upper.rotation.set(0, 0, -0.1);
        L.lower.rotation.x = -0.3;
        this.horn.rotation.x = 0.0;
        p.head.rotation.x = 0.1 * bounce;
      }
      // The high note: lean back, horn up.
      const k = clamp01((bar - 17) / 0.4) * (1 - clamp01((bar - 18.6) / 0.4));
      if (k > 0) {
        p.pelvis.rotation.x = -0.45 * k;
        p.head.rotation.x = -0.4 * k;
        this.horn.rotation.x = 0.25 - 0.7 * k;
        p.legs[0].thigh.rotation.x = -0.25 * k;
      }
      if (ending) bow(p, clamp01((bar - 50) / 0.5) * (1 - clamp01((bar - 51.2) / 0.5)));
    }

    // Piano (seated, side-on)
    {
      const p = this.members.piano;
      resetPose(p);
      seat(p, 0.52);
      const solo = name === 'Piano solo' || name === 'Intro';
      const run = clamp01((bar - 25) / 0.3) * (1 - clamp01((bar - 26.5) / 0.3));
      for (const a of p.arms) {
        const ph = (t / T.beat) * (solo ? 4 : 1.5) + (a.side > 0 ? 0.5 : 0);
        a.upper.rotation.set(-0.7, 0, a.side * (0.05 + run * 0.3 * Math.sin(t * 9)));
        a.lower.rotation.x = -0.6 + Math.max(0, Math.sin(ph * Math.PI)) * 0.12;
      }
      p.pelvis.rotation.x = 0.15 + (solo ? Math.sin(t * 1.1) * 0.08 : 0) + run * 0.15;
      p.pelvis.rotation.z = run * Math.sin(t * 3) * 0.12;
      p.head.rotation.x = 0.2 + bounce * 0.1;
      if (ending && bar >= 50.4) {
        p.pelvis.position.y = 0.95;
        p.legs.forEach((l) => { l.thigh.rotation.x = 0; l.shin.rotation.x = 0; });
        p.root.rotation.y = 0;
        bow(p, clamp01((bar - 50.6) / 0.5) * (1 - clamp01((bar - 51.4) / 0.5)));
      } else {
        p.root.rotation.y = Math.PI / 2;
      }
    }

    // Bass
    {
      const p = this.members.bass;
      resetPose(p);
      const solo = name === 'Bass solo';
      const [L, R] = p.arms;
      L.upper.rotation.set(-1.9, 0, 0.35);
      L.lower.rotation.x = -0.9 + Math.sin(t * 2) * 0.05;
      const pluck = Math.pow(Math.abs(Math.sin((t / T.beat) * Math.PI * (solo ? 2 : 1))), 4);
      R.upper.rotation.set(-0.6, 0, 0.5);
      R.lower.rotation.x = -0.8 + pluck * 0.3;
      p.head.rotation.x = 0.2 + bounce * 0.15;
      p.head.rotation.z = solo ? Math.sin(t * 1.4) * 0.15 : 0;
      p.pelvis.rotation.z = sway * 0.05;
      this.bassInstrument.rotation.z = 0.15 + (solo ? Math.sin(t * 2) * 0.04 : 0);
      if (ending) bow(p, clamp01((bar - 50.2) / 0.5) * (1 - clamp01((bar - 51.2) / 0.5)));
    }

    // Drums
    {
      const p = this.members.drums;
      resetPose(p);
      seat(p);
      const fill = name === 'Trading fours' && Math.floor(bar - 32) % 4 >= 2;
      const rate = fill ? 4 : 1;
      const ph = (t / T.beat) * rate;
      const [L, R] = p.arms;
      const hitR = Math.pow(Math.abs(Math.cos(ph * Math.PI)), 3);
      const hitL = fill ? Math.pow(Math.abs(Math.sin(ph * Math.PI)), 3) : 0.2;
      R.upper.rotation.set(-0.9 - hitR * 0.35, 0, 0.5);
      R.lower.rotation.x = -0.8 + hitR * 0.4;
      L.upper.rotation.set(-0.7 - hitL * 0.4, 0, -0.35);
      L.lower.rotation.x = -0.9 + hitL * 0.5;
      p.head.rotation.x = bounce * 0.15;
      const crashK = bar - 36;
      const wob = crashK >= 0 && crashK < 2 ? Math.exp(-crashK * 3) * 0.35 : 0;
      if (crashK >= 0 && crashK < 0.3) L.upper.rotation.set(-2.3, 0, -0.9);
      this.kit.crash.rotation.x = Math.sin(t * 30) * wob;
      this.kit.kickHead.material.emissiveIntensity = 0.1;
    }
  }
}

function swing(m, s, time) {
  return s % 4 === 2 ? time + m.step * 0.66 : time;
}

function arrange(m, { bar, s, time, sec, barInSec, lastBar, firstStep }) {
  const mu = sec.music;
  const ch = CH[bar % 4];
  const next = CH[(bar + 1) % 4];
  const tm = swing(m, s, time);
  const on8 = s % 2 === 0;

  if (mu.drums === 'ride' || mu.drums === 'trade') {
    const drumBar = mu.drums === 'trade' && Math.floor(barInSec) % 4 >= 2;
    if (drumBar) {
      if (on8) m.snare(tm, 0.15 + m.rand() * 0.15);
      if (s % 4 === 0) m.tom(tm, 110 + m.rand() * 80, 0.4);
      if (s === 0 && barInSec % 4 === 2) m.crash(tm, 0.25);
    } else {
      if ([0, 4, 6, 8, 12, 14].includes(s)) m.ride(tm, s % 4 === 2 ? 0.05 : 0.07);
      if (s === 4 || s === 12) m.hat(tm, false, 0.06);
      if (s === 0 && m.rand() < 0.3) m.kick(tm, 0.25, 50);
    }
  } else if (mu.drums === 'brush') {
    if (s % 4 === 0) m.brush(tm, 0.05, T.beat * 0.8);
    if (s === 4 || s === 12) m.hat(tm, false, 0.04);
  } else if (mu.drums === 'end' && firstStep) {
    m.crash(time, 0.35);
    m.ride(time, 0.1);
  }

  if (mu.bass === 'walk' && s % 4 === 0) {
    const beat = s / 4;
    let note;
    if (beat === 0) note = ch.root;
    else if (beat === 1) note = ch.root + ch.q[1];
    else if (beat === 2) note = ch.root + ch.q[2];
    else note = next.root + (m.rand() < 0.5 ? 1 : -1);
    m.tone(time, mtof(note - 12 + 12), T.beat * 0.9, { type: 'triangle', gain: 0.32, cutoff: 700, release: 0.1, attack: 0.005 });
  }
  if (mu.bass === 'solo' && on8 && m.rand() < 0.75) {
    const scale = [0, 3, 5, 7, 10, 12, 15];
    m.tone(tm, mtof(ch.root + scale[Math.floor(m.rand() * scale.length)]), m.step * 1.6, { type: 'triangle', gain: 0.34, cutoff: 900, release: 0.1, attack: 0.005 });
  }

  if (mu.comp && (s === 0 || s === 6)) {
    const voicing = [ch.q[1], ch.q[3], ch.q[2] + 2, ch.q[2]].map((iv) => ch.root + 24 + iv);
    for (const n of voicing) m.tone(tm, mtof(n), m.step * (s === 0 ? 2 : 1.5), { type: 'sine', gain: 0.045, release: 0.35, cutoff: 3000, send: 0.3 });
  }
  if (mu.piano === 'solo' && on8 && m.rand() < 0.8) {
    m.state.p = Math.max(2, Math.min(BLUES.length - 1, (m.state.p ?? 6) + Math.floor(m.rand() * 5) - 2));
    m.tone(tm, mtof(BLUES[m.state.p] + 12), m.step * 1.4, { type: 'triangle', gain: 0.08, release: 0.3, cutoff: 4000, send: 0.3 });
  }
  if (mu.piano === 'intro' && (s === 0 || s === 6 || s === 10)) {
    for (const iv of ch.q) m.tone(tm, mtof(ch.root + 24 + iv), m.step * 3, { type: 'sine', gain: 0.05, release: 0.6, cutoff: 3000, send: 0.4 });
    if (s === 10) m.tone(tm, mtof(BLUES[6 + Math.floor(m.rand() * 4)] + 12), m.step * 2, { type: 'triangle', gain: 0.07, release: 0.5, send: 0.4 });
  }

  if (mu.lead === 'voice') {
    for (const [st, note, len] of HEAD[bar % 4]) {
      if (st === s) m.voice(swing(m, st, time), note - 12, len * m.step, 0.16);
    }
  }
  const saxBar = mu.lead === 'sax' || (mu.lead === 'trade' && Math.floor(barInSec) % 4 < 2);
  if (saxBar && on8) {
    const high = bar >= 17 && bar < 18.5;
    if (high) {
      if (s === 0 && bar === 17) m.tone(time, mtof(84), T.bar * 1.4, { type: 'sawtooth', gain: 0.07, attack: 0.05, release: 0.3, cutoff: 2600, q: 3, vibrato: 7, send: 0.4 });
    } else if (m.rand() < 0.7) {
      m.state.s = Math.max(0, Math.min(BLUES.length - 1, (m.state.s ?? 5) + Math.floor(m.rand() * 5) - 2));
      const long = m.rand() < 0.2;
      m.tone(tm, mtof(BLUES[m.state.s] - 12), m.step * (long ? 4 : 1.5), { type: 'sawtooth', gain: 0.065, attack: 0.02, release: 0.12, cutoff: 1900, q: 3, vibrato: long ? 5 : 0, send: 0.35 });
    }
  }

  if (mu.end && firstStep) {
    for (const iv of [0, 4, 7, 11, 14]) m.tone(time, mtof(36 + 12 + iv), T.bar * 2.5, { type: 'sine', gain: 0.05, release: 1.5, send: 0.6 });
    m.tone(time, mtof(36), T.bar * 2, { type: 'triangle', gain: 0.3, cutoff: 700, release: 1 });
    m.applause(time + 1.5, 0.22, 5);
    m.cheer(time + 1.5, 0.2, 5);
  }
  if (lastBar && s === 0 && (sec.name === 'Sax solo' || sec.name === 'Piano solo' || sec.name === 'Bass solo')) {
    m.applause(time + T.bar * 0.9, 0.12, 2);
  }
}

export default {
  id: 'jazz',
  title: 'The Velvet Room',
  card: 'The Velvet Room',
  kind: 'Late-night jazz club',
  blurb: 'A cosy candle-lit club. A singer, sax, grand piano, upright bass and drums take turns soloing. Slower, but every solo is a cue.',
  lowerThird: 'LIVE AT THE VELVET ROOM · "Midnight in Blue"',
  accent: '#f59e0b',
  bpm: 112,
  preview: 40,
  reverb: 1.6,
  crowdLevel: 0.025,
  subjects: { singer: 'Nina (vocals)', sax: 'Lou (saxophone)', piano: 'Ruby (piano)', bass: 'Theo (double bass)', drums: 'Max (drums)', wide: 'Wide shot (the whole band)' },
  sections: [
    { name: 'Intro', start: 0, end: 4, focus: 'piano', energy: 0.3, music: { piano: 'intro', drums: 'brush', bass: 'walk' } },
    { name: 'Head', start: 4, end: 12, focus: 'singer', energy: 0.5, music: { drums: 'brush', bass: 'walk', comp: true, lead: 'voice' } },
    { name: 'Sax solo', start: 12, end: 20, focus: 'sax', energy: 0.75, music: { drums: 'ride', bass: 'walk', comp: true, lead: 'sax' } },
    { name: 'Piano solo', start: 20, end: 28, focus: 'piano', energy: 0.6, music: { drums: 'ride', bass: 'walk', piano: 'solo' } },
    { name: 'Bass solo', start: 28, end: 32, focus: 'bass', energy: 0.4, music: { drums: 'brush', bass: 'solo', comp: true } },
    { name: 'Trading fours', start: 32, end: 40, focus: 'wide', energy: 0.8, music: { drums: 'trade', bass: 'walk', comp: true, lead: 'trade' } },
    { name: 'Final head', start: 40, end: 48, focus: 'singer', energy: 0.85, music: { drums: 'ride', bass: 'walk', comp: true, lead: 'voice' } },
    { name: 'Ending', start: 48, end: 52, focus: 'wide', energy: 0.4, music: { drums: 'end', end: true } },
  ],
  moments: [
    { id: 'high', bar: 17, dur: 1.5, subject: 'sax', label: 'Sax hits the high note' },
    { id: 'run', bar: 25, dur: 1.5, subject: 'piano', label: 'Lightning piano run' },
    { id: 'drum', bar: 36, dur: 1.5, subject: 'drums', label: 'Drum break + crash' },
    { id: 'note', bar: 46, dur: 2, subject: 'singer', label: 'The big final note' },
    { id: 'bow', bar: 50, dur: 1.5, subject: 'wide', label: 'The band takes a bow' },
  ],
  venue: {
    background: 0x0a0505,
    fog: 0.022,
    fogColor: 0x140806,
    house: 0.45,
    houseDuringShow: 0.12,
    hemi: 0.18,
    room: { w: 30, h: 9, d: 32, z: 9, wall: 0x2a0f0c, floor: 0x24140c },
    stage: { w: 16, d: 6, h: STAGE_Y, front: 1, color: 0x3a2414, strip: false },
    risers: [],
    screen: { style: 'neon', w: 14, h: 5, y: 3.3, z: -5.0, title: 'The Velvet Room', idle: 'LIVE JAZZ NIGHTLY' },
    sconces: true,
    follow: { x: 0, y: 7.5, z: 18, intensity: 260 },
    wash: { pos: [0, 7, 6], target: [0, 0.6, -2], base: 40, energy: 25, white: 0.3 },
    spots: [
      { pos: [-4, 7, 2], target: [-2.6, 1, -0.6], color: 0xffb060, intensity: 120 },
      { pos: [4, 7, 2], target: [3, 1, -1.8], color: 0xffa040, intensity: 110 },
      { pos: [-2, 7, -1], target: [-2.5, 1, -2.6], color: 0xff8c42, intensity: 90 },
    ],
    movers: { count: 3, y: 7.5, zs: [-1.5], span: 4, sweep: 0.15, speed: 0.4, beam: 0.035 },
    crowd: { type: 'tables', x: 11, z: [3.5, 16], tableGap: 3.2, aisle: 1.5, shirts: [0x1f2937, 0x7f1d1d, 0x111111, 0x374151, 0x78350f, 0x1e3a8a] },
    foh: { z: 20.25, w: 4.5, h: 1.2, d: 2.5, desk: false },
    palettes: {
      default: [0xffb060, 0xff7a45], 'Sax solo': [0xffa040, 0xe11d48], 'Piano solo': [0x60a5fa, 0xffb060],
      'Bass solo': [0x7c3aed, 0xff7a45], 'Trading fours': [0xffb060, 0x22d3ee], 'Final head': [0xffc870, 0xe11d48],
    },
  },
  rigs: [
    { id: 1, name: 'FRONT TABLE', pos: [-2.5, 1.5, 2.6], look: [0, 1.8, -1], fov: 45, floorY: 0,
      bounds: { x: [-7, 7], y: [1.0, 2.0], z: [1.8, 3.0] }, fovRange: [12, 75], speed: 2.6, tripod: true },
    { id: 2, name: 'BACK BOOTH', pos: [0, 2.8, 20], look: [0, 1.6, -1.5], fov: 30, floorY: 1.2,
      bounds: { x: [-2, 2], y: [2.4, 3.4], z: [19.4, 21.2] }, fovRange: [5, 55], speed: 2, tripod: true },
    { id: 3, name: 'STAGE SIDE', pos: [6.8, 2.2, 0.4], look: [-1, 1.8, -1.5], fov: 55, floorY: STAGE_Y,
      bounds: { x: [6.2, 7.8], y: [1.6, 2.8], z: [-4, 0.9] }, fovRange: [18, 85], speed: 2.2, shake: 0.8 },
  ],
  createCast: (scene) => new JazzCast(scene),
  arrange,
};
