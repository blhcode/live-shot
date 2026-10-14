import { T, sectionAt } from '../show.js';
import { mtof } from '../music.js';
import { Cast, buildPerson, resetPose, followPath, clamp01, armsUp, bow } from '../people.js';
import { djBooth, podium, handMic } from '../props.js';

const STAGE_Y = 1.0;
const DJ_Y = STAGE_Y + 0.8;
const MIN = [0, 3, 7];
const MAJ = [0, 4, 7];
const CH = [{ root: 41, q: MIN }, { root: 37, q: MAJ }, { root: 44, q: MAJ }, { root: 39, q: MAJ }];
const HOOK = [[0, 7], [3, 7], [6, 12], [8, 10], [10, 7], [12, 3], [14, 5]];

const MC_PATH = [
  [0, -10, 0.6], [7, -10, 0.6], [8.5, -3, 1.2], [10.5, 4, 1.2], [12.5, -4, 1.2], [14.5, 0, 1.3],
  [16, 0, 1.3], [17, -6, 1.1], [24, -6, 1.1], [25, -9.5, 0.4], [40, -9.5, 0.4],
  [41, -2, 1.3], [42.5, 3, 1.3], [44, 0, 1.4], [52, 0, 1.4], [53, 3.5, 1.2], [60, 3.5, 1.2],
];

class ClubCast extends Cast {
  constructor(scene) {
    super(scene);
    this.booth = djBooth(scene, { x: 0, y: DJ_Y, z: -1.9 });
    const dj = this.add('dj', buildPerson({ shirt: 0x111111, pants: 0x1f2937, skin: 0xc68642, hair: 0x111111, hat: 'headphones', hairStyle: 'afro' }));
    dj.root.position.set(0, DJ_Y, -2.75);
    const mc = this.add('mc', buildPerson({ shirt: 0xfacc15, pants: 0x111111, skin: 0x8d5524, hair: 0x111111, hat: 'cap' }));
    handMic(mc);
    this.pods = [-6.5, 6.5].map((x, i) => podium(scene, { x, y: STAGE_Y, z: -0.6, glow: i ? 0x22d3ee : 0xff2d7a }));
    this.add('dancer1', buildPerson({ shirt: 0xff2d7a, pants: 0x111111, skin: 0xf1c27d, hair: 0x7c2d12, hairStyle: 'ponytail', sparkle: true }));
    this.add('dancer2', buildPerson({ shirt: 0x22d3ee, pants: 0x111111, skin: 0xe0ac8a, hair: 0x111111, hairStyle: 'short', sparkle: true }));
    this.followDefault = 'dj';
  }

  update(t) {
    const bar = t / T.bar;
    const beatPh = ((t / T.beat) % 1 + 1) % 1;
    const sec = sectionAt(Math.max(0, bar));
    const energy = t < 0 ? 0.15 : sec ? sec.energy : 0.3;
    const name = t >= 0 && sec ? sec.name : '';
    const bounce = Math.abs(Math.sin(beatPh * Math.PI));
    this.dj(t, bar, beatPh, bounce, energy, name);
    this.mc(t, bar, bounce, energy, name);
    this.dancer('dancer1', -6.5, t, bar, bounce, energy, name);
    this.dancer('dancer2', 6.5, t, bar, bounce, energy, name);
    for (const p of this.pods) p.strip.material.color.setHSL((t * 0.1 + p.group.position.x * 0.03) % 1, 1, 0.3 + (1 - beatPh) * 0.3 * energy);
    this.booth.front.material.color.setHSL((t * 0.05) % 1, 1, 0.25 + (1 - beatPh) * 0.25 * energy);
    for (const d of this.booth.decks) d.rotation.y -= 0.12;
  }

  dj(t, bar, beatPh, bounce, energy, name) {
    const p = this.members.dj;
    resetPose(p);
    let y = DJ_Y, z = -2.75;
    const [L, R] = p.arms;
    L.upper.rotation.set(-0.9, 0, -0.25);
    L.lower.rotation.x = -0.7 + Math.sin(t * 3) * 0.1;
    R.upper.rotation.set(-0.9, 0, 0.25);
    R.lower.rotation.x = -0.7;
    p.head.rotation.x = 0.15 + bounce * 0.3 * Math.max(0.4, energy);
    p.pelvis.position.y = 0.95 - bounce * 0.05 * energy;
    if (energy >= 1 && Math.floor(bar * 2) % 4 === 0) {
      R.upper.rotation.set(-2.6 - bounce * 0.3, 0, 0.3);
      R.lower.rotation.x = -0.3;
    }
    if (name === 'Breakdown') {
      const clap = bounce;
      L.upper.rotation.set(-2.7, 0, -0.15 - clap * 0.2);
      R.upper.rotation.set(-2.7, 0, 0.15 + clap * 0.2);
      L.lower.rotation.x = R.lower.rotation.x = -0.2;
    }
    // Climbs on the desk at bar 37, back down at 39.5.
    const up = clamp01((bar - 36.4) / 0.6) * (1 - clamp01((bar - 39.4) / 0.6));
    if (up > 0) {
      y = DJ_Y + up * 1.0;
      z = -2.75 + up * 0.85;
      if (up > 0.95) armsUp(p, 1, 0.5 + bounce * 0.1);
    }
    if (name === 'Intro' && bar < 2) p.pelvis.rotation.x = 0.4 * (1 - bar / 2);
    if (bar >= 57.5) {
      const k = clamp01((bar - 57.5) / 0.4);
      R.upper.rotation.set(-2.9 * k, 0, 0.2);
      R.lower.rotation.x = -0.2;
      if (bar >= 59) bow(p, clamp01((bar - 59) / 0.5));
    }
    p.root.position.set(0, y, z);
  }

