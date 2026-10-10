export const BPM = 120;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;
export const STANDBY_SECONDS = 10;

export const BAND_NAME = 'THE NEON FOXES';

export const SUBJECTS = {
  singer: 'Mia (vocals)',
  guitar: 'Dex (guitar)',
  drums: 'Jojo (drums)',
  keys: 'Sam (keys)',
  wide: 'Wide shot (whole band)',
};

// start/end are in bars. `focus` is who the director wants on the live feed.
export const SECTIONS = [
  { name: 'Intro', start: 0, end: 4, focus: 'wide', energy: 0.35,
    music: { drums: 'intro', bass: false, pad: true, lead: null } },
  { name: 'Verse 1', start: 4, end: 12, focus: 'singer', energy: 0.45,
    music: { drums: 'light', bass: true, pad: true, lead: 'vocal' } },
  { name: 'Pre-chorus', start: 12, end: 16, focus: 'keys', energy: 0.55,
    music: { drums: 'light', bass: true, pad: true, lead: 'arp' } },
  { name: 'Chorus', start: 16, end: 24, focus: 'wide', energy: 1.0,
    music: { drums: 'full', bass: true, pad: true, lead: 'chorus' } },
  { name: 'Guitar solo', start: 24, end: 32, focus: 'guitar', energy: 0.85,
    music: { drums: 'full', bass: true, pad: false, lead: 'guitar' } },
  { name: 'Verse 2', start: 32, end: 40, focus: 'singer', energy: 0.5,
    music: { drums: 'light', bass: true, pad: true, lead: 'vocal' } },
  { name: 'Drum break', start: 40, end: 44, focus: 'drums', energy: 0.8,
    music: { drums: 'break', bass: false, pad: false, lead: null } },
  { name: 'Chorus 2', start: 44, end: 52, focus: 'singer', energy: 1.0,
    music: { drums: 'full', bass: true, pad: true, lead: 'chorus' } },
  { name: 'Breakdown', start: 52, end: 56, focus: 'keys', energy: 0.25,
    music: { drums: 'none', bass: true, pad: true, lead: 'arp' } },
  { name: 'Final chorus', start: 56, end: 64, focus: 'wide', energy: 1.25,
    music: { drums: 'full', bass: true, pad: true, lead: 'chorus' } },
  { name: 'Outro', start: 64, end: 67, focus: 'wide', energy: 0.6,
    music: { drums: 'end', bass: false, pad: false, lead: null } },
];

export const SHOW_LENGTH = SECTIONS[SECTIONS.length - 1].end * BAR;

// Big moments worth bonus points if the live camera has the subject framed.
export const MOMENTS = [
  { id: 'runon', bar: 1.5, dur: 2.5, subject: 'singer', label: 'Singer runs on stage' },
  { id: 'slide', bar: 29, dur: 1.5, subject: 'guitar', label: 'Guitar knee slide' },
  { id: 'crash', bar: 42.5, dur: 1.5, subject: 'drums', label: 'Drum fill + cymbal crash' },
  { id: 'jump', bar: 50, dur: 1.5, subject: 'singer', label: 'Singer jumps' },
  { id: 'pyro', bar: 62, dur: 2, subject: 'wide', label: 'Pyro finale' },
];

export const MOMENT_POINTS = 250;

export function sectionAt(bar) {
  for (const s of SECTIONS) if (bar >= s.start && bar < s.end) return s;
  return bar < 0 ? null : SECTIONS[SECTIONS.length - 1];
}

export function nextSection(bar) {
  return SECTIONS.find((s) => s.start > bar) || null;
}

export function upcomingMoment(bar, leadBars = 2) {
  return MOMENTS.find((m) => bar < m.bar && m.bar - bar <= leadBars) || null;
}

export function activeMoment(bar) {
  return MOMENTS.find((m) => bar >= m.bar && bar < m.bar + m.dur) || null;
}

export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
