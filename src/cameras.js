import * as THREE from 'three';

export const RIG_DEFS = [
  {
    id: 1, name: 'PIT', blurb: 'Tripod in the photo pit – great for close-ups',
    pos: [-4, 1.75, 3.6], look: [0, 2.3, 0.3], fov: 42,
    bounds: { x: [-12, 12], y: [1.0, 2.6], z: [2.6, 4.2] }, fovRange: [12, 70], speed: 3.2, shake: 0, tripod: true,
  },
  {
    id: 2, name: 'FOH RISER', blurb: 'Long lens at the back of the crowd – wides and tight telephoto',
    pos: [0, 4.7, 23], look: [0, 3, -2], fov: 32,
    bounds: { x: [-4.5, 4.5], y: [4.2, 5.8], z: [22, 24.8] }, fovRange: [3.5, 55], speed: 2.2, shake: 0, tripod: true,
  },
  {
    id: 3, name: 'STAGE WING', blurb: 'Handheld on stage-right – side angles, can walk the wing',
    pos: [11.5, 2.85, 0.5], look: [0, 2.4, -1], fov: 55,
    bounds: { x: [9.6, 12.8], y: [2.2, 3.6], z: [-6, 2.3] }, fovRange: [18, 80], speed: 2.6, shake: 1, tripod: false,
  },
];

const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

export function fovToMm(fov) {
  return Math.round(12 / Math.tan(THREE.MathUtils.degToRad(fov) / 2));
}

