import * as THREE from 'three';
import { Venue } from './stage.js';
import { CameraRig, fovToMm } from './cameras.js';
import { Music } from './music.js';
import { Recorder } from './recorder.js';
import { Scorer, evaluate } from './scoring.js';
import { SHOWS, getShow } from './shows/index.js';
import {
  T, STANDBY_SECONDS, setShow, subjectName,
  activeMoment, formatTime, nextSection, sectionAt, upcomingMoment,
} from './show.js';

const $ = (id) => document.getElementById(id);

// ---------- renderer ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.setScissorTest(true);

const programCanvas = $('program');
const pctx = programCanvas.getContext('2d');

// ---------- world (rebuilt whenever a show is loaded) ----------
let show = null;
let scene = null;
let venue = null;
let cast = null;
let rigs = [];

function disposeScene(s) {
  s.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material.map) o.material.map.dispose();
  });
}

function loadShow(id) {
  if (scene) disposeScene(scene);
  show = getShow(id);
  setShow(show);
  scene = new THREE.Scene();
  venue = new Venue(scene, show.venue);
  cast = show.createCast(scene, venue);
  rigs = show.rigs.map((d) => new CameraRig(d, scene));
  document.documentElement.style.setProperty('--accent', show.accent);
}

// ---------- game state ----------
let state = 'menu';
let mode = localStorage.getItem('liveshot-mode') || 'simple';
let selectedShow = localStorage.getItem('liveshot-show') || SHOWS[0].id;
let opIdx = 1;
let liveIdx = 1;
let music = null;
let recorder = null;
let scorer = null;
let paused = false;
let guides = true;
let lastFrame = performance.now();
let L = null;
const quality = [0, 0, 0];
const notes = ['', '', ''];

document.querySelector(`input[name=mode][value=${mode}]`).checked = true;

// ---------- menu: show picker ----------
function bestFor(id) {
  try { return JSON.parse(localStorage.getItem(`liveshot-best-${id}`)); } catch { return null; }
}

function buildShowList() {
  const list = $('showList');
  list.innerHTML = '';
  for (const s of SHOWS) {
    const best = bestFor(s.id);
    const len = formatTime(s.sections[s.sections.length - 1].end * (240 / s.bpm));
    const card = document.createElement('button');
    card.className = `show-card${s.id === selectedShow ? ' selected' : ''}`;
    card.style.setProperty('--c', s.accent);
    card.innerHTML = `
      <span class="sc-kind">${s.kind}</span>
      <b>${s.card}</b>
      <span class="sc-blurb">${s.blurb}</span>
      <span class="sc-meta">${len} · ${s.moments.length} big moments${best ? ` · best <em>${best.grade}</em> ${best.score.toLocaleString()}` : ''}</span>`;
    card.addEventListener('click', () => selectShow(s.id));
    list.appendChild(card);
  }
  const s = getShow(selectedShow);
  $('camList').innerHTML = s.rigs.map((r) => `<div><b>CAM ${r.id} · ${r.name}</b></div>`).join('');
}

function selectShow(id) {
  selectedShow = id;
  localStorage.setItem('liveshot-show', id);
  loadShow(id);
  buildShowList();
}

// ---------- input ----------
const keys = new Set();
let mouseDX = 0, mouseDY = 0, wheel = 0;

addEventListener('keydown', (e) => {
  if (e.repeat && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
    keys.add(e.code);
    return;
  }
  keys.add(e.code);
  if (state !== 'show') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyP') return togglePause();
  if (paused) return;
  if (e.code === 'Digit1' || e.code === 'Numpad1') selectCam(0);
  if (e.code === 'Digit2' || e.code === 'Numpad2') selectCam(1);
  if (e.code === 'Digit3' || e.code === 'Numpad3') selectCam(2);
  if (e.code === 'Space' || e.code === 'Enter') take();
  if (e.code === 'KeyR') toggleRecord();
  if (e.code === 'KeyH' || e.code === 'Tab') $('help').classList.toggle('hidden');
  if (e.code === 'KeyG') { guides = !guides; document.querySelector('.thirds').classList.toggle('off', !guides); }
  if (e.code === 'KeyC') rigs[opIdx].resetHome();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

canvas.addEventListener('click', () => {
  if (state === 'show' && !paused && document.pointerLockElement !== canvas) canvas.requestPointerLock();
});
addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    mouseDX += e.movementX;
    mouseDY += e.movementY;
  }
});
addEventListener('wheel', (e) => {
  if (state === 'show') {
    wheel += e.deltaY;
    e.preventDefault();
  }
}, { passive: false });

