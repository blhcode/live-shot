import { T, sectionAt } from '../show.js';
import { mtof } from '../music.js';
import { Cast, buildPerson, resetPose, followPath, clamp01, armsUp, bow, smooth } from '../people.js';
import { magicTable, rabbit, magicBox, hoop, wand } from '../props.js';

const STAGE_Y = 1.1;
const TABLE = { x: -3, z: -0.4 };
const BOX = { x: 3.2, z: -1.6 };
const AISLE = { x: 0, z: 12.5 };

const MAGICIAN_PATH = [
  [0, -0.9, 0.6], [4, -0.9, 0.6], [5, 0, 1.4], [8, 0, 1.4], [9, TABLE.x, TABLE.z - 0.8], [14, TABLE.x, TABLE.z - 0.8],
  [15, -1.5, -0.4], [22, -1.5, -0.4], [23, BOX.x - 1.4, BOX.z + 0.4], [28, BOX.x - 1.4, BOX.z + 0.4],
  [29, -0.3, 1.6], [32, -0.3, 1.6], [33, -0.9, 0.9], [40, -0.9, 0.9],
];
const ASSISTANT_PATH = [
  [0, 0.9, 0.5], [4, 0.9, 0.5], [5, -4.3, 0.2], [14, -4.3, 0.2], [15, 0, -0.6], [21, 0, -0.6],
  [22.4, BOX.x, BOX.z + 1.2], [23.2, BOX.x, BOX.z + 1.2], [23.7, BOX.x, BOX.z],
];
const SEATS = { z0: 6.5, gap: 1.1, rake: 0.12 };
const raked = (z) => Math.max(0, Math.round((z - SEATS.z0) / SEATS.gap)) * SEATS.rake;
const RETURN_PATH = [[29, AISLE.x, AISLE.z], [32, AISLE.x, AISLE.z], [33.6, 0.4, 3.4], [34.4, 0.6, 1.3], [40, 0.6, 1.3]];

class MagicCast extends Cast {
  constructor(scene, venue) {
    super(scene);
    this.venue = venue;
    const mag = this.add('magician', buildPerson({ shirt: 0x111111, pants: 0x111111, skin: 0xe0ac8a, hair: 0x333333, hat: 'top', cape: 0x7a0d1c }));
    wand(mag);
    this.add('assistant', buildPerson({ shirt: 0xc026d3, pants: 0x111111, skin: 0xf1c27d, hair: 0xfacc15, hairStyle: 'ponytail', dress: { color: 0xc026d3 }, sparkle: true }));
    this.table = magicTable(scene, { x: TABLE.x, y: STAGE_Y, z: TABLE.z });
    this.bunny = rabbit(scene);
    this.box = magicBox(scene, { x: BOX.x, y: STAGE_Y, z: BOX.z });
    this.hoop = hoop(scene);
    this.followDefault = 'magician';
    this.puffs = new Set();
  }

  puffOnce(key, x, y, z, n) {
    if (this.puffs.has(key)) return;
    this.puffs.add(key);
    this.venue.puff(x, y, z, n);
  }

  update(t) {
    const bar = t / T.bar;
    const sec = sectionAt(Math.max(0, bar));
    const name = t >= 0 && sec ? sec.name : '';
    const live = t >= 0;
    this.magician(t, bar, name);
    this.assistant(t, bar, name, live);
    this.props(t, bar, live);
  }

