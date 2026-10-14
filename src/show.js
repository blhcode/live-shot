export const STANDBY_SECONDS = 10;
export const MOMENT_POINTS = 250;

// Timing and data for the show currently loaded. Set with setShow().
export const T = { show: null, bpm: 120, beat: 0.5, bar: 2, length: 0 };

const GENERIC_SUBJECTS = {
  wide: 'Wide shot (everyone on stage)',
  crowd: 'The crowd',
};

export function setShow(show) {
  T.show = show;
  T.bpm = show.bpm;
  T.beat = 60 / show.bpm;
  T.bar = T.beat * 4;
  T.length = show.sections[show.sections.length - 1].end * T.bar;
}

export function subjectName(id) {
  return T.show.subjects[id] || GENERIC_SUBJECTS[id] || id;
}

export function sectionAt(bar) {
  const S = T.show.sections;
  for (const s of S) if (bar >= s.start && bar < s.end) return s;
  return bar < 0 ? null : S[S.length - 1];
}

export function nextSection(bar) {
  return T.show.sections.find((s) => s.start > bar) || null;
}

export function upcomingMoment(bar, leadBars = 2) {
  return T.show.moments.find((m) => bar < m.bar && m.bar - bar <= leadBars) || null;
}

export function activeMoment(bar) {
  return T.show.moments.find((m) => bar >= m.bar && bar < m.bar + m.dur) || null;
}

export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
