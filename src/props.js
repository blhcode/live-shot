import * as THREE from 'three';
import { mat } from './people.js';

const chrome = () => mat(0xcccccc, { metalness: 0.9, roughness: 0.25 });
const brass = () => mat(0xd4a017, { metalness: 0.9, roughness: 0.3 });

export function drumKit(scene, { x = 0, y = 0, z = 0, shell = 0x1e3a8a, head = 0xff2d7a, scale = 1, ry = 0 } = {}) {
  const kit = new THREE.Group();
  kit.position.set(x, y, z);
  kit.rotation.y = ry;
  kit.scale.setScalar(scale);
  const shellM = mat(shell, { roughness: 0.3, metalness: 0.4 });
  const headM = mat(0xeeeeee, { roughness: 0.8 });

  const kick = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.45, 24), shellM);
  kick.rotation.x = Math.PI / 2;
  kick.position.set(0, 0.4, 0.75);
  const kickHead = new THREE.Mesh(new THREE.CircleGeometry(0.38, 24), mat(0x111111, { emissive: head, emissiveIntensity: 0.6 }));
  kickHead.position.set(0, 0.4, 0.98);
  kit.add(kick, kickHead);

  const drum = (r, h, dx, dy, dz, tilt = 0.2) => {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), shellM);
    const top = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 20), headM);
    top.rotation.x = -Math.PI / 2;
    top.position.y = h / 2 + 0.001;
    g.add(s, top);
    g.position.set(dx, dy, dz);
    g.rotation.x = tilt;
    kit.add(g);
    return g;
  };
  drum(0.18, 0.14, 0.3, 0.68, 0.45);
  drum(0.15, 0.16, -0.18, 0.92, 0.7);
  drum(0.17, 0.18, 0.2, 0.92, 0.72);
  drum(0.22, 0.4, -0.5, 0.45, 0.45, 0);

  const cymbal = (r, dx, dy, dz) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 0.012, 24), brass());
    c.position.set(dx, dy, dz);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, dy, 6), chrome());
    stand.position.set(dx, dy / 2, dz);
    kit.add(c, stand);
    return c;
  };
  const hihat = cymbal(0.17, 0.62, 0.95, 0.45);
  const crash = cymbal(0.27, -0.7, 1.5, 0.75);
  cymbal(0.3, 0.75, 1.35, 0.85);

  const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16), mat(0x111111));
  stool.position.set(0, 0.52, 0);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), chrome());
  leg.position.set(0, 0.25, 0);
  kit.add(stool, leg);
  scene.add(kit);
  return { group: kit, kickHead, hihat, crash, hihatY: 0.95 };
}

// Attaches drumsticks (or brushes) to a seated drummer's hands.
export function sticks(person, color = 0xe8d5a3) {
  return person.arms.map((a) => {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.013, 0.4, 6), mat(color));
    st.rotation.x = Math.PI / 2;
    st.position.set(0, -0.02, 0.18);
    a.hand.add(st);
    return st;
  });
}

export function keyboard(scene, { x, y, z, ry = 0, glow = 0x8b5cf6 }) {
  const rig = new THREE.Group();
  rig.position.set(x, y, z);
  rig.rotation.y = ry;
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.38), mat(0x111111, { roughness: 0.4 }));
  board.position.set(0, 0.95, 0.5);
  const keys = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.02, 0.15), mat(0xf5f5f5));
  keys.position.set(0, 1.01, 0.6);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.01, 0.12), mat(0x222222, { emissive: glow, emissiveIntensity: 0.8 }));
  panel.position.set(0, 1.006, 0.44);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), mat(0x444444, { metalness: 0.7 }));
    leg.position.set(s * 0.45, 0.45, 0.5);
    leg.rotation.z = s * 0.35;
    rig.add(leg);
  }
  rig.add(board, keys, panel);
  scene.add(rig);
  return { group: rig, panel };
}

export function guitar(person, { body = 0xd62828 } = {}) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.06, 20), mat(body, { roughness: 0.35, metalness: 0.2 }));
  b.rotation.x = Math.PI / 2;
  b.scale.set(1, 1, 1.25);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.03), mat(0x3b2412));
  neck.position.set(0, 0.42, 0);
  const headstock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.03), mat(0x111111));
  headstock.position.set(0, 0.78, 0);
  g.add(b, neck, headstock);
  g.position.set(0.02, 0.2, 0.2);
  g.rotation.z = 1.05;
  person.pelvis.add(g);
  return g;
}

