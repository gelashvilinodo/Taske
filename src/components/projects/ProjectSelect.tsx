'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { IconPlus } from '@/components/shell/icons';
import { ProjectLogo } from './ProjectBadge';
import ProjectDialog from './ProjectDialog';

/**
 * Project field for task forms: our own glass dropdown (logo + name per project)
 * with a "+" button beside it. The "+" opens the New project dialog; the new project is picked straight away.
 */
export default function ProjectSelect({ value, onChange, className = '' }: { value: string; onChange: (id: string) => void; className?: string }) {
  const { projects, projectsReady, readOnly } = useWorkspace();
  const uid = useId();
  const labelId = uid + 'l', listId = uid + 'list';
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => setMounted(true), []);

  const options = [{ id: '', name: 'No project' }, ...projects];
  const current = projects.find(p => p.id === value);
  const selectedIndex = Math.max(0, options.findIndex(o => o.id === (current ? current.id : '')));

  const show = () => {
    const r = button.current?.getBoundingClientRect();
    // Room inside the viewport, or inside the dialog the field sits in (a dialog clips what overflows it).
    const box = button.current?.closest('dialog')?.getBoundingClientRect();
    const below = r ? Math.min(innerHeight, box?.bottom ?? innerHeight) - r.bottom : 0;
    const above = r ? r.top - Math.max(0, box?.top ?? 0) : 0;
    const need = Math.min(options.length * 40 + 12, 300);
    setUp(below < need && above > below);
    setActive(selectedIndex);
    setOpen(true);
  };
  const hide = (focusButton = true) => { setOpen(false); if (focusButton) button.current?.focus(); };
  const pick = (id: string) => { onChange(id); hide(); };

  useEffect(() => {
    if (!open) return;
    list.current?.focus({ preventScroll: true });
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>('[data-i="' + active + '"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onButtonKey = (e: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show(); }
  };
  const onListKey = (e: KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(last, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(options[active].id); }
    // Escape closes only the list, not a dialog the field sits in.
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); hide(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className={('field ' + className).trim()}>
      <span id={labelId}>Project</span>
      <div className="select-add">
        <div className={'pick' + (open ? ' is-open' : '')} ref={root}>
          <button ref={button} type="button" className="input pick-btn" aria-haspopup="listbox" aria-expanded={open}
            aria-controls={listId} aria-labelledby={labelId} onClick={() => (open ? hide() : show())} onKeyDown={onButtonKey}>
            {current ? <ProjectLogo project={current} size="md" /> : <span className="pick-none" aria-hidden="true" />}
            <span className="pick-text">{current ? current.name : 'No project'}</span>
            <svg className="pick-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {open && (
            <ul ref={list} id={listId} className={'pick-list' + (up ? ' is-up' : '')} role="listbox" tabIndex={-1}
              aria-labelledby={labelId} aria-activedescendant={uid + 'o' + active} onKeyDown={onListKey}>
              {options.map((o, i) => {
                const p = projects.find(x => x.id === o.id);
                const selected = i === selectedIndex;
                return (
                  <li key={o.id || 'none'} id={uid + 'o' + i} data-i={i} role="option" aria-selected={selected}
                    className={'pick-opt' + (i === active ? ' is-active' : '')}
                    onPointerMove={() => setActive(i)} onClick={() => pick(o.id)}>
                    {p ? <ProjectLogo project={p} size="md" /> : <span className="pick-none" aria-hidden="true" />}
                    <span className="pick-text">{o.name}</span>
                    {selected && <svg className="pick-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {!readOnly && projectsReady && (
          <button className="add-btn" type="button" aria-label="New project" title="New project" onClick={() => setCreating(true)}>
            <IconPlus />
          </button>
        )}
      </div>
      {/* Portal: the dialog has its own form, and forms cannot sit inside another form. */}
      {mounted && createPortal(
        <ProjectDialog project={creating ? null : undefined} onClose={() => setCreating(false)} onCreated={onChange} />,
        document.body,
      )}
    </div>
  );
}
