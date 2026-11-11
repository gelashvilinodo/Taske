'use client';

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { DAYS_S, iso, shortDate, today, weekDays } from '@/lib/dates';
import { makeSubs, PRIORITIES, type PriorityId } from '@/lib/tasks/model';
import ProjectSelect from '@/components/projects/ProjectSelect';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

/** Fired by a column's "+" button to open the form on that day. */
export const ADD_ON_DAY = 'ps:add-on-day';
export const requestAddOnDay = (day: string) => window.dispatchEvent(new CustomEvent(ADD_ON_DAY, { detail: day }));

const readPref = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const writePref = (key: string, v: string) => { try { localStorage.setItem(key, v); } catch { /* storage blocked */ } };

/** One-line task entry above the board. Pasting several lines adds one task per line. */
export default function AddTaskForm() {
  const { weekStart, addTasks, toast, projects } = useWorkspace();
  const days = weekDays(weekStart).map(iso);
  const defaultDay = days.includes(iso(today())) ? iso(today()) : days[0];

  const [open, setOpen] = useState(false); // phone layout only
  const [title, setTitle] = useState('');
  const [project, setProject] = useState('');
  const [priority, setPriority] = useState<PriorityId>('');
  const [day, setDay] = useState(defaultDay);
  const [deadline, setDeadline] = useState('');
  const [details, setDetails] = useState(false);
  const [desc, setDesc] = useState('');
  const [subs, setSubs] = useState('');
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const last = readPref('ps.project');
    if (last && projects.some(p => p.id === last)) setProject(last);
  }, [projects]);

  // Keep the chosen day inside the week on screen.
  const weekKey = days.join();
  useEffect(() => { if (!days.includes(day)) setDay(defaultDay); }, [weekKey]);

  useEffect(() => {
    const onAdd = (e: Event) => {
      setOpen(true);
      const d = (e as CustomEvent<string>).detail;
      if (d) setDay(d);
      requestAnimationFrame(() => { titleRef.current?.focus(); titleRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
    };
    window.addEventListener(ADD_ON_DAY, onAdd);
    return () => window.removeEventListener(ADD_ON_DAY, onAdd);
  }, []);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }, [title]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const lines = title.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) { titleRef.current?.focus(); return; }
    const base = {
      project: projects.some(p => p.id === project) ? project : '', day, deadline: deadline || '', priority,
      description: details ? desc.trim().slice(0, 5000) : '',
      status: 'todo' as const,
    };
    setTitle(''); setDeadline(''); setPriority('');
    if (details) { setDesc(''); setSubs(''); }
    titleRef.current?.focus();
    const now = Date.now();
    await addTasks(lines.map((line, i) => ({ ...base, title: line.slice(0, 500), createdAt: now + i, subtasks: details ? makeSubs(subs) : [] })));
    if (lines.length > 1) toast('Added ' + lines.length + ' tasks');
  };

  return (
    <>
      <button className="ghost" id="addOpen" type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        {open ? '− Close' : '+ Add task'}
      </button>
      <form className={'add' + (open ? ' is-open' : '')} autoComplete="off" onSubmit={submit}>
        <label className="field field-title"><span>Task</span>
          <textarea ref={titleRef} className="input" rows={1} placeholder="Type a task and press Enter" value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
        </label>
        <ProjectSelect className="field-project" value={project} onChange={id => { setProject(id); writePref('ps.project', id); }} />
        <label className="field"><span>Priority</span>
          <select className="input" value={priority} onChange={e => setPriority(e.target.value as PriorityId)}>
            <option value="">None</option>
            {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="field"><span>Day</span>
          <select className="input" value={day} onChange={e => setDay(e.target.value)}>
            {weekDays(weekStart).map((d, i) => <option key={i} value={iso(d)}>{DAYS_S[i]}, {shortDate(d)}</option>)}
          </select>
        </label>
        <label className="field"><span>Deadline</span>
          <input className="input" type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
        </label>
        <button className="primary" type="submit">Add task</button>
        <button className="more" type="button" aria-expanded={details} onClick={() => setDetails(d => !d)}>
          {details ? '− Hide details' : '+ Description and subtasks'}
        </button>
        {details && (
          <div className="details-row field-wide">
            <label className="field"><span>Description</span>
              <textarea id="addDesc" className="input" rows={3} placeholder="Details, links, who to check with" value={desc} onChange={e => setDesc(e.target.value)} autoFocus />
            </label>
            <label className="field"><span>Subtasks, one per line</span>
              <textarea id="addSubs" className="input" rows={3} placeholder="Prepare invoice" value={subs} onChange={e => setSubs(e.target.value)} />
            </label>
          </div>
        )}
      </form>
    </>
  );
}
