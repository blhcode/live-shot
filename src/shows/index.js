import rock from './rock.js';
import club from './club.js';
import jazz from './jazz.js';
import magic from './magic.js';

export const SHOWS = [rock, club, jazz, magic];

export function getShow(id) {
  return SHOWS.find((s) => s.id === id) || SHOWS[0];
}
