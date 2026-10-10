import * as THREE from 'three';
import { BAR, BEAT, sectionAt } from './show.js';

const STAGE_Y = 1.2;
const DRUM_RISER_Y = STAGE_Y + 0.6;

const skinMats = {};
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...opts });
}

function limb(len, radius, material) {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len, 4, 10), material);
  mesh.position.y = -len / 2;
  pivot.add(mesh);
  return pivot;
}

function buildPerson({ shirt, pants, skin = 0xe0ac8a, hair = 0x2a1a10, hairStyle = 'short' }) {
  const shirtM = mat(shirt);
  const pantsM = mat(pants);
  const skinM = skinMats[skin] || (skinMats[skin] = mat(skin));
  const hairM = mat(hair, { roughness: 0.9 });
  const shoeM = mat(0x111111);

  const root = new THREE.Group();

  const legs = [];
  for (const side of [-1, 1]) {
    const thigh = limb(0.38, 0.085, pantsM);
    thigh.position.set(side * 0.11, 0.92, 0);
    const shin = limb(0.38, 0.075, pantsM);
    shin.position.y = -0.44;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.26), shoeM);
    foot.position.set(0, -0.46, 0.06);
    shin.add(foot);
    thigh.add(shin);
    root.add(thigh);
    legs.push({ thigh, shin });
  }

  const pelvis = new THREE.Group();
  pelvis.position.y = 0.95;
  root.add(pelvis);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.36, 4, 12), shirtM);
  torso.position.y = 0.33;
  torso.scale.set(1.05, 1, 0.75);
  pelvis.add(torso);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), skinM);
  neck.position.y = 0.73;
  pelvis.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.86;
  pelvis.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skinM);
  skull.scale.set(0.95, 1.08, 1);
  head.add(skull);
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, hairStyle === 'long' ? Math.PI * 0.62 : Math.PI * 0.48), hairM);
  hairCap.position.set(0, 0.02, -0.01);
  head.add(hairCap);
  if (hairStyle === 'long') {
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.08), hairM);
    back.position.set(0, -0.1, -0.1);
    head.add(back);
  }
  if (hairStyle === 'mohawk') {
    const hawk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.26), hairM);
    hawk.position.set(0, 0.16, 0);
    head.add(hawk);
  }
  const eyeM = mat(0x111111);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeM);
    eye.position.set(side * 0.045, 0.02, 0.12);
    head.add(eye);
  }

  const arms = [];
  for (const side of [-1, 1]) {
    const upper = limb(0.27, 0.06, shirtM);
    upper.position.set(side * 0.27, 0.58, 0);
    const lower = limb(0.25, 0.05, skinM);
    lower.position.y = -0.31;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), skinM);
    hand.position.y = -0.31;
    lower.add(hand);
    upper.add(lower);
    pelvis.add(upper);
    arms.push({ upper, lower, hand, side });
  }

  const anchors = {
    head: new THREE.Object3D(),
    chest: new THREE.Object3D(),
    hips: new THREE.Object3D(),
    feet: new THREE.Object3D(),
  };
  anchors.head.position.set(0, 0.14, 0);
  head.add(anchors.head);
  anchors.chest.position.y = 0.45;
  pelvis.add(anchors.chest);
  pelvis.add(anchors.hips);
  root.add(anchors.feet);

  return { root, pelvis, head, legs, arms, anchors };
}

function resetPose(p) {
  p.pelvis.rotation.set(0, 0, 0);
  p.pelvis.position.y = 0.95;
  p.head.rotation.set(0, 0, 0);
  for (const l of p.legs) {
    l.thigh.rotation.set(0, 0, 0);
    l.shin.rotation.set(0, 0, 0);
  }
  for (const a of p.arms) {
    a.upper.rotation.set(0, 0, a.side * 0.12);
    a.lower.rotation.set(0, 0, 0);
  }
}

function walkCycle(p, phase, amount) {
  const s = Math.sin(phase);
  p.legs[0].thigh.rotation.x = s * 0.6 * amount;
  p.legs[1].thigh.rotation.x = -s * 0.6 * amount;
  p.legs[0].shin.rotation.x = Math.max(0, -s) * 0.9 * amount;
  p.legs[1].shin.rotation.x = Math.max(0, s) * 0.9 * amount;
}