  magician(t, bar, name) {
    const p = this.members.magician;
    resetPose(p);
    const pos = followPath(p, MAGICIAN_PATH, bar, t, STAGE_Y, 0);
    const [L, R] = p.arms;
    if (pos.moving) return;
    // Talking gestures by default.
    R.upper.rotation.set(-0.9 + Math.sin(t * 2.1) * 0.2, 0, 0.3);
    R.lower.rotation.x = -0.6;
    L.upper.rotation.set(-0.5 + Math.sin(t * 1.7) * 0.25, 0, -0.5);
    L.lower.rotation.x = -0.4;
    p.head.rotation.y = Math.sin(t * 0.6) * 0.3;

    if (bar < 4) {
      const k = clamp01((bar - 2) / 0.5) * (1 - clamp01((bar - 3.3) / 0.5));
      bow(p, k);
    }
    if (name === 'Welcome') armsUp(p, 0.6 + Math.sin(t * 1.2) * 0.1, 1.1);
    if (name === 'The hat trick') {
      R.upper.rotation.set(-1.0, 0, 0.1);
      R.lower.rotation.x = -0.6 + Math.sin(t * 6) * 0.15 * clamp01(12 - bar);
      p.root.rotation.y = 0;
      if (bar >= 12) armsUp(p, clamp01((bar - 12) / 0.3), 0.8);
    }
    if (name === 'Levitation') {
      p.root.rotation.y = 0.9;
      L.upper.rotation.set(-1.4, 0, -0.2);
      R.upper.rotation.set(-1.4 + Math.sin(t * 1.5) * 0.15, 0, 0.2);
      L.lower.rotation.x = R.lower.rotation.x = -0.2;
      L.upper.rotation.z = -0.3 + Math.sin(t * 1.3) * 0.2;
    }
    if (name === 'The vanishing box') {
      p.root.rotation.y = 0.8;
      if (bar >= 24 && bar < 26) {
        R.upper.rotation.set(-1.5, 0, 0.2);
        L.upper.rotation.set(-1.5, 0, -0.2);
      }
      if (bar >= 26) armsUp(p, clamp01((bar - 26) / 0.3), 0.9);
    }
    if (name === 'Where did she go?') {
      p.root.rotation.y = 0;
      R.upper.rotation.set(-1.6, 0, 0.2);
      R.lower.rotation.x = 0;
    }
    if (name === 'Grand finale' && bar >= 35.5) armsUp(p, 1, 0.8);
    if (name === 'Curtain call') bow(p, clamp01((bar - 38.3) / 0.5) * (1 - clamp01((bar - 39.3) / 0.5)));
  }

  assistant(t, bar, name, live) {
    const p = this.members.assistant;
    resetPose(p);
    p.root.visible = true;
    p.root.rotation.set(0, 0, 0);
    const [L, R] = p.arms;
    const presenting = () => {
      L.upper.rotation.set(-0.6, 0, -1.0);
      L.lower.rotation.x = -0.2;
      R.upper.rotation.set(-0.3, 0, 0.2);
    };

    if (bar < 24 || !live) {
      const pos = followPath(p, ASSISTANT_PATH, Math.max(0, bar), t, STAGE_Y, 0);
      if (!pos.moving) {
        if (bar < 4) bow(p, clamp01((bar - 2) / 0.5) * (1 - clamp01((bar - 3.3) / 0.5)));
        if (name === 'Welcome' || name === 'The hat trick') { presenting(); p.root.rotation.y = 0.6; }
      }
      // Levitation: lie flat, float up, hoop passes, come down.
      const up = smooth(clamp01((bar - 15.6) / 1.4)) * (1 - smooth(clamp01((bar - 20.2) / 1.2)));
      if (up > 0) {
        p.root.rotation.set(0, 0, Math.PI / 2 * Math.min(1, up * 1.6));
        p.root.position.y = STAGE_Y + 0.3 + up * 1.5 + Math.sin(t * 1.4) * 0.05 * up;
        p.root.position.x = 0.95 * Math.min(1, up * 1.6);
        armsUp(p, 1, 0.1);
      }
      if (bar >= 22 && bar < 24) {
        if (bar >= 23.2) p.root.rotation.y = 0;
        if (!pos.moving || bar >= 23.2) armsUp(p, 0.8, 0.9);
      }
      return;
    }
    if (bar < 29) {
      p.root.visible = false;
      return;
    }
    // Reappears in the aisle, waves, runs back to the stage and jumps up.
    const pos = followPath(p, RETURN_PATH, bar, t, 0, Math.PI);
    let y = pos.z < 2.2 ? STAGE_Y : raked(pos.z);
    if (bar >= 33.6 && bar < 34.4) {
      const k = (bar - 33.6) / 0.8;
      y = STAGE_Y * smooth(k) + Math.sin(k * Math.PI) * 0.5;
    }
    p.root.position.y = y;
    if (!pos.moving) {
      if (bar < 33) {
        p.root.rotation.y = Math.PI * 0.85;
        armsUp(p, 1, 0.7 + Math.sin(t * 6) * 0.25);
      } else {
        p.root.rotation.y = 0;
        if (bar >= 35.5 && bar < 38) armsUp(p, 1, 0.8);
        if (name === 'Curtain call') bow(p, clamp01((bar - 38.3) / 0.5) * (1 - clamp01((bar - 39.3) / 0.5)));
      }
    }
  }