  mc(t, bar, bounce, energy, name) {
    const p = this.members.mc;
    resetPose(p);
    const pos = followPath(p, MC_PATH, bar, t, STAGE_Y, 0);
    const [L, R] = p.arms;
    R.upper.rotation.set(-1.3, 0, 0.25);
    R.lower.rotation.x = -1.7;
    if (!pos.moving) {
      L.upper.rotation.set(-2.5 - bounce * 0.4, 0, -0.3);
      L.lower.rotation.x = -0.2;
      const jumping = energy >= 1 || name.startsWith('Build');
      if (jumping) p.root.position.y = STAGE_Y + bounce * 0.25 * Math.min(1.2, energy + 0.3);
      p.root.rotation.y = Math.sin(t * 0.7) * 0.4;
    }
  }

  dancer(id, x, t, bar, bounce, energy, name) {
    const p = this.members[id];
    resetPose(p);
    const pod = this.pods[x < 0 ? 0 : 1];
    const baseY = pod.top;
    p.root.position.set(x, baseY, -0.6);
    p.root.rotation.set(0, x < 0 ? 0.35 : -0.35, 0);
    const [L, R] = p.arms;
    const move = Math.floor(bar / 2 + (x < 0 ? 0 : 1)) % 3;
    const beat = (t / T.beat) * Math.PI;
    const e = Math.max(0.3, energy);
    if (move === 0) {
      L.upper.rotation.set(-2.6 * Math.max(0, Math.sin(beat)), 0, -0.3);
      R.upper.rotation.set(-2.6 * Math.max(0, -Math.sin(beat)), 0, 0.3);
      p.pelvis.rotation.z = Math.sin(beat) * 0.15 * e;
    } else if (move === 1) {
      L.upper.rotation.set(0, 0, -1.5 + Math.sin(beat * 2) * 0.4);
      R.upper.rotation.set(0, 0, 1.5 - Math.sin(beat * 2) * 0.4);
      L.lower.rotation.x = R.lower.rotation.x = -0.6;
      p.pelvis.rotation.y = Math.sin(beat * 0.5) * 0.5;
    } else {
      p.pelvis.position.y = 0.95 - bounce * 0.25 * e;
      p.legs.forEach((l) => { l.thigh.rotation.x = -bounce * 0.6 * e; l.shin.rotation.x = bounce * 1.0 * e; });
      L.upper.rotation.set(-0.8, 0, -0.6);
      R.upper.rotation.set(-0.8, 0, 0.6);
      L.lower.rotation.x = R.lower.rotation.x = -1.2 + bounce * 0.6;
    }
    p.head.rotation.x = bounce * 0.15;

    // Backflip for dancer 2 at bar 29.
    if (id === 'dancer2') {
      const k = (bar - 29.1) / 0.55;
      if (k > -0.4 && k < 0) {
        p.pelvis.position.y = 0.95 + k * 0.6;
        p.legs.forEach((l) => { l.thigh.rotation.x = k * 1.2; l.shin.rotation.x = -k * 2; });
        armsUp(p, -k * 2.5);
      } else if (k >= 0 && k <= 1) {
        const a = -Math.PI * 2 * (k * k * (3 - 2 * k));
        const lift = Math.sin(k * Math.PI) * 1.1;
        p.root.rotation.set(a, -0.35, 0, 'YXZ');
        p.root.position.set(x, baseY + 1.0 - Math.cos(a) + lift, -0.6 - Math.sin(a));
        p.legs.forEach((l) => { l.thigh.rotation.x = -1.4; l.shin.rotation.x = 1.8; });
        L.upper.rotation.set(-1.2, 0, -0.4);
        R.upper.rotation.set(-1.2, 0, 0.4);
      } else if (k > 1 && k < 1.6) {
        armsUp(p, 1, 0.6);
      }
    }
    if (name === 'Outro' && bar >= 58.5) bow(p, clamp01((bar - 58.5) / 0.5));
  }
}

