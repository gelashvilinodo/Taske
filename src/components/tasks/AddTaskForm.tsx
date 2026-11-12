'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { DAYS_S, iso, shortDate, today, weekDays } from '@/lib/dates';
import { makeSubs, PRIORITIES, type PriorityId } from '@/lib/tasks/model';
import ProjectSelect from '@/components/projects/ProjectSelect';
import Dropdown from '@/components/ui/Dropdown';
import DatePicker from '@/components/ui/DatePicker';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import {
  IconCalendar, IconClock, IconClose, IconDescription, IconFlag, IconMinus, IconPlus, IconSubtasks, IconTaskAdd,
} from '@/components/shell/icons';

/** Fired by the header "+" and a column's "+" to open the New task window (optionally on a given day). */
export const ADD_ON_DAY = 'ps:add-on-day';
export const requestAddOnDay = (day: string) => window.dispatchEvent(new CustomEvent(ADD_ON_DAY, { detail: day }));

const readPref = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const writePref = (key: string, v: string) => { try { localStorage.setItem(key, v); } catch { /* storage blocked */ } };

const flag = (id: string) => <span className={'pick-flag ' + (id ? 'pr-' + id : 'none')} aria-hidden="true"><IconFlag size={14} /></span>;
const PRIORITY_OPTIONS = [
  { value: '', label: 'None', leading: flag('') },
  ...PRIORITIES.map(p => ({ value: p.id, label: p.name, leading: flag(p.id) })),
];

/** New task window. Opened by the "+" buttons; pasting several lines adds one task per line. */
export default function AddTaskForm() {
  const { weekStart, addTasks, toast, projects } = useWorkspace();
  const days = weekDays(weekStart);
  const dayIsos = days.map(iso);
  const now = iso(today());
  const defaultDay = dayIsos.includes(now) ? now : dayIsos[0];
  const uid = useId();

  const dialog = useRef<HTMLDialogElement>(null);
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
  const weekKey = dayIsos.join();
  useEffect(() => { if (!dayIsos.includes(day)) setDay(defaultDay); }, [weekKey]);

  useEffect(() => {
    const onAdd = (e: Event) => {
      const d = (e as CustomEvent<string>).detail;
      setDay(d && dayIsos.includes(d) ? d : defaultDay);
      if (!dialog.current?.open) dialog.current?.showModal();
      requestAnimationFrame(() => titleRef.current?.focus());
    };
    window.addEventListener(ADD_ON_DAY, onAdd);
    return () => window.removeEventListener(ADD_ON_DAY, onAdd);
  }, [weekKey, defaultDay]);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }, [title]);

  const close = () => dialog.current?.close();

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const lines = title.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) { titleRef.current?.focus(); return; }
    const base = {
      project: projects.some(p => p.id === project) ? project : '', day, deadline: deadline || '', priority,
      description: details ? desc.trim().slice(0, 5000) : '',
      status: 'todo' as const,
    };
    const subtasks = details ? subs : '';
    setTitle(''); setDeadline(''); setPriority('');
    setDesc(''); setSubs(''); setDetails(false);
    close();
    const t = Date.now();
    await addTasks(lines.map((line, i) => ({ ...base, title: line.slice(0, 500), createdAt: t + i, subtasks: subtasks ? makeSubs(subtasks) : [] })));
    toast(lines.length > 1 ? 'Added ' + lines.length + ' tasks' : 'Task added');
  };

  const dayOptions = days.map((d, i) => ({
    value: dayIsos[i], label: DAYS_S[i] + ', ' + shortDate(d), hint: dayIsos[i] === now ? 'Today' : undefined,
  }));

  return (
    <dialog ref={dialog} className="add-dlg" aria-labelledby={uid + 't'}
      onClick={e => {
        // A click on the dimmed backdrop (outside the window's box) closes it.
        const r = e.currentTarget.getBoundingClientRect();
        if (e.target === e.currentTarget && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) close();
      }}>
      <form className="dlg add" autoComplete="off" onSubmit={submit}>
        <div className="add-head">
          <span className="add-head-icon" aria-hidden="true"><IconTaskAdd size={20} /></span>
          <h3 id={uid + 't'}>New task</h3>
          <button type="button" className="dlg-x" aria-label="Close" title="Close" onClick={close}><IconClose size={18} /></button>
        </div>

        <label className="field"><span><IconSubtasks size={14} />Task</span>
          <textarea ref={titleRef} className="input add-title" rows={1} placeholder="Type a task and press Enter" value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
        </label>

        <ProjectSelect value={project} onChange={id => { setProject(id); writePref('ps.project', id); }} />

        <div className="add-meta">
          <div className="field"><span id={uid + 'p'}><IconFlag size={14} />Priority</span>
            <Dropdown value={priority} options={PRIORITY_OPTIONS} onChange={v => setPriority(v as PriorityId)} labelledBy={uid + 'p'} />
          </div>
          <div className="field"><span id={uid + 'd'}><IconCalendar size={14} />Day</span>
            <Dropdown value={day} options={dayOptions} onChange={setDay} labelledBy={uid + 'd'} />
          </div>
          <div className="field"><span id={uid + 'dl'}><IconClock size={14} />Deadline</span>
            <DatePicker value={deadline} onChange={setDeadline} labelledBy={uid + 'dl'} placeholder="No deadline" />
          </div>
        </div>

        {details && (
          <div className="details-row">
            <label className="field"><span><IconDescription size={14} />Description</span>
              <textarea id="addDesc" className="input" rows={3} placeholder="Details, links, who to check with" value={desc} onChange={e => setDesc(e.target.value)} autoFocus />
            </label>
            <label className="field"><span><IconSubtasks size={14} />Subtasks, one per line</span>
              <textarea id="addSubs" className="input" rows={3} placeholder="Prepare invoice" value={subs} onChange={e => setSubs(e.target.value)} />
            </label>
          </div>
        )}

        <div className="dlg-foot add-foot">
          <button className="more" type="button" aria-expanded={details} onClick={() => setDetails(d => !d)}>
            {details ? <><IconMinus size={14} />Hide details</> : <><IconPlus size={14} />Description and subtasks</>}
          </button>
          <div>
            <button className="ghost" type="button" onClick={close}>Cancel</button>
            <button className="primary" type="submit"><IconPlus size={16} />Add task</button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