  props(t, bar, live) {
    // Rabbit rises out of the hat at bar 12, then sits on the table.
    const r = this.bunny;
    const k = clamp01((bar - 11.9) / 0.4);
    r.visible = live && bar >= 11.9;
    r.position.set(TABLE.x + (bar > 13 ? 0.25 : 0), this.table.topY + 0.05 + smooth(k) * 0.42 - (bar > 13 ? 0.35 : 0), TABLE.z);
    r.rotation.y = Math.sin(t * 2) * 0.3;
    if (live && bar >= 11.9) this.puffOnce('rabbit', TABLE.x, this.table.topY + 0.3, TABLE.z, 40);

    // Hoop passes over the floating assistant.
    const hk = clamp01((bar - 17.6) / 1.6);
    this.hoop.visible = live && bar > 17.4 && bar < 19.4;
    this.hoop.position.set(0.95 - 1.9 + hk * 2.2, STAGE_Y + 2.1, -0.6);
    this.hoop.rotation.set(0, Math.PI / 2, 0);

    // Vanishing box: door open → close → spin → puff → open, empty.
    let door = 0;
    if (bar >= 22 && bar < 24) door = smooth(clamp01((bar - 22) / 0.5)) * (1 - smooth(clamp01((bar - 23.7) / 0.3)));
    if (bar >= 26) door = smooth(clamp01((bar - 26) / 0.4));
    if (bar >= 31) door = 1 - smooth(clamp01((bar - 31) / 0.5));
    this.box.door.rotation.y = -1.9 * door;
    const spin = bar >= 24.2 && bar < 25.8 ? smooth((bar - 24.2) / 1.6) * Math.PI * 4 : 0;
    this.box.spin.rotation.y = spin;
    if (live && bar >= 25.8) this.puffOnce('box', BOX.x, STAGE_Y + 1.2, BOX.z + 0.4, 160);
    if (live && bar >= 29) this.puffOnce('aisle', AISLE.x, 1.0 + raked(AISLE.z), AISLE.z, 120);
  }
}

