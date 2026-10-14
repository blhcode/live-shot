import * as THREE from 'three';
import { T, MOMENT_POINTS, activeMoment, sectionAt } from './show.js';

const v = new THREE.Vector3();

function project(p, cam) {
  v.copy(p).project(cam);
  const inFront = v.z < 1;
  return { x: v.x, y: v.y, in: inFront && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1, front: inFront };
}

// On-screen length between two projected points, as a fraction of frame height.
function span(a, b, cam) {
  return Math.hypot((a.x - b.x) * cam.aspect, a.y - b.y) / 2;
}

// Returns 0..1 for how well `cam` frames one person.
export function framePerson(cam, pts) {
  const head = project(pts.head, cam);
  const chest = project(pts.chest, cam);
  const hips = project(pts.hips, cam);
  const feet = project(pts.feet, cam);
  if (!head.front || !chest.front) return { q: 0, note: 'Not in shot' };
  const visible = (head.in ? 0.5 : 0) + (chest.in ? 0.3 : 0) + (hips.in ? 0.2 : 0);
  if (visible === 0) return { q: 0, note: 'Not in shot' };
  const h = span(head, feet, cam);
  let size;
  if (h < 0.1) size = 0.15;
  else if (h < 0.3) size = 0.15 + ((h - 0.1) / 0.2) * 0.85;
  else if (h <= 1.9) size = 1;
  else size = Math.max(0.35, 1 - (h - 1.9) / 2.5);
  const d = Math.hypot(chest.x, (chest.y + head.y) / 2);
  const center = 1 - Math.min(1, Math.max(0, (d - 0.45) / 0.6)) * 0.45;
  const headroom = head.in && head.y > 0.93 ? 0.85 : 1;
  const q = visible * size * center * headroom;
  let note = 'Good shot';
  if (!head.in) note = 'Head cut off';
  else if (h < 0.1) note = 'Too far – zoom in';
  else if (h < 0.3) note = 'A bit small';
  else if (h > 1.9) note = 'Too tight';
  else if (center < 0.8) note = 'Off-centre';
  else if (headroom < 1) note = 'Head too high';
  return { q, note };
}

export function frameWide(cam, cast) {
  const ids = cast.ids;
  let inCount = 0;
  let sizeSum = 0;
  for (const id of ids) {
    if (cast.members[id].root.visible === false) continue;
    const pts = cast.focusPoints(id);
    const head = project(pts.head, cam);
    const chest = project(pts.chest, cam);
    if (head.in && chest.in) {
      inCount++;
      sizeSum += span(head, project(pts.feet, cam), cam);
    }
  }
  const total = ids.length;
  if (inCount === 0) return { q: 0, note: 'Nobody in shot' };
  const avg = sizeSum / inCount;
  const tooTight = total <= 2 ? 0.9 : 0.6;
  let q = inCount / total;
  if (inCount < total * 0.7) q *= 0.5;
  if (avg < 0.06) q *= 0.5;
  if (avg > tooTight) q *= 0.6;
  let note = inCount === total ? 'Everyone in – nice' : `${inCount}/${total} in shot`;
  if (avg < 0.06) note = 'Too far – zoom in a bit';
  if (avg > tooTight) note = 'Too tight for a wide';
  return { q, note };
}

export function frameCrowd(cam, venue) {
  let inCount = 0;
  let sizeSum = 0;
  for (const s of venue.crowdSamples) {
    const head = project(s.head, cam);
    if (head.in) {
      inCount++;
      sizeSum += span(head, project(s.feet, cam), cam);
    }
  }
  if (inCount === 0) return { q: 0, note: 'Point a camera at the crowd' };
  const avg = sizeSum / inCount;
  let q = Math.min(1, inCount / 5);
  let note = q >= 1 ? 'Great crowd shot' : 'Get more of the crowd in';
  if (avg < 0.05) { q *= 0.6; note = 'Crowd too far away'; }
  return { q, note };
}

export function evaluate(cam, focus, cast, venue) {
  if (!focus) return { q: 0, note: '' };
  if (focus === 'wide') return frameWide(cam, cast);
  if (focus === 'crowd') return frameCrowd(cam, venue);
  if (cast.members[focus].root.visible === false) return { q: 0, note: 'Hidden' };
  return framePerson(cam, cast.focusPoints(focus));
}

