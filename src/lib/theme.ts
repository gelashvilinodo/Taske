/**
 * Day / Night preference.
 * - system: follow the device's light or dark setting (nothing saved)
 * - auto:   follow the clock, Day from DAY_START to NIGHT_START, Night otherwise
 * - day / night: fixed
 * The saved choice lives in localStorage 'ps.mode'; the applied look is <html data-mode>.
 */
export type ThemeChoice = 'system' | 'auto' | 'day' | 'night';

export const DAY_START = 7;    // 07:00
export const NIGHT_START = 19; // 19:00
const KEY = 'ps.mode';
/** Fired on window whenever the choice changes in this tab. */
export const THEME_EVENT = 'ps-theme-change';

export const modeForTime = (d = new Date()): 'day' | 'night' => {
  const h = d.getHours();
  return h >= DAY_START && h < NIGHT_START ? 'day' : 'night';
};

/** Milliseconds until the clock next crosses DAY_START or NIGHT_START. */
export function msUntilNextSwitch(now = new Date()): number {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  const h = now.getHours();
  if (h < DAY_START) next.setHours(DAY_START);
  else if (h < NIGHT_START) next.setHours(NIGHT_START);
  else { next.setDate(next.getDate() + 1); next.setHours(DAY_START); }
  return next.getTime() - now.getTime();
}

export function readChoice(): ThemeChoice {
  try {
    const m = localStorage.getItem(KEY);
    if (m === 'auto' || m === 'day' || m === 'night') return m;
  } catch { /* storage blocked */ }
  const m = document.documentElement.dataset.mode;
  return m === 'day' || m === 'night' ? m : 'system';
}

/** Puts the right look on <html> for a choice. */
export function applyChoice(c: ThemeChoice) {
  const root = document.documentElement;
  if (c === 'system') delete root.dataset.mode;
  else root.dataset.mode = c === 'auto' ? modeForTime() : c;
}

export function saveChoice(c: ThemeChoice) {
  try {
    if (c === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, c);
  } catch { /* storage blocked: the choice still applies to this visit */ }
  applyChoice(c);
  window.dispatchEvent(new Event(THEME_EVENT));
}