function arrange(m, { bar, s, time, sec, barInSec, lastBar, firstStep }) {
  const mu = sec.music;
  // D minor: Dm - Bb - Gm - A
  const CH = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]];
  const ch = CH[bar % 4];

  if (mu.pizz && s % 4 === 0) {
    const n = s === 0 ? ch[0] - 12 : ch[(s / 4) % 3];
    m.pluck(time, mtof(n), 0.16, 0.18);
  }
  if (mu.strings && s === 0) m.pad(time, ch.map((n) => n + 12), T.bar * 0.95, { gain: 0.022, cutoff: 1500, attack: 0.6 });
  if (mu.celesta && s % 2 === 0 && m.rand() < 0.6) {
    const scale = [62, 64, 65, 67, 69, 70, 72, 74, 77];
    m.bell(time, mtof(scale[Math.floor(m.rand() * scale.length)] + 12), 0.035, 0.9);
  }
  if (mu.roll && lastBar) {
    const k = s / 16;
    m.snare(time, 0.05 + k * 0.25);
    if (s % 2 === 0) m.snare(time + m.step / 2, 0.05 + k * 0.25);
    if (s % 4 === 0) m.tom(time, 70, 0.3 + k * 0.4);
  }
  if (mu.tada && firstStep) {
    m.brass(time, [62, 66, 69, 74], T.beat * 1.5, 0.05);
    m.crash(time, 0.35);
    m.kick(time, 0.8);
    m.applause(time + 0.3, 0.2, 3.5);
    m.cheer(time + 0.3, 0.18, 3);
  }
  if (mu.march) {
    if (s === 0 || s === 8) m.kick(time, 0.6);
    if (s === 4 || s === 12) m.snare(time, 0.3);
    if (s % 2 === 0) m.hat(time, false, 0.05);
    const tune = [[0, 74, 3], [4, 77, 2], [6, 76, 2], [8, 74, 4], [12, 81, 4]];
    for (const [st, n, len] of tune) {
      if (st === s) m.brass(time, [n - 12 + (bar % 2 ? 2 : 0)], len * m.step, 0.045);
    }
    if (s % 4 === 0) m.pluck(time, mtof(ch[0] - 12), 0.18, 0.2);
  }
  if (mu.fanfare && firstStep) {
    m.brass(time, [62, 66, 69, 74, 78], T.bar * 1.8, 0.05);
    m.crash(time, 0.4);
    m.applause(time, 0.25, 7);
    m.cheer(time, 0.25, 6);
  }
  if (mu.applause && firstStep) m.applause(time, 0.22, 4);
}