export class CameraRig {
  constructor(def, scene) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.cam = new THREE.PerspectiveCamera(def.fov, 16 / 9, 0.1, 200);
    this.pos = new THREE.Vector3(...def.pos);
    this.tPos = this.pos.clone();
    const look = new THREE.Vector3(...def.look);
    const d = look.clone().sub(this.pos);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.tYaw = this.yaw;
    this.tPitch = this.pitch;
    this.fov = def.fov;
    this.tFov = def.fov;
    this.home = { pos: this.pos.clone(), yaw: this.yaw, pitch: this.pitch, fov: this.fov };
    this.shakeT = Math.random() * 100;
    this.model = this.buildModel(def);
    scene.add(this.model);
    this.apply(0);
  }

  buildModel(def) {
    const g = new THREE.Group();
    const head = new THREE.Group();
    const bodyM = new THREE.MeshStandardMaterial({ color: 0x2b2d33, roughness: 0.5, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.55), bodyM);
    body.position.z = 0.08;
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.35, 16), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.6 }));
    lens.rotation.x = Math.PI / 2;
    lens.position.z = -0.35;
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.085, 16), new THREE.MeshStandardMaterial({ color: 0x223355, roughness: 0.05, metalness: 1 }));
    glass.rotation.y = Math.PI;
    glass.position.z = -0.53;
    const vf = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.14), bodyM);
    vf.position.set(-0.12, 0.2, 0.25);
    this.tally = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: 0x330000 }));
    this.tally.position.set(0, 0.2, -0.05);
    const label = this.makeLabel(String(def.id));
    label.position.set(0.145, 0, 0.08);
    label.rotation.y = Math.PI / 2;
    head.add(body, lens, glass, vf, this.tally, label);
    g.add(head);
    this.head = head;

    if (def.tripod) {
      const legM = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.5 });
      this.legs = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1, 6), legM);
        leg.userData.angle = a;
        this.legs.add(leg);
      }
      g.add(this.legs);
    }
    if (!def.tripod) {
      const opM = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
      const op = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 4, 8), opM);
      op.position.set(0, -0.75, 0.45);
      const opHead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0xc68642 }));
      opHead.position.set(0, 0.0, 0.42);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), opM);
      cap.position.copy(opHead.position);
      g.add(op, opHead, cap);
      this.operatorBody = op;
    }
    return g;
  }

  makeLabel(text) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#ffd400';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#000';
    g.font = 'bold 52px Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 32, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.18), new THREE.MeshBasicMaterial({ map: tex }));
  }

  // input: { move: {x,y,z} in -1..1, look: {dx, dy} radians, zoom: factor, fine: bool }
  control(input, dt) {
    const fine = input.fine ? 0.3 : 1;
    const zoomScale = this.tFov / 50;
    this.tYaw -= input.look.dx * zoomScale;
    this.tPitch -= input.look.dy * zoomScale;
    this.tPitch = THREE.MathUtils.clamp(this.tPitch, -1.2, 1.0);

    const sp = this.def.speed * fine * dt;
    const fx = -Math.sin(this.tYaw), fz = -Math.cos(this.tYaw);
    const rx = Math.cos(this.tYaw), rz = -Math.sin(this.tYaw);
    this.tPos.x += (fx * input.move.z + rx * input.move.x) * sp;
    this.tPos.z += (fz * input.move.z + rz * input.move.x) * sp;
    this.tPos.y += input.move.y * sp * 0.6;
    const b = this.def.bounds;
    this.tPos.x = THREE.MathUtils.clamp(this.tPos.x, b.x[0], b.x[1]);
    this.tPos.y = THREE.MathUtils.clamp(this.tPos.y, b.y[0], b.y[1]);
    this.tPos.z = THREE.MathUtils.clamp(this.tPos.z, b.z[0], b.z[1]);

    if (input.zoom !== 1) {
      this.tFov = THREE.MathUtils.clamp(this.tFov * input.zoom, this.def.fovRange[0], this.def.fovRange[1]);
    }
  }

  resetHome() {
    this.tPos.copy(this.home.pos);
    this.tYaw = this.home.yaw;
    this.tPitch = this.home.pitch;
    this.tFov = this.home.fov;
  }

  apply(dt) {
    const k = dt === 0 ? 1e9 : 1;
    this.pos.x = damp(this.pos.x, this.tPos.x, 6 * k, dt || 1);
    this.pos.y = damp(this.pos.y, this.tPos.y, 6 * k, dt || 1);
    this.pos.z = damp(this.pos.z, this.tPos.z, 6 * k, dt || 1);
    this.yaw = damp(this.yaw, this.tYaw, 12 * k, dt || 1);
    this.pitch = damp(this.pitch, this.tPitch, 12 * k, dt || 1);
    this.fov = damp(this.fov, this.tFov, 8 * k, dt || 1);

    let sx = 0, sy = 0, sr = 0;
    if (this.def.shake) {
      this.shakeT += dt;
      const s = this.shakeT;
      const amt = 0.004 * this.def.shake * (this.fov / 50);
      sx = (Math.sin(s * 1.7) + Math.sin(s * 3.1) * 0.5) * amt;
      sy = (Math.sin(s * 2.3 + 1) + Math.sin(s * 4.7) * 0.4) * amt;
      sr = Math.sin(s * 1.3) * 0.006 * this.def.shake;
    }

    this.cam.position.copy(this.pos);
    this.cam.rotation.set(this.pitch + sy, this.yaw + sx, sr, 'YXZ');
    this.cam.fov = this.fov;
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();

    this.model.position.copy(this.pos);
    this.head.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (this.legs) {
      this.legs.children.forEach((leg) => {
        const a = leg.userData.angle;
        const h = this.pos.y - (this.id === 2 ? 3 : 0) - 0.15;
        const spread = 0.35 + h * 0.15;
        const dx = Math.cos(a) * spread, dz = Math.sin(a) * spread;
        const len = Math.hypot(h, spread);
        leg.scale.y = len;
        leg.position.set(dx / 2, -0.15 - h / 2, dz / 2);
        leg.rotation.set(0, 0, 0);
        leg.lookAt(this.model.position.x + dx, this.model.position.y - 0.15 - h, this.model.position.z + dz);
        leg.rotateX(Math.PI / 2);
      });
    }
    if (this.operatorBody) {
      this.model.rotation.y = this.yaw;
      this.head.rotation.set(this.pitch, 0, 0);
      const h = this.pos.y - 1.2;
      this.operatorBody.scale.y = h / 1.4;
      this.operatorBody.position.y = -h / 2 - 0.05;
    }
  }

  setTally(state) {
    const c = state === 'live' ? 0xff1a1a : state === 'preview' ? 0x18c050 : 0x220000;
    this.tally.material.color.setHex(c);
  }
}
