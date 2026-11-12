'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { IconClock, IconComputer, IconMoon, IconSun } from '@/components/shell/icons';
import { DAY_START, NIGHT_START, readChoice, saveChoice, type ThemeChoice } from '@/lib/theme';

const pad = (h: number) => String(h).padStart(2, '0') + ':00';

const OPTIONS: { value: ThemeChoice; label: string; Icon: typeof IconSun; hint: string }[] = [
  { value: 'auto', label: 'Auto', Icon: IconClock, hint: `Day from ${pad(DAY_START)}, Night from ${pad(NIGHT_START)}.` },
  { value: 'system', label: 'System', Icon: IconComputer, hint: 'Follows your device’s light or dark setting.' },
  { value: 'day', label: 'Day', Icon: IconSun, hint: 'Always light.' },
  { value: 'night', label: 'Night', Icon: IconMoon, hint: 'Always dark.' },
];

type Thumb = { x: number; w: number; n: number };

/** Theme switch. A glowing thumb slides (and squishes a little) to the picked option. */
export default function ThemeSetting() {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const group = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => setChoice(readChoice()), []);

  // Measure the picked button; n counts moves so the squish restarts each time.
  useLayoutEffect(() => {
    const place = () => {
      const el = group.current?.querySelector<HTMLElement>('button[aria-pressed="true"]');
      if (!el) return;
      setThumb(prev => {
        if (prev && prev.x === el.offsetLeft && prev.w === el.offsetWidth) return prev;
        return { x: el.offsetLeft, w: el.offsetWidth, n: prev ? prev.n + 1 : 0 };
      });
    };
    place();
    const ro = new ResizeObserver(place);
    if (group.current) ro.observe(group.current);
    return () => ro.disconnect();
  }, [choice]);

  const pick = (c: ThemeChoice) => { saveChoice(c); setChoice(c); };
  const hint = OPTIONS.find(o => o.value === choice)?.hint ?? '';

  return (
    <div className="settings-row">
      <div className="settings-row-text">
        <span>{hint}</span>
      </div>
      <div className="seg theme-seg" role="group" aria-label="Day and night" ref={group}>
        {thumb && (
          <span className={'seg-thumb' + (thumb.n ? ' is-animated' : '')} aria-hidden="true"
            style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` } as CSSProperties}>
            <span className="seg-thumb-core" key={thumb.n} />
          </span>
        )}
        {OPTIONS.map(({ value, label, Icon }) => (
          <button key={value} type="button" aria-pressed={choice === value} onClick={() => pick(value)}>
            <Icon size={18} />{label}
          </button>
        ))}
      </div>
    </div>
  );
}