document.querySelectorAll('.mon[data-i]').forEach((el) => {
  el.addEventListener('click', () => state === 'show' && selectCam(Number(el.dataset.i)));
});

function selectCam(i) {
  opIdx = i;
  if (mode === 'simple') take();
}

function take() {
  if (liveIdx === opIdx) return;
  liveIdx = opIdx;
  scorer.onCut(music ? music.time : -1, liveIdx);
}

function toggleRecord() {
  if (!recorder) return;
  if (recorder.active) recorder.pause();
  else if (!recorder.start()) scorer.popup('Recording not supported in this browser', 'bad');
}

function togglePause() {
  paused = !paused;
  $('paused').classList.toggle('hidden', !paused);
  if (paused) {
    music.pause();
    if (recorder.active) { recorder.pause(); recorder.resumeAfterPause = true; }
    document.exitPointerLock();
  } else {
    music.resume();
    if (recorder.resumeAfterPause) { recorder.start(); recorder.resumeAfterPause = false; }
  }
}

// ---------- flow ----------
$('startBtn').addEventListener('click', startShow);
$('againBtn').addEventListener('click', () => location.reload());

function startShow() {
  mode = document.querySelector('input[name=mode]:checked').value;
  localStorage.setItem('liveshot-mode', mode);
  document.body.classList.toggle('director', mode === 'director');
  $('modeLabel').textContent = `${show.card.toUpperCase()} · ${mode === 'director' ? 'DIRECTOR' : 'OPERATOR'}`;
  $('menu').classList.add('hidden');
  $('hud').classList.remove('hidden');
  loadShow(selectedShow);
  music = new Music(show);
  music.begin();
  recorder = new Recorder(programCanvas, music.recordDest.stream);
  scorer = new Scorer();
  opIdx = liveIdx = 1;
  scorer.onCut(-1, liveIdx);
  state = 'show';
  canvas.requestPointerLock();
}

async function endShow() {
  state = 'results';
  document.exitPointerLock();
  const res = scorer.finish(music.time);
  music.stop();
  const blob = await recorder.finish();
  $('hud').classList.add('hidden');
  $('results').classList.remove('hidden');
  $('resShow').textContent = show.card;
  $('resGrade').textContent = res.grade;
  $('resScore').textContent = res.score.toLocaleString();
  const prev = bestFor(show.id);
  if (!prev || res.score > prev.score) {
    localStorage.setItem(`liveshot-best-${show.id}`, JSON.stringify({ score: res.score, grade: res.grade }));
    if (prev) $('resBest').textContent = `New best! (was ${prev.score.toLocaleString()})`;
  } else {
    $('resBest').textContent = `Best: ${prev.grade} · ${prev.score.toLocaleString()}`;
  }
  const pct = (x) => `${Math.round(x * 100)}%`;
  $('resStats').innerHTML = [
    `Show recorded: <b>${pct(res.recordedPct)}</b>`,
    `Time with a good shot on air: <b>${pct(res.goodPct)}</b>`,
    `Cuts: <b>${res.cuts}</b> · average shot <b>${res.avgShot.toFixed(1)}s</b>`,
    `Great cuts on section changes: <b>${res.greatCuts}</b>`,
    `Jump cuts (too fast): <b>${res.jumpCuts}</b>`,
  ].map((s) => `<li>${s}</li>`).join('');
  $('resMoments').innerHTML = res.moments
    .map((m) => `<li class="${m.hit ? 'hit' : 'miss'}">${m.hit ? '✔' : '✘'} ${m.label}</li>`).join('');
  if (blob && blob.size > 0) {
    const url = URL.createObjectURL(blob);
    const video = $('resVideo');
    // MediaRecorder WebM has no duration header; seeking far forces the browser to compute it.
    video.addEventListener('loadedmetadata', () => {
      if (video.duration === Infinity) {
        video.currentTime = 1e9;
        video.addEventListener('timeupdate', () => { video.currentTime = 0; }, { once: true });
      }
    }, { once: true });
    video.src = url;
    $('resDownload').href = url;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    $('resDownload').download = `live-shot-${show.id}-${stamp}.webm`;
  } else {
    $('resVideo').classList.add('hidden');
    $('resDownload').classList.add('hidden');
    $('noTape').classList.remove('hidden');
  }
}

