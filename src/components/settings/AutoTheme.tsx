'use client';

import { useEffect } from 'react';
import { applyChoice, msUntilNextSwitch, readChoice, THEME_EVENT } from '@/lib/theme';

/** When the theme is set to Auto, flips Day/Night as the clock crosses the switch hours.
 *  Also re-checks when the tab comes back (timers sleep with the computer). Renders nothing. */
export default function AutoTheme() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      clearTimeout(timer);
      if (readChoice() !== 'auto') return;
      applyChoice('auto');
      // +1s so we land just past the hour, not a hair before it
      timer = setTimeout(sync, msUntilNextSwitch() + 1000);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
    sync();
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener('storage', sync); // a change made in another tab
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}
