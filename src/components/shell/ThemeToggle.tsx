'use client';

import { useEffect, useState } from 'react';

type Mode = 'day' | 'night';

function effectiveMode(): Mode {
  const m = document.documentElement.dataset.mode;
  if (m === 'day' || m === 'night') return m;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
}

/** Day / Night switch. Without a saved choice the page follows the system theme. */
export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    setMode(effectiveMode());
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setMode(effectiveMode());
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const pick = (m: Mode) => {
    document.documentElement.dataset.mode = m;
    try { localStorage.setItem('ps.mode', m); } catch { /* storage blocked */ }
    setMode(m);
  };

  return (
    <div className="seg" aria-label="Theme">
      <button type="button" aria-pressed={mode === 'day'} onClick={() => pick('day')}>Day</button>
      <button type="button" aria-pressed={mode === 'night'} onClick={() => pick('night')}>Night</button>
    </div>
  );
}