// ---------- layout ----------
function layout() {
  const W = innerWidth, H = innerHeight;
  const top = 46, m = 12, gap = 14;
  const monW = Math.min((W - m * 2 - gap * 3) / 4, 320);
  const monH = (monW * 9) / 16;
  const stripH = monH + m * 2 + 18;
  const availW = W - m * 2;
  const availH = H - top - stripH - m;
  let mw = availW, mh = (mw * 9) / 16;
  if (mh > availH) { mh = availH; mw = (mh * 16) / 9; }
  const main = { x: Math.round((W - mw) / 2), y: top + m, w: Math.round(mw), h: Math.round(mh) };
  const total = monW * 4 + gap * 3;
  const sx = (W - total) / 2;
  const my = H - m - monH;
  const mons = [0, 1, 2, 3].map((i) => ({ x: Math.round(sx + i * (monW + gap)), y: Math.round(my), w: Math.round(monW), h: Math.round(monH) }));
  const place = (el, r, inset = 3) => Object.assign(el.style, {
    left: `${r.x - inset}px`, top: `${r.y - inset}px`, width: `${r.w + inset * 2}px`, height: `${r.h + inset * 2}px`,
  });
  place($('mainFrame'), main);
  document.querySelectorAll('.mon').forEach((el, i) => place(el, mons[i]));
  renderer.setSize(W, H, false);
  return { W, H, main, mons };
}
L = layout();
addEventListener('resize', () => { L = layout(); });

// ---------- rendering ----------
function renderView(rig, r) {
  for (const x of rigs) x.model.visible = x !== rig;
  const y = L.H - r.y - r.h;
  renderer.setViewport(r.x, y, r.w, r.h);
  renderer.setScissor(r.x, y, r.w, r.h);
  venue.setPointScale(r.h / L.main.h);
  renderer.render(scene, rig.cam);
}

function drawProgram(t) {
  const pr = renderer.getPixelRatio();
  const r = L.main;
  pctx.drawImage(canvas, r.x * pr, r.y * pr, r.w * pr, r.h * pr, 0, 0, 1280, 720);
  if (t >= 0) {
    pctx.font = 'bold 22px Arial';
    pctx.fillStyle = 'rgba(0,0,0,0.5)';
    pctx.fillRect(1100, 26, 150, 36);
    pctx.fillStyle = '#ff2020';
    pctx.beginPath();
    pctx.arc(1122, 44, 8, 0, Math.PI * 2);
    pctx.fill();
    pctx.fillStyle = '#fff';
    pctx.fillText('LIVE', 1140, 52);
  }
  if (t > 3 && t < 12) {
    pctx.globalAlpha = Math.min(1, (t - 3) * 2, (12 - t) * 2);
    const g = pctx.createLinearGradient(60, 0, 700, 0);
    g.addColorStop(0, show.accent);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    pctx.fillStyle = g;
    pctx.fillRect(60, 590, 640, 64);
    pctx.fillStyle = '#fff';
    pctx.font = 'bold 34px Arial Black, Arial';
    pctx.fillText(show.title.toUpperCase(), 80, 632);
    pctx.fillStyle = 'rgba(0,0,0,0.6)';
    pctx.fillRect(60, 654, 470, 30);
    pctx.fillStyle = '#ddd';
    pctx.font = '18px Arial';
    pctx.fillText(show.lowerThird, 76, 675);
    pctx.globalAlpha = 1;
  }
}