export function handMic(person, armIndex = 1) {
  const mic = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.18, 8), mat(0x222222, { metalness: 0.6 }));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(0x999999, { metalness: 0.8, roughness: 0.3 }));
  ball.position.y = 0.11;
  mic.add(handle, ball);
  mic.position.set(0, -0.02, 0.04);
  mic.rotation.x = 0.4;
  person.arms[armIndex].hand.add(mic);
  return mic;
}

export function micStand(scene, { x, y, z, height = 1.55 }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, height, 8), chrome());
  pole.position.y = height / 2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.03, 16), mat(0x111111));
  const mic = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mat(0x999999, { metalness: 0.8, roughness: 0.3 }));
  mic.position.set(0, height + 0.04, 0.05);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.16, 8), mat(0x222222));
  body.position.set(0, height - 0.04, 0.02);
  body.rotation.x = 0.4;
  g.add(pole, base, mic, body);
  scene.add(g);
  return g;
}

export function grandPiano(scene, { x, y, z, ry = 0 }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const black = mat(0x050505, { roughness: 0.15, metalness: 0.3 });
  const shape = new THREE.Shape();
  shape.moveTo(-0.75, 0);
  shape.lineTo(0.75, 0);
  shape.lineTo(0.75, 1.0);
  shape.bezierCurveTo(0.75, 1.9, 0.1, 1.6, -0.2, 2.1);
  shape.lineTo(-0.75, 2.1);
  shape.lineTo(-0.75, 0);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.32, bevelEnabled: false }), black);
  body.rotation.x = Math.PI / 2;
  body.position.y = 1.0;
  const lidPivot = new THREE.Group();
  lidPivot.position.set(-0.75, 1.0, 0);
  const lidMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(0x050505, { roughness: 0.15, side: THREE.DoubleSide }));
  lidMesh.rotation.x = Math.PI / 2;
  lidMesh.position.x = 0.75;
  lidPivot.add(lidMesh);
  lidPivot.rotation.z = 0.6;
  const keys = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.18), mat(0xf5f5f5));
  keys.position.set(0, 0.8, 0.09);
  const keyBed = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.26), black);
  keyBed.position.set(0, 0.72, 0.1);
  for (const [lx, lz] of [[-0.6, -0.15], [0.6, -0.15], [-0.4, -1.8]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.68, 8), black);
    leg.position.set(lx, 0.34, lz);
    g.add(leg);
  }
  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.35), black);
  bench.position.set(0, 0.25, 0.7);
  // Piano body extends away from the keyboard (towards -z in local space).
  const bodyGroup = new THREE.Group();
  bodyGroup.add(body, lidPivot);
  bodyGroup.rotation.y = Math.PI;
  bodyGroup.position.z = 0;
  g.add(bodyGroup, keys, keyBed, bench);
  scene.add(g);
  return g;
}

export function uprightBass(scene, { x, y, z, ry = 0 }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const wood = mat(0x8b4513, { roughness: 0.4, metalness: 0.1 });
  const lower = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), wood);
  lower.scale.set(1, 1.1, 0.4);
  lower.position.y = 0.55;
  const upper = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), wood);
  upper.scale.set(1, 1.1, 0.4);
  upper.position.y = 1.05;
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.85, 0.06), mat(0x1a1a1a));
  neck.position.y = 1.65;
  const scroll = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), wood);
  scroll.position.y = 2.1;
  const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6), chrome());
  spike.position.y = 0.1;
  g.add(lower, upper, neck, scroll, spike);
  g.rotation.z = 0.15;
  scene.add(g);
  return g;
}

export function sax(person) {
  const g = new THREE.Group();
  const b = brass();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.55, 12), b);
  tube.position.y = -0.1;
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.06, 0.16, 16, 1, true), mat(0xd4a017, { metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }));
  bell.position.set(0.06, -0.38, 0.06);
  bell.rotation.z = -0.9;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.2, 8), b);
  neck.position.set(-0.03, 0.24, 0.03);
  neck.rotation.z = 0.5;
  g.add(tube, bell, neck);
  g.position.set(0, 0.3, 0.2);
  g.rotation.x = 0.25;
  person.pelvis.add(g);
  return g;
}

