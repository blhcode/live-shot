import * as THREE from 'three';
import { BAR, BEAT, BAND_NAME, sectionAt } from './show.js';

const PALETTES = {
  Intro: [0x3b82f6, 0x8b5cf6],
  'Verse 1': [0xff2d7a, 0x3b82f6],
  'Pre-chorus': [0x8b5cf6, 0x22d3ee],
  Chorus: [0xfacc15, 0xff2d7a],
  'Guitar solo': [0xef4444, 0xf97316],
  'Verse 2': [0x22d3ee, 0xff2d7a],
  'Drum break': [0xf97316, 0xffffff],
  'Chorus 2': [0xfacc15, 0x22c55e],
  Breakdown: [0x6366f1, 0x0ea5e9],
  'Final chorus': [0xffffff, 0xff2d7a],
  Outro: [0xfacc15, 0xff2d7a],
};

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1, ...opts });
}

export class Venue {
  constructor(scene) {
    this.scene = scene;
    scene.background = new THREE.Color(0x05060a);
    scene.fog = new THREE.FogExp2(0x0a0b14, 0.014);

    this.hemi = new THREE.HemisphereLight(0x8090c0, 0x101018, 0.35);
    scene.add(this.hemi);
    this.houseLight = new THREE.AmbientLight(0xffe0b0, 0.6);
    scene.add(this.houseLight);

    this.buildRoom();
    this.buildStage();
    this.buildLights();
    this.buildScreen();
    this.buildCrowd();
    this.buildParticles();
    this.colorA = new THREE.Color();
    this.colorB = new THREE.Color();
    this.followTarget = new THREE.Vector3();
  }