// ---------- HUD ----------
const ui = {
  section: $('section'), clock: $('clock'), score: $('score'), rec: $('rec'), recTime: $('recTime'),
  frame: $('mainFrame'), tally: $('tallyLabel'), lens: $('lensInfo'), cueNow: $('cueNow'), cueNext: $('cueNext'),
  fbar: document.querySelector('#framing .bar i'), fnote: document.querySelector('#framing em'),
  warn: $('warn'), popups: $('popups'), lockHint: $('lockHint'),
  mons: [...document.querySelectorAll('.mon[data-i]')],
};
let recSeconds = 0;

const qColor = (q) => (q > 0.65 ? '#2ecc71' : q > 0.35 ? '#f1c40f' : '#e74c3c');

function updateHud(t, focus) {
  const bar = t / T.bar;
  const sec = t >= 0 ? sectionAt(bar) : null;
  ui.section.textContent = t < 0 ? 'STANDBY' : sec ? sec.name.toUpperCase() : 'END';
  ui.clock.textContent = t < 0 ? `Show starts in ${Math.ceil(-t)}s` : `${formatTime(t)} / ${formatTime(T.length)}`;
  ui.score.textContent = Math.round(scorer.score).toLocaleString();
  const recOn = recorder && recorder.active;
  ui.rec.className = `rec ${recOn ? 'on' : 'off'}`;
  ui.recTime.textContent = recOn || recSeconds > 0 ? formatTime(recSeconds) : 'press R to record';

  const op = rigs[opIdx];
  const isLive = opIdx === liveIdx;
  ui.frame.className = isLive ? 'live' : 'preview';
  ui.tally.textContent = `CAM ${op.id} · ${op.name} — ${isLive ? 'LIVE' : 'PREVIEW'}`;
  ui.lens.innerHTML = `${fovToMm(op.fov)}mm<br>height ${(op.pos.y - (op.def.floorY ?? 0)).toFixed(1)}m`;

  if (t < 0) {
    const first = show.sections[0].focus;
    ui.cueNow.innerHTML = recOn
      ? `Standby… rolling. First up: <b>${subjectName(first)}</b>`
      : `Standby! Press <b>R</b> to start recording before the show begins`;
    ui.cueNext.innerHTML = '';
  } else if (sec) {
    ui.cueNow.innerHTML = `NOW: ${sec.name} → <b>${subjectName(sec.focus)}</b>`;
    const am = activeMoment(bar);
    const um = upcomingMoment(bar, 2);
    const ns = nextSection(bar);
    let next = '';
    if (am) next = `<span class="star">★ NOW: ${am.label}!</span>`;
    else if (um) next = `<span class="star">★ GET READY: ${um.label} (${subjectName(um.subject)}) in ${Math.ceil((um.bar - bar) * T.bar)}s</span>`;
    else if (ns && (ns.start - bar) * T.bar <= 5) next = `<span>NEXT in ${Math.ceil((ns.start - bar) * T.bar)}s: ${ns.name} → ${subjectName(ns.focus)}</span>`;
    ui.cueNext.innerHTML = next;
  }

  const q = quality[opIdx];
  ui.fbar.style.width = `${Math.round(q * 100)}%`;
  ui.fbar.style.background = qColor(q);
  ui.fnote.textContent = focus ? notes[opIdx] : '—';

  let warn = '';
  let soft = false;
  if (t >= 0 && t < T.length && !recOn) warn = 'NOT RECORDING — press R';
  else if (t >= 0 && scorer.stale) { warn = 'Shot is getting stale — cut to another camera'; soft = true; }
  ui.warn.textContent = warn;
  ui.warn.style.display = warn ? 'block' : 'none';
  ui.warn.className = soft ? 'soft' : '';

  ui.lockHint.style.display = document.pointerLockElement === canvas ? 'none' : 'block';

  ui.mons.forEach((el, i) => {
    el.className = `mon ${i === liveIdx ? 'live' : i === opIdx ? 'preview' : ''}`;
    el.querySelector('.mlabel').textContent = `${i + 1} · ${rigs[i].name}${i === liveIdx ? ' · LIVE' : ''}`;
    const mb = el.querySelector('.mq i');
    mb.style.width = `${Math.round(quality[i] * 100)}%`;
    mb.style.background = qColor(quality[i]);
  });

  while (scorer.events.length) {
    const ev = scorer.events.shift();
    const div = document.createElement('div');
    div.className = `pop ${ev.kind}`;
    div.textContent = ev.text;
    ui.popups.appendChild(div);
    setTimeout(() => div.remove(), 2500);
  }
}