export function djBooth(scene, { x, y, z, glow = 0x22d3ee }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 0.8), mat(0x111111, { roughness: 0.4 }));
  desk.position.y = 0.5;
  const front = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.8), new THREE.MeshBasicMaterial({ color: glow }));
  front.position.set(0, 0.5, 0.405);
  const decks = [];
  for (const s of [-1, 1]) {
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 24), mat(0x222222, { metalness: 0.5, roughness: 0.3 }));
    deck.position.set(s * 0.6, 1.02, 0);
    const dot = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    dot.position.set(0, 0.02, 0.06);
    deck.add(dot);
    g.add(deck);
    decks.push(deck);
  }
  const mixer = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.4), mat(0x333333, { emissive: glow, emissiveIntensity: 0.4 }));
  mixer.position.set(0, 1.03, 0);
  const laptop = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.02), mat(0x999999, { metalness: 0.8, emissive: 0xffffff, emissiveIntensity: 0.05 }));
  laptop.position.set(0, 1.17, -0.2);
  laptop.rotation.x = -0.25;
  g.add(desk, front, mixer, laptop);
  scene.add(g);
  return { group: g, front, decks };
}

export function podium(scene, { x, y, z, w = 1.4, h = 1.0, glow = 0xff2d7a }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat(0x111111));
  box.position.y = h / 2;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.06, w + 0.02), new THREE.MeshBasicMaterial({ color: glow }));
  strip.position.y = h - 0.03;
  g.add(box, strip);
  scene.add(g);
  return { group: g, strip, top: y + h };
}

export function magicTable(scene, { x, y, z }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 24), mat(0x111111));
  top.position.y = 0.9;
  const cloth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.5, 24, 1, true), mat(0x6b0f1a, { side: THREE.DoubleSide }));
  cloth.position.y = 0.66;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), brass());
  stem.position.y = 0.45;
  const hat = new THREE.Group();
  const hatM = mat(0x0a0a0a, { roughness: 0.5 });
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.13, 0.28, 20, 1, true), mat(0x0a0a0a, { side: THREE.DoubleSide }));
  crown.position.y = 0.14;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 20), hatM);
  brim.position.y = 0.28;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), hatM);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.005;
  hat.add(crown, brim, bottom);
  hat.position.y = 0.92;
  g.add(top, cloth, stem, hat);
  scene.add(g);
  return { group: g, hat, topY: y + 0.92 };
}

export function rabbit(scene) {
  const g = new THREE.Group();
  const white = mat(0xf8f8f8, { roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), white);
  body.scale.set(1, 1.15, 1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), white);
  head.position.set(0, 0.15, 0.03);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.12, 4, 8), white);
    ear.position.set(s * 0.035, 0.27, 0.01);
    ear.rotation.z = s * -0.2;
    g.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), mat(0xff3366));
    eye.position.set(s * 0.03, 0.17, 0.095);
    g.add(eye);
  }
  g.add(body, head);
  scene.add(g);
  return g;
}

export function magicBox(scene, { x, y, z }) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const spin = new THREE.Group();
  g.add(spin);
  const panelM = mat(0x1e1b4b, { roughness: 0.4, metalness: 0.3 });
  const trimM = mat(0xd4a017, { metalness: 0.9, roughness: 0.3 });
  const W = 1.0, H = 2.2, D = 1.0;
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.05), panelM);
  back.position.set(0, H / 2 + 0.1, -D / 2);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, D), panelM);
  left.position.set(-W / 2, H / 2 + 0.1, 0);
  const right = left.clone();
  right.position.x = W / 2;
  const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.08, D + 0.1), trimM);
  top.position.y = H + 0.14;
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, 0.1, D + 0.1), trimM);
  base.position.y = 0.05;
  spin.add(back, left, right, top, base);
  for (const s of [-1, 1]) {
    for (const zz of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0x111111));
      wheel.position.set(s * 0.45, 0.0, zz * 0.45);
      spin.add(wheel);
    }
  }
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-W / 2, 0.1, D / 2);
  const door = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.05), panelM);
  door.position.set(W / 2, H / 2, 0);
  const star = new THREE.Mesh(new THREE.CircleGeometry(0.22, 5), mat(0xd4a017, { metalness: 0.9, roughness: 0.3, emissive: 0x664400, emissiveIntensity: 0.4 }));
  star.position.set(W / 2, H * 0.62, 0.03);
  doorPivot.add(door, star);
  spin.add(doorPivot);
  scene.add(g);
  return { group: g, spin, door: doorPivot };
}

export function hoop(scene) {
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.02, 8, 40), mat(0xd4a017, { metalness: 0.9, roughness: 0.2, emissive: 0x553300, emissiveIntensity: 0.4 }));
  scene.add(h);
  return h;
}

export function wand(person, armIndex = 1) {
  const w = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 8), mat(0x0a0a0a));
  stick.position.y = 0.1;
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.05, 8), mat(0xffffff));
  tip.position.y = 0.27;
  w.add(stick, tip);
  w.rotation.x = 1.2;
  w.position.set(0, -0.03, 0.03);
  person.arms[armIndex].hand.add(w);
  return w;
}