export default {
  id: 'magic',
  title: 'THE GREAT ZANDINI',
  card: 'The Great Zandini',
  kind: 'Theatre magic show',
  blurb: 'A magician and his assistant on a theatre stage. A rabbit from a hat, a levitation, a vanishing box, and you have to find where she reappears!',
  lowerThird: 'LIVE ON STAGE · "An Evening of Wonders"',
  accent: '#facc15',
  bpm: 90,
  preview: 46,
  reverb: 2.6,
  crowdLevel: 0.025,
  subjects: { magician: 'Zandini (magician)', assistant: 'Coco (assistant)', wide: 'Wide shot (both on stage)' },
  sections: [
    { name: 'Curtain up', start: 0, end: 4, focus: 'wide', energy: 0.4, music: { fanfare: true, strings: true } },
    { name: 'Welcome', start: 4, end: 8, focus: 'magician', energy: 0.4, music: { pizz: true, strings: true } },
    { name: 'The hat trick', start: 8, end: 12, focus: 'magician', energy: 0.45, music: { pizz: true, celesta: true, roll: true } },
    { name: 'Rabbit!', start: 12, end: 14, focus: 'magician', energy: 0.7, music: { tada: true, pizz: true } },
    { name: 'Levitation', start: 14, end: 22, focus: 'assistant', energy: 0.55, music: { strings: true, celesta: true } },
    { name: 'The vanishing box', start: 22, end: 26, focus: 'magician', energy: 0.6, music: { pizz: true, strings: true, roll: true } },
    { name: 'Gone!', start: 26, end: 28, focus: 'magician', energy: 0.75, music: { tada: true, strings: true } },
    { name: 'Where did she go?', start: 28, end: 33, focus: 'assistant', energy: 0.7, music: { celesta: true, pizz: true, applause: true } },
    { name: 'Grand finale', start: 33, end: 38, focus: 'wide', energy: 1.0, music: { march: true } },
    { name: 'Curtain call', start: 38, end: 41, focus: 'wide', energy: 0.6, music: { fanfare: true, strings: true } },
  ],
  moments: [
    { id: 'rabbit', bar: 12, dur: 1.5, subject: 'magician', label: 'Rabbit out of the hat' },
    { id: 'levitate', bar: 17.5, dur: 2, subject: 'assistant', label: 'The assistant levitates' },
    { id: 'empty', bar: 26, dur: 1.5, subject: 'magician', label: 'The box is empty!' },
    { id: 'reappear', bar: 29.2, dur: 2, subject: 'assistant', label: 'She reappears in the audience!' },
    { id: 'sparks', bar: 36, dur: 2, subject: 'wide', label: 'Finale: sparks + confetti' },
  ],
  venue: {
    background: 0x07040a,
    fog: 0.012,
    fogColor: 0x0c0610,
    house: 0.55,
    houseDuringShow: 0.08,
    hemi: 0.22,
    room: { w: 36, h: 16, d: 44, z: 10, wall: 0x2a0a10, floor: 0x1a0c0c },
    stage: { w: 21, d: 9, h: STAGE_Y, front: 3, color: 0x3a2414, strip: false },
    proscenium: { w: 16, h: 8.5, z: 3.25 },
    curtain: { z: 2.95, w: 8.5, h: 8, open: [0, 1.5], close: [39.2, 40.6] },
    footlights: { w: 15 },
    screen: { style: 'stars', w: 16, h: 7.5, y: 4.85, z: -5.9, title: 'THE GREAT ZANDINI' },
    balcony: { y: 5, z: 20.5, d: 6, w: 34 },
    follow: { x: 0, y: 11, z: 24, intensity: 420 },
    wash: { pos: [0, 9, 9], target: [0, 1, -1], base: 70, energy: 30, white: 0.7, angle: 0.55 },
    movers: { count: 4, y: 8.3, zs: [2.4], span: 6, sweep: 0.2, speed: 0.5, beam: 0.03 },
    crowd: { type: 'rows', x: 12, z: [6.5, 18.5], rowGap: 1.1, seatGap: 0.8, aisle: 1.0, rake: 0.12, fill: 0.88,
      shirts: [0x1f2937, 0x7f1d1d, 0x111111, 0x374151, 0x1e3a8a, 0x4c1d95, 0x6b7280] },
    palettes: {
      default: [0xfacc15, 0xc026d3], 'The hat trick': [0x8b5cf6, 0xfacc15], Levitation: [0x6366f1, 0x22d3ee],
      'The vanishing box': [0x8b5cf6, 0xe11d48], 'Where did she go?': [0xfacc15, 0xffffff], 'Grand finale': [0xfacc15, 0xff2d7a],
    },
    pyro: [
      { bar: 36, xs: [-6.5, -3, 3, 6.5], kind: 'gold', n: 110 },
      { bar: 36.5, xs: [-6.5, -3, 3, 6.5], kind: 'gold', n: 110 },
      { bar: 37, xs: [-6.5, 6.5], kind: 'gold', n: 110 },
    ],
    confetti: [36, 39],
  },
  rigs: [
    { id: 1, name: 'ORCHESTRA PIT', pos: [-3, 1.7, 4.3], look: [0, 2.6, 0], fov: 45, floorY: 0,
      bounds: { x: [-9, 9], y: [1.1, 2.6], z: [3.6, 5.2] }, fovRange: [12, 75], speed: 3, tripod: true },
    { id: 2, name: 'BALCONY', pos: [0, 6.9, 21.6], look: [0, 2.5, -1], fov: 30, floorY: 5,
      bounds: { x: [-6, 6], y: [6.2, 7.6], z: [20.9, 23] }, fovRange: [4, 60], speed: 2.4, tripod: true },
    { id: 3, name: 'STAGE WING', pos: [9.2, 2.7, 1.5], look: [0, 2.4, -0.5], fov: 55, floorY: STAGE_Y,
      bounds: { x: [8.6, 10.3], y: [2.1, 3.4], z: [-5, 2.6] }, fovRange: [18, 85], speed: 2.4, shake: 0.9 },
  ],
  createCast: (scene, venue) => new MagicCast(scene, venue),
  arrange,
};