function arrange(m, { bar, s, time, sec, barInSec, lastBar, firstStep }) {
  const mu = sec.music;
  const ch = CH[bar % 4];
  const secLen = sec.end - sec.start;
  if (firstStep && mu.impact) {
    m.crash(time, 0.45);
    m.cheer(time, 0.6, 5);
  }
  const silence = mu.roll && lastBar && s >= 8;
  if (mu.kick && !silence && s % 4 === 0) m.kick(time, mu.kick === 'soft' ? 0.55 : 0.95, 45);
  if (mu.clap && (s === 4 || s === 12)) m.clap(time, 0.35);
  if (mu.hats && !silence) {
    if (s % 4 === 2) m.hat(time, true, 0.08);
    if (mu.hats === 'busy' && s % 2 === 1) m.hat(time, false, 0.05);
  }
  if (mu.bass && s % 4 === 2) m.tone(time, mtof(ch.root - 12), m.step * 1.5, { type: 'sawtooth', gain: 0.2, cutoff: 650, q: 4, release: 0.05 });
  if (mu.bass && s % 4 === 0) m.tone(time, mtof(ch.root - 12), m.step * 0.9, { type: 'sine', gain: 0.22, cutoff: 300, release: 0.05 });
  if (mu.stabs && [0, 3, 6, 10, 12].includes(s)) {
    for (const iv of ch.q) {
      for (const det of [-14, 0, 14]) {
        m.tone(time, mtof(ch.root + 24 + iv), m.step * 1.2, { type: 'sawtooth', gain: 0.022, cutoff: 3800, release: 0.12, detune: det, send: 0.3 });
      }
    }
  }
  if (mu.arp && s % (mu.roll ? 1 : 2) === 0 && !silence) {
    const notes = [0, ...ch.q, 12, ...ch.q.map((v) => v + 12)];
    m.pluck(time, mtof(ch.root + 24 + notes[(s / (mu.roll ? 1 : 2)) % notes.length]), mu.arp === 'soft' ? 0.05 : 0.07, 0.2);
  }
  if (mu.pad && s === 0) m.pad(time, ch.q.map((iv) => ch.root + 24 + iv), T.bar * 0.95, { gain: 0.03, cutoff: 1800, attack: 0.4 });
  if (mu.roll) {
    const k = (barInSec + s / 16) / secLen;
    const every = k < 0.5 ? 4 : k < 0.75 ? 2 : 1;
    if (s % every === 0) m.snare(time, 0.1 + 0.3 * k);
  }
  if (mu.sweep && firstStep) m.sweep(time, secLen * T.bar, 0.16);
  if (mu.lead) {
    for (const [st, iv] of HOOK) {
      if (st === s) m.tone(time, mtof(41 + 24 + iv), m.step * 1.6, { type: 'square', gain: 0.05, cutoff: 3000, release: 0.1, glide: 0.94, send: 0.3 });
    }
  }
  if (mu.end && lastBar && s === 0) {
    m.crash(time, 0.4);
    m.pad(time, [41 + 12, 44 + 12, 48 + 12, 53 + 12], T.bar * 1.5, { gain: 0.035, cutoff: 2400, attack: 0.05 });
    m.cheer(time, 0.6, 6);
  }
}

