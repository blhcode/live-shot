import * as THREE from 'three';
import { T, sectionAt } from './show.js';
import { mat } from './people.js';

function velvetTexture(color = '#7a0d1c', w = 512, h = 256, folds = 16) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i <= folds; i++) {
    const k = i / folds;
    grad.addColorStop(Math.min(1, k), i % 2 ? '#000000' : color);
  }
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.55;
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const SPARK_COLORS = {
  fire: () => new THREE.Color().setHSL(0.06 + Math.random() * 0.08, 1, 0.55),
  gold: () => new THREE.Color().setHSL(0.12 + Math.random() * 0.04, 1, 0.6),
  co2: () => new THREE.Color(0.75, 0.8, 0.85),
};

export class Venue {
  constructor(scene, cfg) {
    this.scene = scene;
    this.cfg = cfg;
    scene.background = new THREE.Color(cfg.background ?? 0x05060a);
    scene.fog = new THREE.FogExp2(cfg.fogColor ?? 0x0a0b14, cfg.fog ?? 0.014);

    this.hemi = new THREE.HemisphereLight(0x8090c0, 0x101018, 0.35);
    scene.add(this.hemi);
    this.houseLight = new THREE.AmbientLight(0xffe0b0, cfg.house ?? 0.6);
    scene.add(this.houseLight);

    this.strips = [];
    this.buildRoom();
    this.buildStage();
    this.buildLights();
    if (cfg.screen) this.buildScreen();
    if (cfg.curtain) this.buildCurtain();
    if (cfg.lasers) this.buildLasers();
    this.buildCrowd();
    this.buildParticles();
    this.colorA = new THREE.Color(0x222222);
    this.colorB = new THREE.Color(0x222222);
    this.followTarget = new THREE.Vector3(0, 2, 0);
    this.fired = new Set();
  }

  get stageTop() {
    return this.cfg.stage.h;
  }

