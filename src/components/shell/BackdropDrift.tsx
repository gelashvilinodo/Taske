'use client';

import { useEffect } from 'react';

// Moves the page backdrop's colour blobs to random spots, slowly and without a pattern.
// Each blob's x and y get their own timer: a new random target and a random travel time,
// written to <body> as --bNx / --bNy and --bNxd / --bNyd. The backdrop layers inherit
// them and glide there by CSS transition (see app.css), and blobs that meet blend into
// a new colour (--backdrop-blend in tokens.css). Off for people who ask for less motion.

const AXES = ['b1x', 'b1y', 'b2x', 'b2y', 'b3x', 'b3y', 'b4x', 'b4y', 'b5x', 'b5y'];
const MIN_S = 18;
const MAX_S = 30;

export function BackdropDrift() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const style = document.body.style;
    const timers = new Map<string, number>();

    const move = (axis: string) => {
      // A task card is being dragged: the blobs are paused (TaskDrag), so wait with a new target.
      if (document.documentElement.classList.contains('is-dragging-task')) { timers.set(axis, window.setTimeout(() => move(axis), 1000)); return; }
      const seconds = MIN_S + Math.random() * (MAX_S - MIN_S);
      style.setProperty(`--${axis}d`, `${seconds.toFixed(1)}s`);
      style.setProperty(`--${axis}`, `${(Math.random() * 100).toFixed(1)}%`);
      timers.set(axis, window.setTimeout(() => move(axis), seconds * 1000));
    };

    // Start each axis at a slightly different moment so they never line up.
    for (const axis of AXES) timers.set(axis, window.setTimeout(() => move(axis), Math.random() * 1500));

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      for (const axis of AXES) {
        style.removeProperty(`--${axis}`);
        style.removeProperty(`--${axis}d`);
      }
    };
  }, []);

  return null;
}
