'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { DAYS_S, iso, shortDate, today, weekDays } from '@/lib/dates';
import { flatSubs, makeSubs, PRIORITIES, type PriorityId, type Subtask } from '@/lib/tasks/model';
import ProjectSelect from '@/components/projects/ProjectSelect';
import Dropdown from '@/components/ui/Dropdown';
import DatePicker from '@/components/ui/DatePicker';
import DraftSubtasks, { finalDraftSubs, pastedLines } from './DraftSubtasks';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import {
  IconCalendar, IconClock, IconClose, IconDescription, IconFlag, IconMinus, IconPlus, IconSubtasks, IconTaskAdd,
} from '@/components/shell/icons';

/** One press of a "+" button (see addTaskEvents): the day asked for, and a counter so each press opens the window. */
export type AddRequest = { day: string; n: number };

const readPref = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const writePref = (key: string, v: string) => { try { localStorage.setItem(key, v); } catch { /* storage blocked */ } };

const flag = (id: string) => <span className={'pick-flag ' + (id ? 'pr-' + id : 'none')} aria-hidden="true"><IconFlag size={14} /></span>;
const PRIORITY_OPTIONS = [
  { value: '', label: 'None', leading: flag('') },
  ...PRIORITIES.map(p => ({ value: p.id, label: p.name, leading: flag(p.id) })),
];

/** New task window. Opened by the "+" buttons (through AddTaskHost); pasting several lines adds one task per line. */
export default function AddTaskForm({ request }: { request: AddRequest | null }) {
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
  const [subs, setSubs] = useState<Subtask[]>([]);
  const [newSub, setNewSub] = useState('');
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);
  const newSubRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollInnerRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const last = readPref('ps.project');
    if (last && projects.some(p => p.id === last)) setProject(last);
  }, [projects]);

  // Keep the chosen day inside the week on screen.
  const weekKey = dayIsos.join();
  useEffect(() => { if (!dayIsos.includes(day)) setDay(defaultDay); }, [weekKey]);

  useEffect(() => {
    if (!request) return;
    const d = request.day;
    setDay(d && dayIsos.includes(d) ? d : defaultDay);
    if (!dialog.current?.open) dialog.current?.showModal();
    // Straight to the title, so focus never lands on the close button first.
    titleRef.current?.focus({ preventScroll: true });
  }, [request?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }, [title]);

  // The middle of the window scrolls only once it no longer fits; until then dropdowns can spill past its edge.
  useEffect(() => {
    const box = scrollRef.current, inner = scrollInnerRef.current;
    if (!box || !inner) return;
    const check = () => setOverflowing(inner.offsetHeight > box.clientHeight + 1);
    const ro = new ResizeObserver(check);
    ro.observe(box); ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const close = () => dialog.current?.close();
  const toggleDetails = () => {
    const next = !details;
    setDetails(next);
    if (next) requestAnimationFrame(() => descRef.current?.focus({ preventScroll: true }));
  };

  const addSubs = (text: string) => {
    const added = makeSubs(text);
    if (added.length) setSubs(list => list.concat(added));
    setNewSub('');
    newSubRef.current?.focus();
  };
  const subCount = flatSubs(subs).length;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const lines = title.split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) { titleRef.current?.focus(); return; }
    const base = {
      project: projects.some(p => p.id === project) ? project : '', day, deadline: deadline || '', priority,
      description: desc.trim().slice(0, 5000),
      status: 'todo' as const,
    };
    // A subtask still sitting in the input counts too.
    const draft = subs.concat(makeSubs(newSub));
    setTitle(''); setDeadline(''); setPriority('');
    setDesc(''); setSubs([]); setNewSub(''); setDetails(false);
    close();
    const t = Date.now();
    // A fresh copy per task, so every task gets its own subtask ids.
    await addTasks(lines.map((line, i) => ({ ...base, title: line.slice(0, 500), createdAt: t + i, subtasks: finalDraftSubs(draft) })));
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
        <div className={'add-head' + (overflowing && scrolled ? ' is-scrolled' : '')}>
          <span className="add-head-icon" aria-hidden="true"><IconTaskAdd size={20} /></span>
          <h3 id={uid + 't'}>New task</h3>
          <button type="button" className="dlg-x" aria-label="Close" title="Close" onClick={close}><IconClose size={18} /></button>
        </div>

        <div ref={scrollRef} className={'add-scroll' + (overflowing ? ' is-overflowing' : '')} data-pop-room={overflowing ? '' : undefined}
          onScroll={e => setScrolled(e.currentTarget.scrollTop > 0)}>
          <div ref={scrollInnerRef} className="add-scroll-inner">
            <label className="field"><span><IconSubtasks size={14} />Task</span>
              <textarea ref={titleRef} className="input add-title" rows={1} placeholder="Type a task and press Enter" value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }} />
            </label>

            <ProjectSelect value={project} onChange={id => { setProject(id); writePref('ps.project', id); }} />

            <div className="add-body">
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

              {/* Always rendered so it can grow open: the window gets taller smoothly and stays centred */}
              <div className={'add-details' + (details ? ' is-open' : '')} inert={!details}>
                <div className="add-details-inner">
                  <div className="details-stack">
                    <label className="field"><span><IconDescription size={14} />Description</span>
                      <textarea ref={descRef} id="addDesc" className="input" rows={2} placeholder="Details, links, who to check with" value={desc} onChange={e => setDesc(e.target.value)} />
                    </label>
                    <div className="field">
                      <span className="fieldset-label"><IconSubtasks size={14} />Subtasks{subCount > 0 && <em className="add-subs-count">{subCount}</em>}</span>
                      <DraftSubtasks subs={subs} onChange={setSubs} />
                      <div className="sub-new">
                        <input ref={newSubRef} className="input" type="text" placeholder="Add a subtask and press Enter" aria-label="New subtask" maxLength={300}
                          value={newSub} onChange={e => setNewSub(e.target.value)} onPaste={e => pastedLines(e, newSub, addSubs)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); addSubs(newSub); }
                            else if (e.key === 'Backspace' && !newSub && subs.length && !subs[subs.length - 1].subtasks.length) { e.preventDefault(); setSubs(list => list.slice(0, -1)); }
                          }} />
                        <button className="ghost" type="button" onClick={() => addSubs(newSub)}><IconPlus size={16} />Add</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="dlg-foot add-foot">
          <button className="more" type="button" aria-expanded={details} onClick={toggleDetails}>
            {details ? <><IconMinus size={14} />Hide details</> : <><IconPlus size={14} />Description and subtasks{subCount > 0 && <em className="add-subs-count">{subCount}</em>}</>}
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
