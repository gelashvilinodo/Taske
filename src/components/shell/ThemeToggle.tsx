'use client';

import { useEffect, useState } from 'react';
import { IconMoon, IconSun } from './icons';

type Mode = 'day' | 'night';

function effectiveMode(): Mode {
  const m = document.documentElement.dataset.mode;
  if (m === 'day' || m === 'night') return m;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
}

/** Round Day / Night button. Without a saved choice the page follows the system theme. */
export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    setMode(effectiveMode());
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setMode(effectiveMode());
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const next: Mode = mode === 'night' ? 'day' : 'night';
  const pick = () => {
    document.documentElement.dataset.mode = next;
    try { localStorage.setItem('ps.mode', next); } catch { /* storage blocked */ }
    setMode(next);
  };

  return (
    <button className="round-btn" type="button" onClick={pick} aria-label={next === 'day' ? 'Switch to Day' : 'Switch to Night'} title={next === 'day' ? 'Day' : 'Night'}>
      {mode === 'night' ? <IconSun /> : <IconMoon />}
    </button>
  );
}