  buildRoom() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 70), mat(0x15161c, { roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = 8;
    this.scene.add(floor);

    const walls = new THREE.Mesh(new THREE.BoxGeometry(44, 18, 50), mat(0x0d0e16, { side: THREE.BackSide, roughness: 1 }));
    walls.position.set(0, 9, 9);
    this.scene.add(walls);

    // Front-of-house riser where camera 2 sits.
    const riser = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 4), mat(0x1c1d26));
    riser.position.set(0, 1.5, 23.5);
    this.scene.add(riser);
    const railM = mat(0x555a66, { metalness: 0.7, roughness: 0.4 });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(10, 0.06, 0.06), railM);
    rail.position.set(0, 4.05, 21.55);
    this.scene.add(rail);
    for (let x = -5; x <= 5; x += 2.5) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.06), railM);
      post.position.set(x, 3.52, 21.55);
      this.scene.add(post);
    }
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 1.2), mat(0x24252e));
    desk.position.set(3, 3.5, 24.5);
    this.scene.add(desk);
  }

  buildStage() {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 9), mat(0x1a1a1f, { roughness: 0.6 }));
    deck.position.set(0, 0.6, -2.5);
    this.scene.add(deck);

    const riser = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 3), mat(0x22232b));
    riser.position.set(0, 1.5, -4.2);
    this.scene.add(riser);

    this.edgeStrip = new THREE.Mesh(new THREE.BoxGeometry(26, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2d7a }));
    this.edgeStrip.position.set(0, 1.16, 2.03);
    this.scene.add(this.edgeStrip);
    this.riserStrip = new THREE.Mesh(new THREE.BoxGeometry(4, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2d7a }));
    this.riserStrip.position.set(0, 1.78, -2.68);
    this.scene.add(this.riserStrip);

    // Wedge monitors along the stage front.
    const wedgeM = mat(0x111111);
    for (const x of [-5, -0.8, 0.8, 5.5]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.45), wedgeM);
      w.position.set(x, 1.37, 1.6);
      w.rotation.x = -0.5;
      this.scene.add(w);
    }

    // Speaker stacks and amps.
    const cab = mat(0x0f0f12, { roughness: 0.5 });
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.2), cab);
        box.position.set(s * 14.5, 0.55 + i * 1.12, 0.5);
        this.scene.add(box);
      }
      // Flown line array.
      for (let i = 0; i < 5; i++) {
        const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.9), cab);
        box.position.set(s * 12, 10.5 - i * 0.48, 2.2);
        box.rotation.x = 0.08 * i;
        this.scene.add(box);
      }
    }
    const amp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.6), cab);
    amp.position.set(-5.5, 1.8, -3.2);
    this.scene.add(amp);
    const grill = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), mat(0x2a2a2a, { roughness: 1 }));
    grill.position.set(-5.5, 1.7, -2.89);
    this.scene.add(grill);

    // Crowd barrier.
    const barM = mat(0x8a8f99, { metalness: 0.8, roughness: 0.35 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(28, 1.1, 0.12), barM);
    bar.position.set(0, 0.55, 4.6);
    this.scene.add(bar);

    // Trusses.
    const trussM = mat(0x9ca3af, { metalness: 0.85, roughness: 0.3 });
    for (const z of [1.5, -5.5]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(24, 0.4, 0.4), trussM);
      t.position.set(0, 9.5, z);
      this.scene.add(t);
    }
    for (const x of [-12, 12]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9.5, 0.4), trussM);
      t.position.set(x, 4.75 + 1.2, 1.5);
      this.scene.add(t);
    }
  }

  buildLights() {
    this.movers = [];
    const beamGeo = new THREE.CylinderGeometry(0.05, 1.3, 9, 24, 1, true);
    beamGeo.translate(0, -4.5, 0);
    const fixtureGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.45, 12);
    const fixM = mat(0x222222, { metalness: 0.6 });
    const xs = [-9, -5.5, -2, 2, 5.5, 9];
    xs.forEach((x, i) => {
      const z = i % 2 === 0 ? 1.5 : -5.5;
      const pivot = new THREE.Group();
      pivot.position.set(x, 9.2, z);
      const fixture = new THREE.Mesh(fixtureGeo, fixM);
      pivot.add(fixture);
      const beamMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      pivot.add(beam);
      const spot = new THREE.SpotLight(0xffffff, 60, 22, 0.28, 0.6, 1.2);
      spot.position.set(0, 0, 0);
      pivot.add(spot);
      const tgt = new THREE.Object3D();
      tgt.position.set(0, -10, 0);
      pivot.add(tgt);
      spot.target = tgt;
      this.scene.add(pivot);
      this.movers.push({ pivot, beam, spot, phase: i * 0.9, side: i % 2 });
    });

    this.follow = new THREE.SpotLight(0xfff4e0, 400, 45, 0.11, 0.5, 1.2);
    this.follow.position.set(0, 12, 21);
    this.scene.add(this.follow);
    this.scene.add(this.follow.target);

    this.wash = new THREE.SpotLight(0xffffff, 120, 30, 0.7, 0.8, 1.2);
    this.wash.position.set(0, 10, 8);
    this.wash.target.position.set(0, 1.2, -2);
    this.scene.add(this.wash, this.wash.target);
  }

  buildScreen() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 384;
    this.screenCtx = c.getContext('2d');
    this.screenTex = new THREE.CanvasTexture(c);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(18, 6.75), new THREE.MeshBasicMaterial({ map: this.screenTex, fog: false }));
    screen.position.set(0, 5.6, -6.9);
    this.scene.add(screen);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(18.4, 7.1, 0.2), mat(0x050505));
    frame.position.set(0, 5.6, -7.05);
    this.scene.add(frame);
  }

  drawScreen(t, energy, colA, colB, sectionName) {
    const g = this.screenCtx;
    const W = 1024, H = 384;
    const beatPh = ((t / BEAT) % 1 + 1) % 1;
    g.fillStyle = '#05050a';
    g.fillRect(0, 0, W, H);
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#' + colA.getHexString());
    grad.addColorStop(1, '#' + colB.getHexString());
    g.globalAlpha = t < 0 ? 0.15 : 0.25 + (1 - beatPh) * 0.25 * energy;
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;

    if (t >= 0) {
      const n = 48;
      for (let i = 0; i < n; i++) {
        const v = Math.abs(Math.sin(i * 0.7 + t * 3.1) * Math.cos(i * 0.31 - t * 2.3));
        const h = (0.15 + v * 0.7 * energy) * (0.6 + (1 - beatPh) * 0.4) * H * 0.55;
        g.fillStyle = i % 2 ? '#' + colA.getHexString() : '#' + colB.getHexString();
        g.fillRect(i * (W / n) + 3, H - h, W / n - 6, h);
      }
    }
    g.fillStyle = '#ffffff';
    g.shadowColor = '#' + colA.getHexString();
    g.shadowBlur = 30;
    g.font = 'bold 92px "Arial Black", Impact, sans-serif';
    g.textAlign = 'center';
    g.fillText(BAND_NAME, W / 2, 150);
    g.shadowBlur = 0;
    g.font = 'bold 34px Arial, sans-serif';
    g.globalAlpha = 0.8;
    g.fillText(t < 0 ? 'LIVE IN CONCERT' : sectionName.toUpperCase(), W / 2, 205);
    g.globalAlpha = 1;
    this.screenTex.needsUpdate = true;
  }

  buildCrowd() {
    const count = 420;
    const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.75, 3, 8);
    bodyGeo.translate(0, 0.6, 0);
    const headGeo = new THREE.SphereGeometry(0.13, 8, 6);
    this.crowdBodies = new THREE.InstancedMesh(bodyGeo, mat(0xffffff), count);
    this.crowdHeads = new THREE.InstancedMesh(headGeo, mat(0xd2a07c), count);
    this.crowd = [];
    const shirtColors = [0x1f2937, 0x374151, 0x7f1d1d, 0x1e3a8a, 0x14532d, 0x4c1d95, 0x111111, 0x6b7280, 0x9a3412, 0xbe185d];
    const skin = [0xf1c27d, 0xe0ac8a, 0xc68642, 0x8d5524, 0xffdbac];
    const c = new THREE.Color();
    let i = 0;
    while (i < count) {
      const x = (Math.random() * 2 - 1) * 15;
      const z = 5.4 + Math.random() * 13.5;
      if (Math.abs(x) < 5.6 && z > 20.6) continue;
      const h = 0.9 + Math.random() * 0.2;
      this.crowd.push({ x, z, h, ph: Math.random() * Math.PI * 2, jumpy: Math.random(), rot: (Math.random() - 0.5) * 0.6 });
      this.crowdBodies.setColorAt(i, c.setHex(shirtColors[i % shirtColors.length]));
      this.crowdHeads.setColorAt(i, c.setHex(skin[i % skin.length]));
      i++;
    }
    this.scene.add(this.crowdBodies, this.crowdHeads);
    this.dummy = new THREE.Object3D();
  }

  updateCrowd(t, energy) {
    const beatPh = ((t / BEAT) % 1 + 1) % 1;
    const d = this.dummy;
    this.crowd.forEach((p, i) => {
      const jump = p.jumpy < energy * 0.7 ? Math.abs(Math.sin((beatPh + p.ph * 0.05) * Math.PI)) * 0.25 * energy : 0;
      const sway = Math.sin(t * 1.5 + p.ph) * 0.06;
      d.position.set(p.x + sway, jump, p.z);
      d.rotation.set(0, Math.PI + p.rot, sway);
      d.scale.set(1, p.h, 1);
      d.updateMatrix();
      this.crowdBodies.setMatrixAt(i, d.matrix);
      d.position.set(p.x + sway * 1.5, jump + 1.38 * p.h, p.z);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.crowdHeads.setMatrixAt(i, d.matrix);
    });
    this.crowdBodies.instanceMatrix.needsUpdate = true;
    this.crowdHeads.instanceMatrix.needsUpdate = true;
  }

  buildParticles() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const glow = new THREE.CanvasTexture(c);

    const make = (n, size, map) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        size, map, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      pts.frustumCulled = false;
      this.scene.add(pts);
      const parts = Array.from({ length: n }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color() }));
      return { pts, parts, geo, next: 0 };
    };
    this.pyro = make(900, 0.35, glow);
    this.confetti = make(900, 0.12);
    this.confetti.pts.material.blending = THREE.NormalBlending;
    this.firedPyro = new Set();
  }

  emitPyro(x, z, n) {
    const P = this.pyro;
    for (let k = 0; k < n; k++) {
      const part = P.parts[P.next];
      P.next = (P.next + 1) % P.parts.length;
      part.life = 1 + Math.random() * 0.6;
      part.p.set(x + (Math.random() - 0.5) * 0.3, 1.25, z);
      part.v.set((Math.random() - 0.5) * 1.5, 7 + Math.random() * 4, (Math.random() - 0.5) * 1.5);
      part.c.setHSL(0.06 + Math.random() * 0.08, 1, 0.55);
    }
  }

  emitConfetti(n) {
    const C = this.confetti;
    for (let k = 0; k < n; k++) {
      const part = C.parts[C.next];
      C.next = (C.next + 1) % C.parts.length;
      part.life = 6;
      part.p.set((Math.random() - 0.5) * 24, 10 + Math.random() * 3, -3 + Math.random() * 18);
      part.v.set((Math.random() - 0.5) * 0.5, -1 - Math.random(), (Math.random() - 0.5) * 0.5);
      part.c.setHSL(Math.random(), 0.9, 0.6);
    }
  }

  stepParticles(sys, dt, gravity, fade) {
    const pos = sys.geo.attributes.position.array;
    const col = sys.geo.attributes.color.array;
    sys.parts.forEach((part, i) => {
      if (part.life > 0) {
        part.life -= dt;
        part.v.y += gravity * dt;
        if (!fade) part.v.x += Math.sin(part.life * 3 + i) * dt * 0.8;
        part.p.addScaledVector(part.v, dt);
      }
      const alive = part.life > 0 ? 1 : 0;
      pos[i * 3] = part.p.x;
      pos[i * 3 + 1] = alive ? part.p.y : -100;
      pos[i * 3 + 2] = part.p.z;
      const k = fade ? Math.min(1, part.life) * alive : alive;
      col[i * 3] = part.c.r * k;
      col[i * 3 + 1] = part.c.g * k;
      col[i * 3 + 2] = part.c.b * k;
    });
    sys.geo.attributes.position.needsUpdate = true;
    sys.geo.attributes.color.needsUpdate = true;
  }

  update(t, dt, focusPos) {
    const bar = t / BAR;
    const sec = sectionAt(Math.max(0, bar));
    const live = t >= 0;
    const energy = live && sec ? sec.energy : 0.15;
    const beatPh = ((t / BEAT) % 1 + 1) % 1;
    const name = live && sec ? sec.name : 'Intro';
    const [a, b] = PALETTES[name] || PALETTES.Intro;
    this.colorA.lerp(new THREE.Color(a), Math.min(1, dt * 3));
    this.colorB.lerp(new THREE.Color(b), Math.min(1, dt * 3));

    // House lights fade out as the show starts.
    const house = live ? Math.max(0, 0.6 - t * 0.3) : 0.6;
    this.houseLight.intensity = bar >= 66 ? 0.5 : house;
    this.hemi.intensity = 0.25 + energy * 0.1;

    const strobe = name === 'Final chorus' && beatPh < 0.08 ? 1.6 : 1;
    this.movers.forEach((m, i) => {
      const speed = 0.4 + energy * 0.6;
      const sweep = Math.sin(t * speed + m.phase);
      m.pivot.rotation.z = sweep * 0.45;
      m.pivot.rotation.x = (m.side ? -0.25 : 0.25) + Math.cos(t * speed * 0.7 + m.phase) * 0.15;
      const col = i % 2 ? this.colorA : this.colorB;
      const pulse = 0.6 + (1 - beatPh) * 0.4 * energy;
      m.beam.material.color.copy(col);
      m.beam.material.opacity = live ? 0.06 * pulse * strobe : 0;
      m.spot.color.copy(col);
      m.spot.intensity = live ? 70 * pulse * strobe : 0;
    });

    if (focusPos) this.followTarget.lerp(focusPos, Math.min(1, dt * 4));
    this.follow.target.position.copy(this.followTarget);
    this.follow.intensity = live ? 450 : 0;
    this.wash.intensity = live ? 60 + energy * 40 : 15;
    this.wash.color.copy(this.colorA).lerp(new THREE.Color(0xffffff), 0.6);

    this.edgeStrip.material.color.copy(this.colorA).multiplyScalar(live ? 0.6 + (1 - beatPh) * 0.6 : 0.3);
    this.riserStrip.material.color.copy(this.colorB).multiplyScalar(live ? 0.6 + (1 - beatPh) * 0.6 : 0.3);

    this.drawScreen(t, energy, this.colorA, this.colorB, name);
    this.updateCrowd(t, energy);

    // Pyro hits at bars 62, 63, 64; confetti from 62.
    for (const pb of [62, 62.5, 63, 64]) {
      if (bar >= pb && !this.firedPyro.has(pb)) {
        this.firedPyro.add(pb);
        for (const x of [-8, -4.5, 4.5, 8]) this.emitPyro(x, 1.6, 90);
      }
    }
    if (bar >= 16 && bar < 16.05 && !this.firedPyro.has('c1')) {
      this.firedPyro.add('c1');
      for (const x of [-8, 8]) this.emitPyro(x, 1.6, 60);
    }
    if (bar >= 62 && bar < 66) this.emitConfetti(Math.ceil(dt * 120));

    this.stepParticles(this.pyro, dt, -9, true);
    this.stepParticles(this.confetti, dt, 0, false);
  }
}