export default {
  id: 'club',
  title: 'DJ VOLTA',
  card: 'DJ Volta',
  kind: 'Warehouse rave',
  blurb: 'A DJ on a booth, podium dancers and an MC working the crowd. Lasers, CO2 cannons and big drops. Sometimes the director wants the crowd!',
  lowerThird: 'LIVE FROM THE WAREHOUSE · "Voltage"',
  accent: '#22d3ee',
  bpm: 128,
  preview: 34,
  crowdLevel: 0.07,
  subjects: { dj: 'Volta (DJ)', mc: 'Kez (MC)', dancer1: 'Pixie (left dancer)', dancer2: 'Blaze (right dancer)', wide: 'Wide shot (whole stage)', crowd: 'The crowd going wild' },
  sections: [
    { name: 'Intro', start: 0, end: 8, focus: 'dj', energy: 0.45, music: { kick: 'soft', hats: true, arp: 'soft' } },
    { name: 'Build-up', start: 8, end: 16, focus: 'mc', energy: 0.65, music: { kick: true, hats: true, arp: true, roll: true, sweep: true } },
    { name: 'Drop', start: 16, end: 24, focus: 'crowd', energy: 1.2, music: { kick: true, clap: true, hats: 'busy', bass: true, stabs: true, impact: true } },
    { name: 'Dancers', start: 24, end: 32, focus: 'dancer2', energy: 0.9, music: { kick: true, clap: true, hats: true, bass: true, arp: true } },
    { name: 'Breakdown', start: 32, end: 40, focus: 'dj', energy: 0.3, music: { pad: true, arp: 'soft' } },
    { name: 'Build-up 2', start: 40, end: 44, focus: 'mc', energy: 0.75, music: { kick: true, hats: true, arp: true, roll: true, sweep: true, pad: true } },
    { name: 'Final drop', start: 44, end: 56, focus: 'wide', energy: 1.3, music: { kick: true, clap: true, hats: 'busy', bass: true, stabs: true, lead: true, impact: true } },
    { name: 'Outro', start: 56, end: 60, focus: 'dj', energy: 0.5, music: { kick: 'soft', hats: true, pad: true, end: true } },
  ],
  moments: [
    { id: 'drop', bar: 16, dur: 2, subject: 'crowd', label: 'The drop: CO2 cannons' },
    { id: 'flip', bar: 29, dur: 1.5, subject: 'dancer2', label: 'Dancer backflip' },
    { id: 'desk', bar: 37, dur: 2, subject: 'dj', label: 'DJ climbs on the desk' },
    { id: 'final', bar: 44, dur: 2, subject: 'wide', label: 'Final drop: confetti + lasers' },
    { id: 'salute', bar: 57.5, dur: 1.5, subject: 'dj', label: 'DJ salutes the crowd' },
  ],
  venue: {
    background: 0x030305,
    fog: 0.02,
    room: { w: 40, h: 14, d: 46, z: 9, wall: 0x101012, floor: 0x18181b },
    stage: { w: 22, d: 7, h: STAGE_Y, front: 2, color: 0x141416 },
    risers: [{ x: 0, z: -2.4, w: 4.6, d: 2.6, h: 0.8 }],
    speakers: true,
    barrier: 3.7,
    truss: { y: 8, zs: [1.4, -4.6], w: 20 },
    movers: { count: 8, y: 7.7, zs: [1.4, -4.6], span: 9, sweep: 0.6, speed: 1.6, beam: 0.08 },
    lasers: { origins: [[-3, 6.5, -4.5], [3, 6.5, -4.5]], beams: 7, sections: ['Drop', 'Dancers', 'Final drop'] },
    screen: { style: 'led', w: 16, h: 6, y: 4.9, z: -5.9, title: 'DJ VOLTA', idle: 'TONIGHT' },
    foh: { z: 23.5, w: 10, h: 3, d: 4 },
    crowd: { type: 'standing', count: 520, x: 14, z: [4.2, 18], shirts: [0x111111, 0x1f2937, 0xff2d7a, 0x22d3ee, 0xfacc15, 0x4c1d95, 0x111111, 0xffffff] },
    strobe: ['Drop', 'Final drop'],
    wash: { base: 30, energy: 40 },
    palettes: {
      default: [0x22d3ee, 0x8b5cf6], 'Build-up': [0xff2d7a, 0x22d3ee], Drop: [0x22ff88, 0xff2d7a],
      Dancers: [0xfacc15, 0x22d3ee], Breakdown: [0x3b82f6, 0x6366f1], 'Build-up 2': [0xff2d7a, 0xffffff],
      'Final drop': [0xffffff, 0x22ff88], Outro: [0x8b5cf6, 0xff2d7a],
    },
    pyro: [
      { bar: 16, xs: [-8, -3.5, 3.5, 8], kind: 'co2', n: 120 },
      { bar: 24, xs: [-8, 8], kind: 'co2', n: 80 },
      { bar: 44, xs: [-8, -3.5, 3.5, 8], kind: 'co2', n: 120 },
      { bar: 44.05, xs: [-8, -3.5, 3.5, 8], kind: 'fire', n: 70 },
      { bar: 52, xs: [-8, 8], kind: 'fire', n: 80 },
    ],
    confetti: [44, 48],
  },
  rigs: [
    { id: 1, name: 'PIT', pos: [-3, 1.6, 2.9], look: [0, 2.6, -1], fov: 45, floorY: 0,
      bounds: { x: [-10, 10], y: [0.9, 2.3], z: [2.3, 3.4] }, fovRange: [12, 75], speed: 3.2, tripod: true },
    { id: 2, name: 'FOH RISER', pos: [0, 4.7, 23], look: [0, 2.8, -2], fov: 30, floorY: 3,
      bounds: { x: [-4.5, 4.5], y: [4.2, 5.8], z: [22, 24.8] }, fovRange: [3.5, 60], speed: 2.2, tripod: true },
    { id: 3, name: 'STAGE WING', pos: [10.2, 2.6, 0.8], look: [0, 2.6, -1.5], fov: 55, floorY: STAGE_Y,
      bounds: { x: [9.2, 10.8], y: [1.8, 3.2], z: [-4.5, 1.8] }, fovRange: [18, 85], speed: 2.6, shake: 1 },
  ],
  createCast: (scene) => new ClubCast(scene),
  arrange,
};
