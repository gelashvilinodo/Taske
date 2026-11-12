'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { IconChevronDown, IconSave } from '@/components/shell/icons';
import { usePopover } from './usePopover';

export interface DropdownOption { value: string; label: string; leading?: ReactNode; hint?: string }

/**
 * Our own select: a button plus a glass listbox, in place of the browser's <select>.
 * Arrow keys, Home/End, Enter/Space and Escape work as in a native select.
 */
export default function Dropdown({ value, options, onChange, labelledBy, className = '' }: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  labelledBy: string;
  className?: string;
}) {
  const uid = useId();
  const listId = uid + 'list';
  const pop = usePopover({ height: Math.min(options.length * 40 + 12, 300), width: 200 });
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  const selectedIndex = Math.max(0, options.findIndex(o => o.value === value));
  const current = options[selectedIndex];

  const show = () => { setActive(selectedIndex); pop.show(); };
  const pick = (v: string) => { onChange(v); pop.hide(); };

  useEffect(() => { if (pop.open) list.current?.focus({ preventScroll: true }); }, [pop.open]);
  useEffect(() => {
    if (pop.open) list.current?.querySelector<HTMLElement>('[data-i="' + active + '"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, pop.open]);

  const onButtonKey = (e: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); }
  };
  const onListKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(last, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(options[active].value); }
    // Escape closes only the list, not a dialog the field sits in.
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); pop.hide(); }
    else if (e.key === 'Tab') pop.setOpen(false);
  };

  return (
    <div className={('pick ' + (pop.open ? 'is-open ' : '') + className).trim()} ref={pop.root}>
      <button ref={pop.button} type="button" className="input pick-btn" aria-haspopup="listbox" aria-expanded={pop.open}
        aria-controls={listId} aria-labelledby={labelledBy + ' ' + uid + 'v'} onClick={() => (pop.open ? pop.hide() : show())} onKeyDown={onButtonKey}>
        {current?.leading}
        <span className="pick-text" id={uid + 'v'}>{current?.label}</span>
        <IconChevronDown size={14} className="pick-chev" />
      </button>
      {pop.open && (
        <ul ref={list} id={listId} role="listbox" tabIndex={-1} aria-labelledby={labelledBy} aria-activedescendant={uid + 'o' + active}
          className={'pick-list' + (pop.up ? ' is-up' : '') + (pop.end ? ' is-end' : '')} style={{ maxHeight: pop.maxHeight }}
          onKeyDown={onListKey}>
          {options.map((o, i) => {
            const selected = i === selectedIndex;
            return (
              <li key={o.value || '_'} id={uid + 'o' + i} data-i={i} role="option" aria-selected={selected}
                className={'pick-opt' + (i === active ? ' is-active' : '')}
                onPointerMove={() => setActive(i)} onClick={() => pick(o.value)}>
                {o.leading}
                <span className="pick-text">{o.label}</span>
                {o.hint && <span className="pick-hint">{o.hint}</span>}
                {selected && <IconSave size={15} className="pick-check" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