const smooth = (x) => x * x * (3 - 2 * x);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Piecewise path: list of [bar, x, z]. Returns position + velocity.
function pathAt(path, bar) {
  if (bar <= path[0][0]) return { x: path[0][1], z: path[0][2], moving: false };
  for (let i = 0; i < path.length - 1; i++) {
    const [b0, x0, z0] = path[i];
    const [b1, x1, z1] = path[i + 1];
    if (bar >= b0 && bar <= b1) {
      const k = b1 === b0 ? 1 : (bar - b0) / (b1 - b0);
      const e = smooth(k);
      const moving = (x0 !== x1 || z0 !== z1) && k > 0 && k < 1;
      return { x: x0 + (x1 - x0) * e, z: z0 + (z1 - z0) * e, moving, dx: x1 - x0, dz: z1 - z0 };
    }
  }
  const last = path[path.length - 1];
  return { x: last[1], z: last[2], moving: false };
}

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

export class Band {
  constructor(scene) {
    this.scene = scene;
    this.members = {};
    this.buildSinger();
    this.buildGuitarist();
    this.buildDrummer();
    this.buildKeys();
    this.tmp = new THREE.Vector3();
  }

  add(id, person) {
    this.scene.add(person.root);
    this.members[id] = person;
  }

  buildSinger() {
    const p = buildPerson({ shirt: 0xff2d7a, pants: 0x161616, hair: 0xf2d16b, hairStyle: 'long', skin: 0xf1c27d });
    const mic = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.18, 8), mat(0x222222, { metalness: 0.6 }));
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(0x999999, { metalness: 0.8, roughness: 0.3 }));
    ball.position.y = 0.11;
    mic.add(handle, ball);
    mic.position.set(0, -0.02, 0.04);
    mic.rotation.x = 0.4;
    p.arms[1].hand.add(mic);
    this.add('singer', p);
  }

  buildGuitarist() {
    const p = buildPerson({ shirt: 0x14b8a6, pants: 0x2b3a55, hair: 0x111111, hairStyle: 'mohawk', skin: 0x8d5524 });
    const guitar = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 20), mat(0xd62828, { roughness: 0.35, metalness: 0.2 }));
    body.rotation.x = Math.PI / 2;
    body.scale.set(1, 1, 1.25);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.03), mat(0x3b2412));
    neck.position.set(0, 0.42, 0);
    const headstock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.03), mat(0x111111));
    headstock.position.set(0, 0.78, 0);
    guitar.add(body, neck, headstock);
    guitar.position.set(0.02, 0.2, 0.2);
    guitar.rotation.z = 1.05;
    p.pelvis.add(guitar);
    p.guitar = guitar;
    this.add('guitar', p);
  }

  buildDrummer() {
    const p = buildPerson({ shirt: 0xf97316, pants: 0x1f2937, hair: 0x7c2d12, hairStyle: 'short', skin: 0xc68642 });
    p.root.position.set(0, DRUM_RISER_Y, -4.4);
    this.add('drums', p);

    const kit = new THREE.Group();
    kit.position.set(0, DRUM_RISER_Y, -4.4);
    const shell = mat(0x1e3a8a, { roughness: 0.3, metalness: 0.4 });
    const headM = mat(0xeeeeee, { roughness: 0.8 });
    const chrome = mat(0xcccccc, { metalness: 0.9, roughness: 0.25 });
    const brass = mat(0xd4a017, { metalness: 0.9, roughness: 0.3 });

    const kick = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.45, 24), shell);
    kick.rotation.x = Math.PI / 2;
    kick.position.set(0, 0.4, 0.75);
    const kickHead = new THREE.Mesh(new THREE.CircleGeometry(0.38, 24), mat(0x111111, { emissive: 0xff2d7a, emissiveIntensity: 0.6 }));
    kickHead.position.set(0, 0.4, 0.98);
    kit.add(kick, kickHead);
    this.kickHead = kickHead;

    const drum = (r, h, x, y, z, tilt = 0.2) => {
      const g = new THREE.Group();
      const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), shell);
      const top = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 20), headM);
      top.rotation.x = -Math.PI / 2;
      top.position.y = h / 2 + 0.001;
      g.add(s, top);
      g.position.set(x, y, z);
      g.rotation.x = tilt;
      kit.add(g);
      return g;
    };
    drum(0.18, 0.14, 0.3, 0.68, 0.45);
    drum(0.15, 0.16, -0.18, 0.92, 0.7);
    drum(0.17, 0.18, 0.2, 0.92, 0.72);
    drum(0.22, 0.4, -0.5, 0.45, 0.45, 0);

    const cymbal = (r, x, y, z, m) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 0.012, 24), m);
      c.position.set(x, y, z);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, y, 6), chrome);
      stand.position.set(x, y / 2, z);
      kit.add(c, stand);
      return c;
    };
    this.hihat = cymbal(0.17, 0.62, 0.95, 0.45, brass);
    this.crashCym = cymbal(0.27, -0.7, 1.5, 0.75, brass);
    this.rideCym = cymbal(0.3, 0.75, 1.35, 0.85, brass);

    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16), mat(0x111111));
    stool.position.set(0, 0.52, 0);
    const stoolLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), chrome);
    stoolLeg.position.set(0, 0.25, 0);
    kit.add(stool, stoolLeg);
    this.scene.add(kit);

    const stickM = mat(0xe8d5a3);
    p.sticks = p.arms.map((a) => {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.013, 0.4, 6), stickM);
      st.rotation.x = Math.PI / 2;
      st.position.set(0, -0.02, 0.18);
      a.hand.add(st);
      return st;
    });
  }

  buildKeys() {
    const p = buildPerson({ shirt: 0x8b5cf6, pants: 0x111827, hair: 0xd1d5db, hairStyle: 'short', skin: 0xe0ac8a });
    p.root.position.set(5.6, STAGE_Y, -1.6);
    p.root.rotation.y = -0.35;
    this.add('keys', p);

    const rig = new THREE.Group();
    rig.position.set(5.6, STAGE_Y, -1.6);
    rig.rotation.y = -0.35;
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.38), mat(0x111111, { roughness: 0.4 }));
    board.position.set(0, 0.95, 0.5);
    const keysWhite = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.02, 0.15), mat(0xf5f5f5));
    keysWhite.position.set(0, 1.01, 0.6);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.01, 0.12), mat(0x222222, { emissive: 0x8b5cf6, emissiveIntensity: 0.8 }));
    panel.position.set(0, 1.006, 0.44);
    const standM = mat(0x444444, { metalness: 0.7 });
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), standM);
      leg.position.set(s * 0.45, 0.45, 0.5);
      leg.rotation.z = s * 0.35;
      rig.add(leg);
    }
    rig.add(board, keysWhite, panel);
    this.keysPanel = panel;
    this.scene.add(rig);
  }

  // World-space points used for framing checks.
  focusPoints(id) {
    const a = this.members[id].anchors;
    return {
      head: a.head.getWorldPosition(new THREE.Vector3()),
      chest: a.chest.getWorldPosition(new THREE.Vector3()),
      hips: a.hips.getWorldPosition(new THREE.Vector3()),
      feet: a.feet.getWorldPosition(new THREE.Vector3()),
    };
  }

  update(t) {
    const bar = t / BAR;
    const beatPh = (t / BEAT) % 1;
    const sec = sectionAt(Math.max(0, bar));
    const energy = t < 0 ? 0.15 : sec ? sec.energy : 0.3;
    const bounce = Math.abs(Math.sin(beatPh * Math.PI)) * 0.05 * energy;

    this.updateSinger(t, bar, beatPh, energy, sec);
    this.updateGuitar(t, bar, beatPh, energy, sec);
    this.updateDrums(t, bar, beatPh, energy, sec);
    this.updateKeys(t, bar, beatPh, energy, sec, bounce);
  }

  updateSinger(t, bar, beatPh, energy, sec) {
    const p = this.members.singer;
    resetPose(p);
    const pos = pathAt(SINGER_PATH, bar);
    let y = STAGE_Y;
    p.root.position.set(pos.x, y, pos.z);
    const [R, L] = [p.arms[1], p.arms[0]];

    if (pos.moving) {
      const speed = bar < 4 ? 2.4 : 1.4;
      walkCycle(p, t * Math.PI * 2 * speed, 1);
      p.root.rotation.y = Math.atan2(pos.dx, pos.dz) * 0.8;
      L.upper.rotation.x = Math.sin(t * Math.PI * 2 * speed) * 0.6;
      if (bar < 4) L.upper.rotation.z = -2.6;
    } else {
      p.root.rotation.y = THREE.MathUtils.lerp(p.root.rotation.y, 0, 0.1);
      const sway = Math.sin(t * Math.PI / (BEAT * 2));
      p.pelvis.rotation.z = sway * 0.06 * (0.5 + energy);
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
      L.upper.rotation.x = -2.6;
      L.upper.rotation.z = -0.2 - clap * 0.25;
      R.upper.rotation.x = -2.6;
      R.upper.rotation.z = 0.2 + clap * 0.25;
      R.lower.rotation.x = -0.2;
      p.root.rotation.y = -0.4;
    }

    // Jump at bar 50.
    const jk = (bar - 50.25) / 0.6;
    if (jk > 0 && jk < 1) {
      p.root.position.y = y + Math.sin(jk * Math.PI) * 0.9;
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

  updateGuitar(t, bar, beatPh, energy, sec) {
    const p = this.members.guitar;
    resetPose(p);
    const pos = pathAt(GUITAR_PATH, bar);
    p.root.position.set(pos.x, STAGE_Y, pos.z);
    p.root.rotation.y = pos.moving ? Math.atan2(pos.dx, pos.dz) * 0.7 : 0.35;
    if (pos.moving) walkCycle(p, t * Math.PI * 4, 1);

    const solo = sec && sec.name === 'Guitar solo';
    const strumRate = solo ? 4 : 2;
    const strum = Math.sin(t / BEAT * Math.PI * strumRate);
    const [fret, pick] = [p.arms[0], p.arms[1]];
    pick.upper.rotation.x = -0.45;
    pick.upper.rotation.z = 0.15;
    pick.lower.rotation.x = -1.1 + strum * 0.35 * (0.4 + energy);
    pick.lower.rotation.z = -0.5;
    fret.upper.rotation.x = -1.0;
    fret.upper.rotation.z = -0.55;
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
      // Knee slide: bar 29 → 30, sliding forward on knees, leaning back.
      const k = (bar - 29) / 1.4;
      if (k >= 0 && k <= 1.6) {
        const kk = clamp01(k);
        p.pelvis.position.y = 0.55;
        p.legs.forEach((l) => { l.thigh.rotation.x = 0.1; l.shin.rotation.x = 1.5; });
        p.pelvis.rotation.x = -0.25 - Math.sin(kk * Math.PI) * 0.6;
        p.head.rotation.x = -0.5;
        fret.upper.rotation.x = -1.6;
      }
    }
  }

  updateDrums(t, bar, beatPh, energy, sec) {
    const p = this.members.drums;
    resetPose(p);
    p.pelvis.position.y = 0.58;
    for (const l of p.legs) {
      l.thigh.position.y = 0.55;
      l.thigh.rotation.x = -1.45;
      l.shin.rotation.x = 1.45;
    }
    const isBreak = sec && sec.name === 'Drum break';
    const rate = isBreak ? 4 : energy > 0.7 ? 2 : 1;
    const ph = (t / BEAT) * rate;
    const hitL = Math.pow(Math.abs(Math.sin(ph * Math.PI)), 3);
    const hitR = Math.pow(Math.abs(Math.cos(ph * Math.PI)), 3);
    const [L, R] = p.arms;
    L.upper.rotation.x = -0.7 - hitL * 0.5;
    L.upper.rotation.z = -0.35;
    L.lower.rotation.x = -0.9 + hitL * 0.6;
    R.upper.rotation.x = -0.7 - hitR * 0.5;
    R.upper.rotation.z = 0.35;
    R.lower.rotation.x = -0.9 + hitR * 0.6;
    p.head.rotation.x = Math.abs(Math.sin(beatPh * Math.PI)) * 0.3 * energy;
    p.pelvis.rotation.x = 0.1;

    if (isBreak) {
      p.pelvis.rotation.y = Math.sin(t * 3) * 0.35;
    }
    const crashK = bar - 43;
    let wob = 0;
    if (crashK >= 0 && crashK < 2) {
      if (crashK < 0.3) {
        L.upper.rotation.x = -2.4;
        L.upper.rotation.z = -0.9;
        L.lower.rotation.x = -0.3;
      }
      wob = Math.exp(-crashK * 3) * 0.4;
    }
    const secStartCrash = sec ? (bar - sec.start) : 9;
    if (secStartCrash < 0.6 && t > 0) wob = Math.max(wob, (0.6 - secStartCrash) * 0.4);
    this.crashCym.rotation.x = Math.sin(t * 30) * wob;
    this.crashCym.rotation.z = Math.cos(t * 26) * wob;
    this.hihat.position.y = 0.95 + (beatPh < 0.1 ? 0.02 : 0);

    const pulse = Math.pow(1 - beatPh, 4) * (t > 0 ? 1 : 0);
    this.kickHead.material.emissiveIntensity = 0.3 + pulse * 1.5 * energy;
  }

  updateKeys(t, bar, beatPh, energy, sec, bounce) {
    const p = this.members.keys;
    resetPose(p);
    p.pelvis.position.y = 0.95 - bounce;
    const [L, R] = p.arms;
    const breakdown = sec && (sec.name === 'Breakdown' || sec.name === 'Pre-chorus');
    for (const a of [L, R]) {
      const ph = t / BEAT * (breakdown ? 4 : 2) + (a.side > 0 ? 0.5 : 0);
      a.upper.rotation.x = -0.75;
      a.upper.rotation.z = a.side * -0.05;
      a.lower.rotation.x = -0.75 + Math.max(0, Math.sin(ph * Math.PI)) * 0.15;
    }
    p.head.rotation.x = 0.25 + Math.abs(Math.sin(beatPh * Math.PI)) * 0.25 * energy;
    p.head.rotation.z = breakdown ? Math.sin(t * 1.5) * 0.15 : 0;
    p.pelvis.rotation.x = 0.12;
    this.keysPanel.material.emissiveIntensity = 0.4 + Math.pow(1 - beatPh, 3) * 1.2;
  }
}