// ---------- main loop ----------
function readInput(dt) {
  const k = (c) => (keys.has(c) ? 1 : 0);
  const lookSpeed = 1.1 * dt;
  const input = {
    move: { x: k('KeyD') - k('KeyA'), y: k('KeyE') - k('KeyQ'), z: k('KeyW') - k('KeyS') },
    look: {
      dx: mouseDX * 0.0022 + (k('ArrowRight') - k('ArrowLeft')) * lookSpeed,
      dy: mouseDY * 0.0022 + (k('ArrowDown') - k('ArrowUp')) * lookSpeed,
    },
    zoom: Math.exp(wheel * 0.0012) * Math.exp((k('KeyX') - k('KeyZ')) * 1.1 * dt),
    fine: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
  if (input.fine) { input.look.dx *= 0.35; input.look.dy *= 0.35; }
  mouseDX = mouseDY = wheel = 0;
  return input;
}

function followPoint(focus) {
  if (focus === 'crowd') return venue.crowdCenter;
  const id = focus && focus !== 'wide' && cast.members[focus].root.visible !== false ? focus : cast.followDefault;
  return cast.focusPoints(id).chest;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  let t;
  if (state === 'show') t = music.time;
  else if (state === 'menu') t = show.preview + ((now / 1000) % 16);
  else t = T.length + 3;

  if (state === 'show' && !paused) rigs[opIdx].control(readInput(dt), dt);
  else readInput(dt);

  const effDt = paused ? 0 : dt;
  cast.update(t);
  const bar = t / T.bar;
  const sec = t >= 0 ? sectionAt(bar) : null;
  const focus = sec ? sec.focus : null;
  venue.update(t, effDt, followPoint(focus));
  rigs.forEach((r, i) => {
    r.apply(effDt);
    r.setTally(i === liveIdx ? 'live' : i === opIdx ? 'preview' : 'off');
  });

  if (state === 'show') {
    const evalFocus = focus || show.sections[0].focus;
    rigs.forEach((r, i) => {
      const e = evaluate(r.cam, evalFocus, cast, venue);
      quality[i] = e.q;
      notes[i] = e.note;
    });
  }

  if (state === 'show' && !paused) {
    const recOn = recorder.active;
    if (recOn) recSeconds += dt;
    const am = activeMoment(bar);
    const momentQ = {};
    if (am) momentQ[am.id] = evaluate(rigs[liveIdx].cam, am.subject, cast, venue).q;
    scorer.update(t, dt, focus ? quality[liveIdx] : 0, momentQ, recOn);
    updateHud(t, focus);
    if (t > T.length + 2.5) endShow();
  }

  renderer.setViewport(0, 0, L.W, L.H);
  renderer.setScissor(0, 0, L.W, L.H);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderView(rigs[liveIdx], L.main);
  drawProgram(t);
  if (opIdx !== liveIdx) renderView(rigs[opIdx], L.main);
  if (state !== 'menu') rigs.forEach((r, i) => renderView(r, L.mons[i]));
}

loadShow(selectedShow);
buildShowList();
requestAnimationFrame(frame);

// Exposed for debugging from the browser console.
window.liveShot = {
  get rigs() { return rigs; },
  get cast() { return cast; },
  get venue() { return venue; },
  get music() { return music; },
  get scorer() { return scorer; },
  skipTo(sec) {
    music.t0 = music.ctx.currentTime - sec;
    music.nextStep = Math.ceil(sec / (T.bar / 16));
  },
  select: selectCam,
  selectShow,
};
