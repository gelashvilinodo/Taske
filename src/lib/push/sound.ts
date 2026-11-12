'use client';

/**
 * Taske's own notification sound: a soft two-note chime made with the Web Audio API (no file to load).
 * Browsers only allow sound after the person has interacted with the page, so the audio context is
 * created on the first tap or key press (see unlockSound) and reused.
 */

let ctx: AudioContext | null = null;
let last = 0;

function context() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Call once; it waits for the first interaction, then prepares audio so later chimes can play. */
export function unlockSound() {
  const go = () => {
    const c = context();
    if (c && c.state === 'suspended') c.resume().catch(() => undefined);
    window.removeEventListener('pointerdown', go, true);
    window.removeEventListener('keydown', go, true);
  };
  window.addEventListener('pointerdown', go, true);
  window.addEventListener('keydown', go, true);
}

/** Plays the chime. Several notifications arriving together make one sound. */
export function playChime() {
  const now = Date.now();
  if (now - last < 1500) return;
  last = now;
  const c = context();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => undefined);
  const t0 = c.currentTime + 0.02;
  const out = c.createGain();
  out.gain.value = 0.22;
  out.connect(c.destination);
  // Two bell-like notes, a fifth apart (E6 then B6), each with a quiet octave overtone.
  [[1318.5, 0], [1975.5, 0.13]].forEach(([freq, at]) => {
    [[freq, 1], [freq * 2, 0.18]].forEach(([f, level]) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      const start = t0 + at;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(level, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.9);
      osc.connect(g).connect(out);
      osc.start(start);
      osc.stop(start + 0.95);
    });
  });
}
