import * as THREE from 'three';

const cache = {};
export function mat(color, opts = {}) {
  const key = Object.keys(opts).length ? null : color;
  if (key !== null && cache[key]) return cache[key];
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...opts });
  if (key !== null) cache[key] = m;
  return m;
}

export function limb(len, radius, material) {
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, len, 4, 10), material);
  mesh.position.y = -len / 2;
  pivot.add(mesh);
  return pivot;
}

// Builds a jointed figure standing at its root's origin, facing +z (towards the audience).
export function buildPerson({
  shirt, pants, skin = 0xe0ac8a, hair = 0x2a1a10, hairStyle = 'short',
  dress = null, hat = null, cape = null, sparkle = false,
}) {
  const shirtM = sparkle ? mat(shirt, { metalness: 0.6, roughness: 0.25, emissive: shirt, emissiveIntensity: 0.15 }) : mat(shirt);
  const pantsM = mat(pants);
  const skinM = mat(skin);
  const hairM = mat(hair, { roughness: 0.9 });
  const shoeM = mat(0x111111);

  const root = new THREE.Group();

  const legs = [];
  for (const side of [-1, 1]) {
    const thigh = limb(0.38, 0.085, dress ? skinM : pantsM);
    thigh.position.set(side * 0.11, 0.92, 0);
    const shin = limb(0.38, 0.075, dress ? skinM : pantsM);
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

  if (dress) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, dress.long ? 0.42 : 0.34, dress.long ? 0.95 : 0.5, 18, 1, true),
      mat(dress.color, { side: THREE.DoubleSide, metalness: sparkle ? 0.5 : 0.05, roughness: sparkle ? 0.3 : 0.7 }));
    skirt.position.y = dress.long ? -0.4 : -0.15;
    pelvis.add(skirt);
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 8), skinM);
  neck.position.y = 0.73;
  pelvis.add(neck);

  const head = new THREE.Group();
  head.position.y = 0.86;
  pelvis.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), skinM);
  skull.scale.set(0.95, 1.08, 1);
  head.add(skull);
  const cap = hairStyle === 'long' || hairStyle === 'ponytail' ? Math.PI * 0.6 : Math.PI * 0.48;
  if (hairStyle !== 'bald') {
    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, cap), hairM);
    hairCap.position.set(0, 0.02, -0.01);
    head.add(hairCap);
  }
  if (hairStyle === 'long') {
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.08), hairM);
    back.position.set(0, -0.1, -0.1);
    head.add(back);
  }
  if (hairStyle === 'ponytail') {
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.25, 4, 8), hairM);
    tail.position.set(0, -0.05, -0.17);
    tail.rotation.x = 0.4;
    head.add(tail);
  }
  if (hairStyle === 'mohawk') {
    const hawk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.26), hairM);
    hawk.position.set(0, 0.16, 0);
    head.add(hawk);
  }
  if (hairStyle === 'afro') {
    const fro = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), hairM);
    fro.position.set(0, 0.07, -0.03);
    head.add(fro);
  }
  if (hat === 'top') {
    const hatM = mat(0x0a0a0a, { roughness: 0.5 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 20), hatM);
    brim.position.y = 0.11;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.28, 20), hatM);
    crown.position.y = 0.25;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.142, 0.142, 0.05, 20), mat(0x8b0000));
    band.position.y = 0.14;
    head.add(brim, crown, band);
  }
  if (hat === 'cap') {
    const capM = mat(0x111111);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.145, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), capM);
    dome.position.y = 0.03;
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.14), capM);
    peak.position.set(0, 0.04, -0.17);
    head.add(dome, peak);
  }
  if (hat === 'headphones') {
    const hpM = mat(0x111111, { metalness: 0.5 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 16, Math.PI), hpM);
    band.position.y = 0.02;
    for (const s of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), hpM);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(s * 0.14, 0, 0);
      head.add(cup);
    }
    head.add(band);
  }
  const eyeM = mat(0x111111);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeM);
    eye.position.set(side * 0.045, 0.02, 0.12);
    head.add(eye);
  }

  if (cape) {
    const capeMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.15, 1, 6),
      mat(cape, { side: THREE.DoubleSide, roughness: 0.5 }));
    capeMesh.position.set(0, 0.1, -0.17);
    pelvis.add(capeMesh);
  }

  const arms = [];
  for (const side of [-1, 1]) {
    const upper = limb(0.27, 0.06, shirtM);
    upper.position.set(side * 0.27, 0.58, 0);
    const lower = limb(0.25, 0.05, dress ? skinM : shirtM);
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

export function resetPose(p) {
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

export function walkCycle(p, phase, amount = 1) {
  const s = Math.sin(phase);
  p.legs[0].thigh.rotation.x = s * 0.6 * amount;
  p.legs[1].thigh.rotation.x = -s * 0.6 * amount;
  p.legs[0].shin.rotation.x = Math.max(0, -s) * 0.9 * amount;
  p.legs[1].shin.rotation.x = Math.max(0, s) * 0.9 * amount;
  p.arms[0].upper.rotation.x = -s * 0.5 * amount;
  p.arms[1].upper.rotation.x = s * 0.5 * amount;
}

export function seat(p, height = 0.58) {
  p.pelvis.position.y = height;
  for (const l of p.legs) {
    l.thigh.position.y = height - 0.03;
    l.thigh.rotation.x = -1.45;
    l.shin.rotation.x = 1.45;
  }
}

export function armsUp(p, amount = 1, spread = 0.35) {
  for (const a of p.arms) {
    a.upper.rotation.x = -2.8 * amount;
    a.upper.rotation.z = a.side * spread * amount;
    a.lower.rotation.x = -0.2 * amount;
  }
}

export function bow(p, k) {
  p.pelvis.rotation.x = 0.9 * k;
  for (const a of p.arms) a.upper.rotation.x = -0.3 * k;
}

export const smooth = (x) => x * x * (3 - 2 * x);
export const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Piecewise path: list of [bar, x, z]. Returns position and whether the person is walking.
export function pathAt(path, bar) {
  if (bar <= path[0][0]) return { x: path[0][1], z: path[0][2], moving: false };
  for (let i = 0; i < path.length - 1; i++) {
    const [b0, x0, z0] = path[i];
    const [b1, x1, z1] = path[i + 1];
    if (bar >= b0 && bar <= b1) {
      const k = b1 === b0 ? 1 : (bar - b0) / (b1 - b0);
      const e = smooth(k);
      const moving = (x0 !== x1 || z0 !== z1) && k > 0 && k < 1;
      return { x: x0 + (x1 - x0) * e, z: z0 + (z1 - z0) * e, moving, dx: x1 - x0, dz: z1 - z0, speed: Math.hypot(x1 - x0, z1 - z0) / Math.max(0.1, b1 - b0) };
    }
  }
  const last = path[path.length - 1];
  return { x: last[1], z: last[2], moving: false };
}

// Places a person along a path, turning them to face the way they walk and animating their legs.
export function followPath(p, path, bar, t, y, restYaw = 0) {
  const pos = pathAt(path, bar);
  p.root.position.set(pos.x, y, pos.z);
  if (pos.moving) {
    p.root.rotation.y = Math.atan2(pos.dx, pos.dz);
    walkCycle(p, t * Math.PI * 2 * Math.min(2.6, 0.8 + pos.speed * 0.5), 1);
  } else {
    p.root.rotation.y = restYaw;
  }
  return pos;
}

export class Cast {
  constructor(scene) {
    this.scene = scene;
    this.members = {};
  }

  add(id, person) {
    this.scene.add(person.root);
    this.members[id] = person;
    return person;
  }

  get ids() {
    return Object.keys(this.members);
  }

  focusPoints(id) {
    const a = this.members[id].anchors;
    return {
      head: a.head.getWorldPosition(new THREE.Vector3()),
      chest: a.chest.getWorldPosition(new THREE.Vector3()),
      hips: a.hips.getWorldPosition(new THREE.Vector3()),
      feet: a.feet.getWorldPosition(new THREE.Vector3()),
    };
  }
}
