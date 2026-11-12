'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { addDays, DAYS_S, iso, isDate, MONTHS, mondayOf, parse, shortDate, today } from '@/lib/dates';
import { IconCalendar, IconChevronDown, IconClose, IconNext, IconPrev } from '@/components/shell/icons';
import { usePopover } from './usePopover';

const label = (s: string) => { const d = parse(s); return DAYS_S[(d.getDay() + 6) % 7] + ', ' + shortDate(d); };
const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/**
 * Our own date field: a button that opens a glass month calendar, in place of the browser's date picker.
 * `value` is "YYYY-MM-DD" or '' for none. Arrows move by day/week, PageUp/PageDown by month, Enter picks.
 */
export default function DatePicker({ value, onChange, labelledBy, placeholder = 'No date', clearable = true }: {
  value: string;
  onChange: (value: string) => void;
  labelledBy: string;
  placeholder?: string;
  clearable?: boolean;
}) {
  const uid = useId();
  const pop = usePopover({ height: 360, width: 296 });
  const has = isDate(value);
  const [focus, setFocus] = useState(() => (has ? value : iso(today())));
  const [view, setView] = useState(() => firstOfMonth(parse(focus)));
  const grid = useRef<HTMLDivElement>(null);

  const show = () => {
    const start = has ? value : iso(today());
    setFocus(start); setView(firstOfMonth(parse(start)));
    pop.show();
  };
  const pick = (v: string) => { onChange(v); pop.hide(); };

  const move = (d: Date) => { setFocus(iso(d)); setView(firstOfMonth(d)); };

  useEffect(() => {
    if (!pop.open) return;
    // Focus the chosen day when the calendar opens, and follow the keyboard as it moves.
    grid.current?.querySelector<HTMLElement>('[data-d="' + focus + '"]')?.focus({ preventScroll: true });
  }, [pop.open, focus]);

  const onGridKey = (e: KeyboardEvent) => {
    const f = parse(focus);
    const step: Record<string, () => Date> = {
      ArrowLeft: () => addDays(f, -1), ArrowRight: () => addDays(f, 1),
      ArrowUp: () => addDays(f, -7), ArrowDown: () => addDays(f, 7),
      Home: () => mondayOf(f), End: () => addDays(mondayOf(f), 6),
      PageUp: () => new Date(f.getFullYear(), f.getMonth() - 1, Math.min(f.getDate(), 28)),
      PageDown: () => new Date(f.getFullYear(), f.getMonth() + 1, Math.min(f.getDate(), 28)),
    };
    if (step[e.key]) { e.preventDefault(); move(step[e.key]()); }
  };
  const onPopKey = (e: KeyboardEvent) => {
    // Escape closes only the calendar, not a dialog the field sits in.
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); pop.hide(); }
  };

  const start = mondayOf(view);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weeks = cells[35].getMonth() === view.getMonth() ? 6 : 5;
  const now = iso(today());

  return (
    <div className={'pick date-pick' + (pop.open ? ' is-open' : '')} ref={pop.root}>
      <div className="date-pick-row">
        <button ref={pop.button} type="button" className="input pick-btn" aria-haspopup="dialog" aria-expanded={pop.open}
          aria-labelledby={labelledBy + ' ' + uid + 'v'} onClick={() => (pop.open ? pop.hide() : show())}
          onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); show(); } }}>
          <IconCalendar size={16} className="pick-lead" />
          <span className={'pick-text' + (has ? '' : ' is-empty')} id={uid + 'v'}>{has ? label(value) : placeholder}</span>
          <IconChevronDown size={14} className="pick-chev" />
        </button>
        {clearable && has && (
          <button type="button" className="date-clear" aria-label="Clear date" title="Clear" onClick={() => onChange('')}>
            <IconClose size={14} />
          </button>
        )}
      </div>
      {pop.open && (
        <div className={'pick-list cal' + (pop.up ? ' is-up' : '') + (pop.end ? ' is-end' : '')} role="dialog" aria-label="Choose a date"
          style={{ maxHeight: pop.maxHeight }} onKeyDown={onPopKey}>
          <div className="cal-head">
            <button type="button" className="cal-nav" aria-label="Previous month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}><IconPrev size={16} /></button>
            <strong aria-live="polite">{MONTHS[view.getMonth()]} {view.getFullYear()}</strong>
            <button type="button" className="cal-nav" aria-label="Next month" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}><IconNext size={16} /></button>
          </div>
          <div className="cal-grid" role="grid" ref={grid} onKeyDown={onGridKey}>
            <div role="row" className="cal-row">
              {DAYS_S.map(d => <span key={d} role="columnheader" className="cal-dow" aria-label={d}>{d.slice(0, 2)}</span>)}
            </div>
            {Array.from({ length: weeks }, (_, w) => (
              <div role="row" className="cal-row" key={w}>
                {cells.slice(w * 7, w * 7 + 7).map(d => {
                  const s = iso(d);
                  const cls = 'cal-day' + (d.getMonth() !== view.getMonth() ? ' is-out' : '') + (s === now ? ' is-today' : '') + (s === value ? ' is-on' : '');
                  return (
                    <button key={s} type="button" role="gridcell" data-d={s} className={cls} tabIndex={s === focus ? 0 : -1}
                      aria-selected={s === value} aria-label={label(s) + ' ' + d.getFullYear()} onClick={() => pick(s)}>
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="cal-foot">
            <button type="button" className="cal-link" onClick={() => pick(now)}>Today</button>
            {clearable && <button type="button" className="cal-link" onClick={() => pick('')}>Clear</button>}
          </div>
        </div>
      )}
    </div>
  );
}