  // ---------- room & stage ----------
  buildRoom() {
    const r = { w: 44, h: 18, d: 50, z: 9, wall: 0x0d0e16, floor: 0x15161c, ...this.cfg.room };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.d), mat(r.floor, { roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = r.z;
    this.scene.add(floor);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(r.w, r.h, r.d), mat(r.wall, { side: THREE.BackSide, roughness: 1 }));
    walls.position.set(0, r.h / 2, r.z);
    this.scene.add(walls);

    const railM = mat(0x555a66, { metalness: 0.7, roughness: 0.4 });
    const rail = (x, y, z, w) => {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.06), railM);
      bar.position.set(x, y + 1.05, z);
      this.scene.add(bar);
      for (let px = x - w / 2; px <= x + w / 2 + 0.01; px += w / 4) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.05, 0.06), railM);
        post.position.set(px, y + 0.52, z);
        this.scene.add(post);
      }
    };

    const f = this.cfg.foh;
    if (f) {
      const riser = new THREE.Mesh(new THREE.BoxGeometry(f.w, f.h, f.d), mat(0x1c1d26));
      riser.position.set(f.x ?? 0, f.h / 2, f.z);
      this.scene.add(riser);
      rail(f.x ?? 0, f.h, f.z - f.d / 2 + 0.05, f.w);
      if (f.desk !== false) {
        const desk = new THREE.Mesh(new THREE.BoxGeometry(Math.min(3.2, f.w * 0.35), 1, 1.2), mat(0x24252e));
        desk.position.set((f.x ?? 0) + f.w * 0.3, f.h + 0.5, f.z + f.d / 2 - 0.8);
        this.scene.add(desk);
      }
    }
    const b = this.cfg.balcony;
    if (b) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.4, b.d), mat(0x2a1a1a));
      slab.position.set(0, b.y - 0.2, b.z + b.d / 2);
      this.scene.add(slab);
      const front = new THREE.Mesh(new THREE.BoxGeometry(b.w, 1.0, 0.15), mat(0x7a0d1c, { roughness: 0.6 }));
      front.position.set(0, b.y + 0.5, b.z);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(b.w, 0.08, 0.2), mat(0xd4a017, { metalness: 0.9, roughness: 0.3 }));
      trim.position.set(0, b.y + 1.02, b.z);
      this.scene.add(front, trim);
      for (const x of [-b.w / 3, 0, b.w / 3]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, b.y, 12), mat(0x3a2a2a));
        col.position.set(x, b.y / 2, b.z + 0.6);
        this.scene.add(col);
      }
    }
    if (this.cfg.sconces) {
      const lampM = new THREE.MeshBasicMaterial({ color: 0xffb35c });
      for (const side of [-1, 1]) {
        for (let z = 0; z < r.z + r.d / 2 - 2; z += 5) {
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), lampM);
          lamp.position.set(side * (r.w / 2 - 0.2), 3, z);
          this.scene.add(lamp);
        }
      }
    }
  }

  buildStage() {
    const s = this.cfg.stage;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), mat(s.color ?? 0x1a1a1f, { roughness: 0.6 }));
    deck.position.set(0, s.h / 2, s.front - s.d / 2);
    this.scene.add(deck);
    if (s.strip !== false) this.addStrip(s.w, s.h - 0.04, s.front + 0.03, 0);

    for (const r of this.cfg.risers || []) {
      const riser = new THREE.Mesh(new THREE.BoxGeometry(r.w, r.h, r.d), mat(0x22232b));
      riser.position.set(r.x ?? 0, s.h + r.h / 2, r.z);
      this.scene.add(riser);
      if (r.strip !== false) this.addStrip(r.w, s.h + r.h - 0.02, r.z + r.d / 2 + 0.02, 1, r.x ?? 0);
    }

    const wedgeM = mat(0x111111);
    for (const x of this.cfg.wedges || []) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.45), wedgeM);
      w.position.set(x, s.h + 0.17, s.front - 0.4);
      w.rotation.x = -0.5;
      this.scene.add(w);
    }

    if (this.cfg.speakers) {
      const cab = mat(0x0f0f12, { roughness: 0.5 });
      const sx = s.w / 2 + 1.5;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const box = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 1.2), cab);
          box.position.set(side * sx, 0.55 + i * 1.12, s.front - 1.5);
          this.scene.add(box);
        }
        for (let i = 0; i < 5; i++) {
          const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.9), cab);
          box.position.set(side * (s.w / 2 - 1), 10.5 - i * 0.48, s.front + 0.2);
          box.rotation.x = 0.08 * i;
          this.scene.add(box);
        }
      }
    }

    if (this.cfg.barrier) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(s.w + 2, 1.1, 0.12), mat(0x8a8f99, { metalness: 0.8, roughness: 0.35 }));
      bar.position.set(0, 0.55, this.cfg.barrier);
      this.scene.add(bar);
    }

    const tr = this.cfg.truss;
    if (tr) {
      const trussM = mat(0x9ca3af, { metalness: 0.85, roughness: 0.3 });
      for (const z of tr.zs) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(tr.w, 0.4, 0.4), trussM);
        t.position.set(0, tr.y, z);
        this.scene.add(t);
      }
      for (const x of [-tr.w / 2, tr.w / 2]) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, tr.y - s.h, 0.4), trussM);
        t.position.set(x, s.h + (tr.y - s.h) / 2, tr.zs[0]);
        this.scene.add(t);
      }
    }

    const p = this.cfg.proscenium;
    if (p) {
      const gold = mat(0xb8860b, { metalness: 0.8, roughness: 0.35 });
      const wallM = mat(0x2a0a10, { roughness: 0.9 });
      for (const side of [-1, 1]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.6, p.h, 0.6), gold);
        col.position.set(side * (p.w / 2 + 0.3), p.h / 2, p.z);
        const wall = new THREE.Mesh(new THREE.BoxGeometry(20, p.h + 6, 0.3), wallM);
        wall.position.set(side * (p.w / 2 + 0.6 + 10), (p.h + 6) / 2, p.z - 0.2);
        this.scene.add(col, wall);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(p.w + 1.2, 1.0, 0.6), gold);
      beam.position.set(0, p.h, p.z);
      const above = new THREE.Mesh(new THREE.BoxGeometry(p.w + 1.2, 6, 0.3), wallM);
      above.position.set(0, p.h + 3.5, p.z - 0.2);
      const valance = new THREE.Mesh(new THREE.PlaneGeometry(p.w, 1.2), new THREE.MeshStandardMaterial({ map: velvetTexture('#7a0d1c', 512, 64, 40), roughness: 0.9 }));
      valance.position.set(0, p.h - 1.05, p.z - 0.32);
      this.scene.add(beam, above, valance);
    }

    const fl = this.cfg.footlights;
    if (fl) {
      const bulbM = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
      for (let x = -fl.w / 2; x <= fl.w / 2; x += 0.6) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bulbM);
        bulb.position.set(x, s.h + 0.05, s.front - 0.15);
        this.scene.add(bulb);
      }
      this.footBulbs = bulbM;
    }
  }

  addStrip(w, y, z, which, x = 0) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2d7a }));
    strip.position.set(x, y, z);
    this.scene.add(strip);
    this.strips.push({ mesh: strip, which });
  }

  // ---------- lights ----------
  buildLights() {
    this.movers = [];
    const mv = this.cfg.movers;
    if (mv) {
      const beamGeo = new THREE.CylinderGeometry(0.05, 1.3, 9, 24, 1, true);
      beamGeo.translate(0, -4.5, 0);
      const fixtureGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.45, 12);
      const fixM = mat(0x222222, { metalness: 0.6 });
      for (let i = 0; i < mv.count; i++) {
        const x = mv.count === 1 ? 0 : -mv.span + (2 * mv.span * i) / (mv.count - 1);
        const z = mv.zs[i % mv.zs.length];
        const pivot = new THREE.Group();
        pivot.position.set(x, mv.y, z);
        pivot.add(new THREE.Mesh(fixtureGeo, fixM));
        const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
          color: 0xffffff, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
        }));
        pivot.add(beam);
        const spot = new THREE.SpotLight(0xffffff, 60, 22, 0.28, 0.6, 1.2);
        pivot.add(spot);
        const tgt = new THREE.Object3D();
        tgt.position.set(0, -10, 0);
        pivot.add(tgt);
        spot.target = tgt;
        this.scene.add(pivot);
        this.movers.push({ pivot, beam, spot, phase: i * 0.9, side: i % 2 });
      }
    }

    const f = { x: 0, y: 12, z: 21, intensity: 450, ...this.cfg.follow };
    this.follow = new THREE.SpotLight(0xfff4e0, f.intensity, 45, 0.11, 0.5, 1.2);
    this.follow.position.set(f.x, f.y, f.z);
    this.scene.add(this.follow, this.follow.target);

    const w = { pos: [0, 10, 8], target: [0, 1.2, -2], base: 60, angle: 0.7, ...this.cfg.wash };
    this.wash = new THREE.SpotLight(0xffffff, w.base, 30, w.angle, 0.8, 1.2);
    this.wash.position.set(...w.pos);
    this.wash.target.position.set(...w.target);
    this.scene.add(this.wash, this.wash.target);

    this.spots = (this.cfg.spots || []).map((sp) => {
      const l = new THREE.SpotLight(sp.color ?? 0xffb060, sp.intensity ?? 150, 25, sp.angle ?? 0.35, 0.7, 1.2);
      l.position.set(...sp.pos);
      l.target.position.set(...sp.target);
      this.scene.add(l, l.target);
      return { light: l, base: sp.intensity ?? 150 };
    });
  }

  // ---------- backdrop ----------
  buildScreen() {
    const sc = this.cfg.screen;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = Math.round((1024 * sc.h) / sc.w);
    this.screenCtx = c.getContext('2d');
    this.screenTex = new THREE.CanvasTexture(c);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const material = sc.style === 'led'
      ? new THREE.MeshBasicMaterial({ map: this.screenTex, fog: false })
      : new THREE.MeshStandardMaterial({ map: this.screenTex, emissiveMap: this.screenTex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.9 });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(sc.w, sc.h), material);
    screen.position.set(0, sc.y, sc.z);
    this.scene.add(screen);
    if (sc.style === 'led') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(sc.w + 0.4, sc.h + 0.35, 0.2), mat(0x050505));
      frame.position.set(0, sc.y, sc.z - 0.15);
      this.scene.add(frame);
    }
    this.stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * 0.85, r: Math.random() * 2 + 0.6, p: Math.random() * 6 }));
  }

  drawScreen(t, energy, sectionName) {
    const sc = this.cfg.screen;
    const g = this.screenCtx;
    const W = g.canvas.width, H = g.canvas.height;
    const beatPh = ((t / T.beat) % 1 + 1) % 1;
    const A = '#' + this.colorA.getHexString();
    const B = '#' + this.colorB.getHexString();
    g.textAlign = 'center';

    if (sc.style === 'led') {
      g.fillStyle = '#05050a';
      g.fillRect(0, 0, W, H);
      const grad = g.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, A);
      grad.addColorStop(1, B);
      g.globalAlpha = t < 0 ? 0.15 : 0.25 + (1 - beatPh) * 0.25 * energy;
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
      if (t >= 0) {
        const n = 48;
        for (let i = 0; i < n; i++) {
          const v = Math.abs(Math.sin(i * 0.7 + t * 3.1) * Math.cos(i * 0.31 - t * 2.3));
          const h = (0.15 + v * 0.7 * energy) * (0.6 + (1 - beatPh) * 0.4) * H * 0.55;
          g.fillStyle = i % 2 ? A : B;
          g.fillRect(i * (W / n) + 3, H - h, W / n - 6, h);
        }
      }
      g.fillStyle = '#ffffff';
      g.shadowColor = A;
      g.shadowBlur = 30;
      g.font = `bold ${Math.round(H * 0.24)}px "Arial Black", Impact, sans-serif`;
      g.fillText(sc.title, W / 2, H * 0.39);
      g.shadowBlur = 0;
      g.font = `bold ${Math.round(H * 0.09)}px Arial, sans-serif`;
      g.globalAlpha = 0.8;
      g.fillText(t < 0 ? sc.idle || 'LIVE IN CONCERT' : sectionName.toUpperCase(), W / 2, H * 0.53);
      g.globalAlpha = 1;
    } else if (sc.style === 'neon') {
      if (!this.velvetImg) this.velvetImg = velvetTexture('#4a0812', 1024, 64, 30).image;
      g.drawImage(this.velvetImg, 0, 0, W, H);
      const flicker = Math.random() < 0.015 ? 0.4 : 1;
      g.shadowColor = '#ff4fa3';
      g.shadowBlur = 40;
      g.fillStyle = `rgba(255,${150 + 60 * flicker},${210},${flicker})`;
      g.font = `italic bold ${Math.round(H * 0.22)}px Georgia, serif`;
      g.fillText(sc.title, W / 2, H * 0.42);
      g.shadowColor = '#4fc3ff';
      g.fillStyle = '#bfe9ff';
      g.font = `bold ${Math.round(H * 0.08)}px Arial, sans-serif`;
      g.fillText(t < 0 ? sc.idle || 'LIVE JAZZ NIGHTLY' : sectionName.toUpperCase(), W / 2, H * 0.6);
      g.shadowBlur = 0;
    } else if (sc.style === 'stars') {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#050820');
      grad.addColorStop(1, '#1b0b3a');
      g.fillStyle = grad;
      g.fillRect(0, 0, W, H);
      for (const s of this.stars) {
        g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + s.p));
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
      const moon = g.createRadialGradient(W * 0.82, H * 0.22, 5, W * 0.82, H * 0.22, H * 0.14);
      moon.addColorStop(0, '#fff8d0');
      moon.addColorStop(1, 'rgba(255,248,208,0)');
      g.fillStyle = moon;
      g.fillRect(0, 0, W, H);
      g.shadowColor = '#ffcc33';
      g.shadowBlur = 30;
      g.fillStyle = '#ffd34d';
      g.font = `bold ${Math.round(H * 0.15)}px Georgia, "Times New Roman", serif`;
      g.fillText(sc.title, W / 2, H * 0.32);
      g.shadowBlur = 0;
    }
    this.screenTex.needsUpdate = true;
  }

  buildCurtain() {
    const cu = this.cfg.curtain;
    const tex = velvetTexture('#8a0f22', 512, 256, 18);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide });
    this.curtainHalves = [-1, 1].map((side) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cu.w, cu.h), m);
      mesh.position.set(side * cu.w / 2, cu.h / 2, cu.z);
      this.scene.add(mesh);
      return { mesh, side };
    });
  }

  updateCurtain(bar) {
    const cu = this.cfg.curtain;
    const ramp = (b, [b0, b1]) => Math.max(0, Math.min(1, (b - b0) / (b1 - b0)));
    const open = ramp(bar, cu.open) * (1 - ramp(bar, cu.close));
    const s = 1 - open * 0.85;
    for (const h of this.curtainHalves) {
      h.mesh.scale.x = s;
      h.mesh.position.x = h.side * (cu.w - (cu.w * s) / 2);
    }
  }

  buildLasers() {
    const L = this.cfg.lasers;
    const geo = new THREE.CylinderGeometry(0.025, 0.025, 45, 6, 1, true);
    geo.translate(0, 22.5, 0);
    this.laserMat = new THREE.MeshBasicMaterial({ color: 0x22ff88, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.laserRigs = L.origins.map((o, oi) => {
      const g = new THREE.Group();
      g.position.set(...o);
      for (let i = 0; i < L.beams; i++) {
        const beam = new THREE.Mesh(geo, this.laserMat);
        beam.rotation.z = (i / (L.beams - 1) - 0.5) * 1.4;
        g.add(beam);
      }
      g.rotation.x = Math.PI / 2 - 0.1;
      this.scene.add(g);
      return { g, phase: oi * 1.7 };
    });
  }

  // ---------- crowd ----------
  buildCrowd() {
    const c = { type: 'standing', count: 420, x: 15, z: [5.4, 18.9], ...this.cfg.crowd };
    const people = [];
    const rnd = Math.random;
    if (c.type === 'standing') {
      while (people.length < c.count) {
        const x = (rnd() * 2 - 1) * c.x;
        const z = c.z[0] + rnd() * (c.z[1] - c.z[0]);
        if ((c.exclude || []).some((e) => x > e[0] && x < e[1] && z > e[2] && z < e[3])) continue;
        people.push({ x, z, y: 0, seated: false, rot: Math.PI + (rnd() - 0.5) * 0.6 });
      }
    } else if (c.type === 'rows') {
      this.seatList = [];
      for (let z = c.z[0], row = 0; z <= c.z[1]; z += c.rowGap, row++) {
        const lift = row * (c.rake || 0);
        for (let x = -c.x; x <= c.x; x += c.seatGap) {
          if (Math.abs(x) < c.aisle) continue;
          this.seatList.push({ x, z, y: lift });
          if (rnd() < (c.fill ?? 0.9)) people.push({ x, z, y: lift, seated: true, rot: Math.PI + (rnd() - 0.5) * 0.15 });
        }
      }
      if (c.rake) {
        const rows = Math.ceil((c.z[1] - c.z[0]) / c.rowGap) + 1;
        for (let r = 1; r < rows; r++) {
          const step = new THREE.Mesh(new THREE.BoxGeometry(c.x * 2 + 2, r * c.rake, c.rowGap), mat(0x2a1414));
          step.position.set(0, (r * c.rake) / 2, c.z[0] + r * c.rowGap);
          this.scene.add(step);
        }
      }
      const seatGeo = new THREE.BoxGeometry(c.seatGap * 0.85, 0.9, 0.55);
      seatGeo.translate(0, 0.45, 0.12);
      const seats = new THREE.InstancedMesh(seatGeo, mat(0x7a0d1c, { roughness: 0.8 }), this.seatList.length);
      const d = new THREE.Object3D();
      this.seatList.forEach((s, i) => {
        d.position.set(s.x, s.y, s.z);
        d.updateMatrix();
        seats.setMatrixAt(i, d.matrix);
      });
      this.scene.add(seats);
    } else if (c.type === 'tables') {
      const tables = [];
      for (let z = c.z[0]; z <= c.z[1]; z += c.tableGap) {
        for (let x = -c.x; x <= c.x; x += c.tableGap * 1.1) {
          const tx = x + (rnd() - 0.5) * 0.8;
          const tz = z + (rnd() - 0.5) * 0.6;
          if (Math.abs(tx) < (c.aisle || 0)) continue;
          tables.push({ x: tx, z: tz });
          for (const a of [-0.9, 0, 0.9]) {
            if (rnd() < 0.85) {
              const px = tx + Math.sin(a) * 0.75;
              const pz = tz + Math.cos(a) * 0.75;
              people.push({ x: px, z: pz, y: 0, seated: true, rot: Math.PI + a * 0.3 });
            }
          }
        }
      }
      const topGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.05, 20);
      topGeo.translate(0, 0.75, 0);
      const stemGeo = new THREE.CylinderGeometry(0.05, 0.25, 0.75, 8);
      stemGeo.translate(0, 0.37, 0);
      const candleGeo = new THREE.SphereGeometry(0.06, 8, 6);
      candleGeo.translate(0, 0.84, 0);
      const tops = new THREE.InstancedMesh(topGeo, mat(0x2b1a12, { roughness: 0.5 }), tables.length);
      const stems = new THREE.InstancedMesh(stemGeo, mat(0x111111), tables.length);
      this.candles = new THREE.InstancedMesh(candleGeo, new THREE.MeshBasicMaterial({ color: 0xffb347 }), tables.length);
      const d = new THREE.Object3D();
      tables.forEach((tb, i) => {
        d.position.set(tb.x, 0, tb.z);
        d.updateMatrix();
        tops.setMatrixAt(i, d.matrix);
        stems.setMatrixAt(i, d.matrix);
        this.candles.setMatrixAt(i, d.matrix);
      });
      this.scene.add(tops, stems, this.candles);
    }

    const n = people.length;
    const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.75, 3, 8);
    bodyGeo.translate(0, 0.6, 0);
    const headGeo = new THREE.SphereGeometry(0.13, 8, 6);
    const armGeo = new THREE.CapsuleGeometry(0.05, 0.45, 3, 6);
    armGeo.translate(0, 0.27, 0);
    this.crowdBodies = new THREE.InstancedMesh(bodyGeo, mat(0xffffff), n);
    this.crowdHeads = new THREE.InstancedMesh(headGeo, mat(0xd2a07c), n);
    this.crowdArms = new THREE.InstancedMesh(armGeo, mat(0xd2a07c), n * 2);
    const shirts = c.shirts || [0x1f2937, 0x374151, 0x7f1d1d, 0x1e3a8a, 0x14532d, 0x4c1d95, 0x111111, 0x6b7280, 0x9a3412, 0xbe185d];
    const skin = [0xf1c27d, 0xe0ac8a, 0xc68642, 0x8d5524, 0xffdbac];
    const col = new THREE.Color();
    people.forEach((p, i) => {
      p.h = 0.9 + rnd() * 0.2;
      p.ph = rnd() * Math.PI * 2;
      p.jumpy = rnd();
      this.crowdBodies.setColorAt(i, col.setHex(shirts[i % shirts.length]));
      const sk = skin[(i * 7) % skin.length];
      this.crowdHeads.setColorAt(i, col.setHex(sk));
      this.crowdArms.setColorAt(i * 2, col.setHex(sk));
      this.crowdArms.setColorAt(i * 2 + 1, col.setHex(sk));
    });
    this.crowd = people;
    this.scene.add(this.crowdBodies, this.crowdHeads, this.crowdArms);
    this.dummy = new THREE.Object3D();

    // Fixed sample of heads used to judge "crowd shots".
    // Spread evenly over the crowd area (4x4 grid) so no side is favoured.
    this.crowdSamples = [];
    if (n) {
      const xs = people.map((p) => p.x);
      const zs = people.map((p) => p.z);
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const z0 = Math.min(...zs), z1 = Math.max(...zs);
      const picked = new Set();
      for (let gx = 0; gx < 4; gx++) {
        for (let gz = 0; gz < 4; gz++) {
          const cx = x0 + ((gx + 0.5) / 4) * (x1 - x0);
          const cz = z0 + ((gz + 0.5) / 4) * (z1 - z0);
          let best = null, bestD = Infinity;
          for (const p of people) {
            const d = (p.x - cx) ** 2 + (p.z - cz) ** 2;
            if (d < bestD && !picked.has(p)) { bestD = d; best = p; }
          }
          if (!best) continue;
          picked.add(best);
          const headY = best.y + (best.seated ? 1.25 : 1.4 * best.h);
          this.crowdSamples.push({ head: new THREE.Vector3(best.x, headY, best.z), feet: new THREE.Vector3(best.x, best.y, best.z) });
        }
      }
    }
    this.crowdCenter = new THREE.Vector3();
    for (const s of this.crowdSamples) this.crowdCenter.add(s.head);
    this.crowdCenter.divideScalar(Math.max(1, this.crowdSamples.length));
  }

  updateCrowd(t, energy, applause) {
    const beatPh = ((t / T.beat) % 1 + 1) % 1;
    const d = this.dummy;
    const zero = 0.0001;
    this.crowd.forEach((p, i) => {
      const seated = p.seated;
      const jump = !seated && p.jumpy < energy * 0.7 ? Math.abs(Math.sin((beatPh + p.ph * 0.05) * Math.PI)) * 0.25 * energy : 0;
      const sway = Math.sin(t * 1.5 + p.ph) * (seated ? 0.02 : 0.06);
      const by = p.y + jump + (seated ? 0.3 : 0);
      const sy = seated ? p.h * 0.72 : p.h;
      d.position.set(p.x + sway, by, p.z);
      d.rotation.set(0, p.rot, sway);
      d.scale.set(1, sy, 1);
      d.updateMatrix();
      this.crowdBodies.setMatrixAt(i, d.matrix);
      const headY = by + 1.38 * sy;
      d.position.set(p.x + sway * 1.5, headY, p.z);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.crowdHeads.setMatrixAt(i, d.matrix);

      const raise = applause ? p.jumpy < 0.8 : energy >= 1 ? p.jumpy < 0.55 : p.jumpy < 0.04;
      for (const s of [-1, 1]) {
        if (raise) {
          const wave = applause && seated ? Math.sin(t * 14 + p.ph) * 0.15 : Math.sin(t * 4 + p.ph) * 0.15;
          d.position.set(p.x + sway + s * 0.2, headY - 0.3, p.z);
          d.rotation.set(0, p.rot, s * (0.25 + wave));
          d.scale.set(1, 1, 1);
        } else {
          d.scale.set(zero, zero, zero);
        }
        d.updateMatrix();
        this.crowdArms.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), d.matrix);
      }
    });
    this.crowdBodies.instanceMatrix.needsUpdate = true;
    this.crowdHeads.instanceMatrix.needsUpdate = true;
    this.crowdArms.instanceMatrix.needsUpdate = true;
  }

  // ---------- particles ----------
  buildParticles() {
    const glow = glowTexture();
    const make = (n, size, map, blending = THREE.AdditiveBlending, alpha = false) => {
      const geo = new THREE.BufferGeometry();
      const cs = alpha ? 4 : 3;
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * cs), cs));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, map, vertexColors: true, transparent: true, blending, depthWrite: false }));
      pts.frustumCulled = false;
      this.scene.add(pts);
      const parts = Array.from({ length: n }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color() }));
      return { pts, parts, geo, next: 0, alpha, size };
    };
    this.sparks = make(1200, 0.35, glow);
    // Normal blending with per-particle alpha: additive smoke piles up into a white blob.
    this.smoke = make(500, 1.6, glow, THREE.NormalBlending, true);
    this.confetti = make(900, 0.12, null, THREE.NormalBlending);
  }

  emit(kind, x, y, z, n) {
    const sys = kind === 'co2' || kind === 'smoke' ? this.smoke : this.sparks;
    for (let k = 0; k < n; k++) {
      const part = sys.parts[sys.next];
      sys.next = (sys.next + 1) % sys.parts.length;
      part.p.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
      if (kind === 'smoke') {
        part.life = part.max = 1.2 + Math.random() * 0.8;
        part.v.set((Math.random() - 0.5) * 2.5, Math.random() * 2, (Math.random() - 0.5) * 2.5);
        part.c.setRGB(0.75, 0.72, 0.85);
      } else if (kind === 'co2') {
        part.life = part.max = 1.0 + Math.random() * 0.5;
        part.v.set((Math.random() - 0.5) * 1.2, 9 + Math.random() * 4, (Math.random() - 0.5) * 1.2);
        part.c.setRGB(0.55, 0.6, 0.65);
      } else if (kind === 'sparkle') {
        part.life = part.max = 0.8 + Math.random() * 0.6;
        part.v.set((Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3);
        part.c.copy(SPARK_COLORS.gold());
      } else {
        part.life = part.max = 1 + Math.random() * 0.6;
        part.v.set((Math.random() - 0.5) * 1.5, 7 + Math.random() * 4, (Math.random() - 0.5) * 1.5);
        part.c.copy((SPARK_COLORS[kind] || SPARK_COLORS.fire)());
      }
      part.kind = kind;
    }
  }

  // Point sizes are in canvas pixels, so small viewports need smaller points.
  setPointScale(k) {
    for (const sys of [this.sparks, this.smoke, this.confetti]) sys.pts.material.size = sys.size * k;
  }

  puff(x, y, z, n = 120) {
    this.emit('smoke', x, y, z, n);
    this.emit('sparkle', x, y + 0.5, z, 60);
  }

  emitConfetti(n) {
    const C = this.confetti;
    const s = this.cfg.stage;
    for (let k = 0; k < n; k++) {
      const part = C.parts[C.next];
      C.next = (C.next + 1) % C.parts.length;
      part.life = part.max = 6;
      part.p.set((Math.random() - 0.5) * s.w, 9 + Math.random() * 3, s.front - 4 + Math.random() * 16);
      part.v.set((Math.random() - 0.5) * 0.5, -1 - Math.random(), (Math.random() - 0.5) * 0.5);
      part.c.setHSL(Math.random(), 0.9, 0.6);
    }
  }

  stepParticles(sys, dt, fade, swirl) {
    const pos = sys.geo.attributes.position.array;
    const col = sys.geo.attributes.color.array;
    sys.parts.forEach((part, i) => {
      if (part.life > 0) {
        part.life -= dt;
        const g = part.kind === 'smoke' || part.kind === 'sparkle' ? -0.5 : part.kind === 'co2' ? -6 : swirl ? 0 : -9;
        part.v.y += g * dt;
        if (part.kind === 'smoke') part.v.multiplyScalar(1 - dt * 1.5);
        if (swirl) part.v.x += Math.sin(part.life * 3 + i) * dt * 0.8;
        part.p.addScaledVector(part.v, dt);
      }
      const alive = part.life > 0 ? 1 : 0;
      pos[i * 3] = part.p.x;
      pos[i * 3 + 1] = alive ? part.p.y : -100;
      pos[i * 3 + 2] = part.p.z;
      const k = fade ? Math.min(1, part.life / Math.min(1, part.max)) * alive : alive;
      if (sys.alpha) {
        col[i * 4] = part.c.r;
        col[i * 4 + 1] = part.c.g;
        col[i * 4 + 2] = part.c.b;
        col[i * 4 + 3] = k * 0.35;
      } else {
        col[i * 3] = part.c.r * k;
        col[i * 3 + 1] = part.c.g * k;
        col[i * 3 + 2] = part.c.b * k;
      }
    });
    sys.geo.attributes.position.needsUpdate = true;
    sys.geo.attributes.color.needsUpdate = true;
  }

  // ---------- per frame ----------
  update(t, dt, focusPos) {
    const cfg = this.cfg;
    const bar = t / T.bar;
    const sec = sectionAt(Math.max(0, bar));
    const live = t >= 0;
    const energy = live && sec ? sec.energy : 0.15;
    const beatPh = ((t / T.beat) % 1 + 1) % 1;
    const name = live && sec ? sec.name : '';
    const pal = cfg.palettes[name] || cfg.palettes.default;
    this.colorA.lerp(new THREE.Color(pal[0]), Math.min(1, dt * 3));
    this.colorB.lerp(new THREE.Color(pal[1]), Math.min(1, dt * 3));
    const ending = bar >= T.show.sections[T.show.sections.length - 1].start;

    const houseBase = cfg.house ?? 0.6;
    this.houseLight.intensity = live ? Math.max(cfg.houseDuringShow ?? 0, houseBase - t * 0.3) : houseBase;
    if (bar > T.length / T.bar + 0.5) this.houseLight.intensity = houseBase;
    this.hemi.intensity = (cfg.hemi ?? 0.25) + energy * 0.1;

    const strobe = cfg.strobe && cfg.strobe.includes(name) && beatPh < 0.08 ? 1.6 : 1;
    const mv = cfg.movers;
    this.movers.forEach((m, i) => {
      const speed = (0.4 + energy * 0.6) * (mv.speed ?? 1);
      const sweep = Math.sin(t * speed + m.phase);
      m.pivot.rotation.z = sweep * (mv.sweep ?? 0.45);
      m.pivot.rotation.x = (m.side ? -0.25 : 0.25) + Math.cos(t * speed * 0.7 + m.phase) * 0.15;
      const col = i % 2 ? this.colorA : this.colorB;
      const pulse = 0.6 + (1 - beatPh) * 0.4 * energy;
      m.beam.material.color.copy(col);
      m.beam.material.opacity = live ? (mv.beam ?? 0.06) * pulse * strobe : 0;
      m.spot.color.copy(col);
      m.spot.intensity = live ? 70 * pulse * strobe : 0;
    });

    if (focusPos) this.followTarget.lerp(focusPos, Math.min(1, dt * 4));
    this.follow.target.position.copy(this.followTarget);
    this.follow.intensity = live ? (cfg.follow?.intensity ?? 450) : 0;
    const w = { base: 60, energy: 40, ...cfg.wash };
    this.wash.intensity = live ? w.base + energy * w.energy : w.base * 0.25;
    this.wash.color.copy(this.colorA).lerp(new THREE.Color(0xffffff), w.white ?? 0.6);
    for (const s of this.spots) s.light.intensity = live ? s.base * (0.7 + energy * 0.3) : s.base * 0.2;

    for (const s of this.strips) {
      s.mesh.material.color.copy(s.which ? this.colorB : this.colorA).multiplyScalar(live ? 0.6 + (1 - beatPh) * 0.6 : 0.3);
    }
    if (this.footBulbs) this.footBulbs.color.setScalar(live ? 1 : 0.4).multiply(new THREE.Color(0xffd9a0));
    if (this.candles) this.candles.material.color.setRGB(1, 0.65 + Math.sin(t * 9) * 0.05, 0.25);

    if (this.screenCtx) this.drawScreen(t, energy, name);
    if (this.curtainHalves) this.updateCurtain(bar);

    if (this.laserRigs) {
      const on = live && cfg.lasers.sections.includes(name);
      this.laserMat.opacity = on ? 0.35 + (1 - beatPh) * 0.3 : 0;
      this.laserMat.color.copy(this.colorB).lerp(new THREE.Color(0x22ff88), 0.4);
      for (const L of this.laserRigs) {
        L.g.rotation.y = Math.sin(t * 0.9 + L.phase) * 0.6;
        L.g.rotation.x = Math.PI / 2 - 0.15 + Math.sin(t * 1.3 + L.phase) * 0.12;
      }
    }

    const applause = live && (ending || T.show.moments.some((m) => bar >= m.bar && bar < m.bar + m.dur + 1.5));
    this.updateCrowd(t, energy, applause);

    for (const p of cfg.pyro || []) {
      const key = `p${p.bar}`;
      if (live && bar >= p.bar && bar < p.bar + 0.5 && !this.fired.has(key)) {
        this.fired.add(key);
        for (const x of p.xs) this.emit(p.kind || 'fire', x, cfg.stage.h + 0.05, p.z ?? cfg.stage.front - 0.4, p.n || 90);
      }
    }
    if (cfg.confetti && live && bar >= cfg.confetti[0] && bar < cfg.confetti[1]) this.emitConfetti(Math.ceil(dt * 120));

    this.stepParticles(this.sparks, dt, true, false);
    this.stepParticles(this.smoke, dt, true, false);
    this.stepParticles(this.confetti, dt, false, true);
  }
}