export class Scorer {
  constructor() {
    const moments = T.show.moments;
    this.score = 0;
    this.events = [];
    this.lastCutTime = null;
    this.liveId = null;
    this.shots = [];
    this.moments = Object.fromEntries(moments.map((m) => [m.id, { best: 0, done: false, hit: false }]));
    this.recordedTime = 0;
    this.goodTime = 0;
    this.jumpCuts = 0;
    this.greatCuts = 0;
    this.lastSection = null;
    this.sectionChangedAt = -99;
    this.stale = false;
  }

  popup(text, kind = 'good') {
    this.events.push({ text, kind });
  }

  onCut(t, newId) {
    if (t < 0) { this.liveId = newId; this.lastCutTime = 0; return; }
    if (this.liveId === newId) return;
    if (this.lastCutTime !== null) {
      const len = t - this.lastCutTime;
      this.shots.push(len);
      if (len < 1.2) {
        this.jumpCuts++;
        this.score -= 25;
        this.popup('Jump cut! −25', 'bad');
      }
    }
    this.liveId = newId;
    this.lastCutTime = t;
    this.pendingCutCheck = { t, sinceSection: t - this.sectionChangedAt };
  }

  // liveQ: framing quality of the program camera for the director's focus.
  update(t, dt, liveQ, momentQ, recording) {
    if (t < 0 || t > T.length) return;
    const bar = t / T.bar;
    const sec = sectionAt(bar);
    if (sec && sec !== this.lastSection) {
      this.lastSection = sec;
      this.sectionChangedAt = t;
    }
    if (this.lastCutTime === null) this.lastCutTime = 0;

    if (recording) this.recordedTime += dt;
    const shotAge = t - this.lastCutTime;
    let variety = 1;
    if (shotAge > 12) variety = Math.max(0.4, 1 - (shotAge - 12) / 12);
    this.stale = shotAge > 14;

    if (recording) {
      this.score += liveQ * 10 * variety * dt;
      if (liveQ > 0.6) this.goodTime += dt;
    }

    if (this.pendingCutCheck && t - this.pendingCutCheck.t > 0.6) {
      if (this.pendingCutCheck.sinceSection < 2.5 && liveQ > 0.65 && recording) {
        this.greatCuts++;
        this.score += 50;
        this.popup('Great cut on the change! +50', 'good');
      }
      this.pendingCutCheck = null;
    }

    const am = activeMoment(bar);
    for (const m of T.show.moments) {
      const st = this.moments[m.id];
      if (st.done) continue;
      if (am === m && recording) st.best = Math.max(st.best, momentQ[m.id] ?? 0);
      if (bar >= m.bar + m.dur) {
        st.done = true;
        if (st.best >= 0.55) {
          st.hit = true;
          this.score += MOMENT_POINTS;
          this.popup(`NAILED IT: ${m.label}! +${MOMENT_POINTS}`, 'great');
        } else {
          this.popup(`Missed: ${m.label}`, 'bad');
        }
      }
    }
  }

  finish(t) {
    const moments = T.show.moments;
    if (this.lastCutTime !== null) this.shots.push(Math.max(0, Math.min(t, T.length) - this.lastCutTime));
    const max = T.length * 10 + moments.length * MOMENT_POINTS;
    const pct = Math.max(0, this.score) / max;
    const grade = pct >= 0.8 ? 'S' : pct >= 0.65 ? 'A' : pct >= 0.5 ? 'B' : pct >= 0.35 ? 'C' : pct >= 0.2 ? 'D' : 'F';
    const avgShot = this.shots.length ? this.shots.reduce((a, b) => a + b, 0) / this.shots.length : 0;
    return {
      score: Math.round(this.score),
      grade,
      pct,
      recordedPct: Math.min(1, this.recordedTime / T.length),
      goodPct: Math.min(1, this.goodTime / T.length),
      cuts: Math.max(0, this.shots.length - 1),
      avgShot,
      jumpCuts: this.jumpCuts,
      greatCuts: this.greatCuts,
      moments: moments.map((m) => ({ label: m.label, hit: this.moments[m.id].hit })),
    };
  }
}
