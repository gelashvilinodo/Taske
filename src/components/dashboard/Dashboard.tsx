'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { DAYS, DAYS_S, iso, parse, shortDate, today } from '@/lib/dates';
import type { StatusId, Task } from '@/lib/tasks/model';
import { drillHref, type Drill } from '@/lib/tasks/drill';
import {
  computeStats, daysIn, dueOf, finishTimes, overdueNow, periodLabel, periodOf, PERIOD_UNITS, previousName, shiftPeriod,
  upcomingDeadlines, type PeriodUnit, type Range,
} from '@/lib/tasks/stats';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { ProjectLogo } from '@/components/projects/ProjectBadge';
import Dropdown from '@/components/ui/Dropdown';
import DatePicker from '@/components/ui/DatePicker';
import {
  IconAlert, IconCalendar, IconChevronRight, IconDoing, IconDone, IconFlag, IconNext, IconPrev, IconSubtasks, IconTaskAdd, IconToday,
} from '@/components/shell/icons';
import { BarList, Columns, Donut, type BarRow } from './charts';

const UNIT_KEY = 'ps.dash.unit';
const ALL = 'all';
/** Tasks without a project; the same id the project pills use. */
const NONE = '__other';

/** Status and timing colours, the same ones the stat cards and task cards use. */
const TONE = {
  done: 'var(--color-ok)',
  doing: 'var(--color-accent)',
  todo: 'var(--color-faint)',
  canceled: 'var(--pearl-400)',
  late: 'var(--color-warn)',
  overdue: 'var(--color-bad)',
};

type Label = ReturnType<typeof periodLabel>;

/** The period title; slides sideways when the period changes, like the week title on the board. */
function PeriodTitle({ at, label }: { at: number; label: Label }) {
  const shown = useRef({ at, label });
  const [leaving, setLeaving] = useState<{ at: number; label: Label; dir: 'next' | 'prev' } | null>(null);
  useLayoutEffect(() => {
    const prev = shown.current;
    if (prev.at === at) return;
    setLeaving({ ...prev, dir: at > prev.at ? 'next' : 'prev' });
    shown.current = { at, label };
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps
  const slide = (l: Label, cls?: string, done?: () => void) => (
    <div className={'period-slide' + (cls ? ' ' + cls : '')} onAnimationEnd={done} aria-hidden={done ? true : undefined}>
      <span className="eyebrow">{l.eyebrow}</span>
      <h2><span className="period-full">{l.full}</span><span className="period-short">{l.short}</span></h2>
    </div>
  );
  return (
    <div className="period" aria-live="polite">
      {leaving && slide(leaving.label, 'is-out is-' + leaving.dir, () => setLeaving(null))}
      {slide(label, leaving ? 'is-in is-' + leaving.dir : undefined)}
    </div>
  );
}

/** Week / Month / Quarter / Year / Custom, with a glowing thumb that slides to the picked one. */
function UnitSwitch({ unit, onPick }: { unit: PeriodUnit; onPick: (u: PeriodUnit) => void }) {
  const group = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number; n: number } | null>(null);
  useLayoutEffect(() => {
    const place = () => {
      const el = group.current?.querySelector<HTMLElement>('button[aria-pressed="true"]');
      if (!el) return;
      setThumb(prev => (prev && prev.x === el.offsetLeft && prev.w === el.offsetWidth ? prev
        : { x: el.offsetLeft, w: el.offsetWidth, n: prev ? prev.n + 1 : 0 }));
    };
    place();
    const ro = new ResizeObserver(place);
    if (group.current) ro.observe(group.current);
    return () => ro.disconnect();
  }, [unit]);
  return (
    <div className="seg theme-seg dash-units" role="group" aria-label="Period" ref={group}>
      {thumb && (
        <span className={'seg-thumb' + (thumb.n ? ' is-animated' : '')} aria-hidden="true" style={{ width: thumb.w, transform: `translateX(${thumb.x}px)` }}>
          <span className="seg-thumb-core" key={thumb.n} />
        </span>
      )}
      {PERIOD_UNITS.map(u => (
        <button key={u.id} type="button" aria-pressed={unit === u.id} onClick={() => onPick(u.id)}>{u.name}</button>
      ))}
    </div>
  );
}

/** "+3 vs last week" chip: green when it went the good way, red when not. */
function Delta({ now, before, unit, invert = false, neutral = false, suffix = '' }: { now: number; before: number; unit: PeriodUnit; invert?: boolean; neutral?: boolean; suffix?: string }) {
  const d = now - before;
  if (!d) return <span className="delta">Same as {previousName(unit)}</span>;
  const good = invert ? d < 0 : d > 0;
  return <span className={'delta' + (neutral ? '' : good ? ' is-good' : ' is-bad')}>{(d > 0 ? '+' : '−') + Math.abs(d) + suffix} vs {previousName(unit)}</span>;
}

/** "Open" link in a card's header: the card's tasks, in full, on the Table page. */
const OpenLink = ({ href, what }: { href: string; what: string }) => (
  <Link href={href} className="dcard-open" aria-label={'Open ' + what + ' in Table'}>Open<IconChevronRight size={14} /></Link>
);

const dueText = (t: Task, todayIso: string) => {
  const due = dueOf(t);
  const n = Math.round((parse(due).getTime() - parse(todayIso).getTime()) / 864e5);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n < 0 ? -n + ' days late' : shortDate(parse(due));
};

/**
 * Home page: how the tasks in the chosen period are going. Numbers on top, then charts:
 * planned against done over time, status and deadline donuts, projects, priorities and
 * weekdays, and the tasks that need attention right now.
 */
export default function Dashboard() {
  const { tasks, projects, projectById, history, historyState, loadHistory, loaded, openPreview } = useWorkspace();
  const [unit, setUnit] = useState<PeriodUnit>('week');
  const [range, setRange] = useState<Range>(() => periodOf('week', today()));
  const [project, setProject] = useState(ALL);

  // The last period kind picked is remembered on this device.
  useEffect(() => {
    try {
      const u = localStorage.getItem(UNIT_KEY) as PeriodUnit | null;
      if (u && u !== 'custom' && PERIOD_UNITS.some(x => x.id === u)) { setUnit(u); setRange(periodOf(u, today())); }
    } catch { /* storage blocked */ }
  }, []);
  // Finish times (for "late") come from the history log.
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const pickUnit = (u: PeriodUnit) => {
    setUnit(u);
    if (u !== 'custom') setRange(periodOf(u, today()));
    else setRange(r => (daysIn(r) > 1 ? r : periodOf('month', today())));
    try { localStorage.setItem(UNIT_KEY, u); } catch { /* storage blocked */ }
  };
  const shift = (dir: number) => setRange(r => shiftPeriod(unit, r, dir));
  const now = () => { if (unit !== 'custom') setRange(periodOf(unit, today())); };
  const isNow = unit !== 'custom' && iso(periodOf(unit, today()).from) === iso(range.from);

  const todayIso = iso(today());
  const finished = useMemo(() => finishTimes(history), [history]);
  const known = useMemo(() => new Set(projects.map(p => p.id)), [projects]);
  const scoped = useMemo(() => (project === ALL ? tasks
    : project === NONE ? tasks.filter(t => !t.project || !known.has(t.project))
    : tasks.filter(t => t.project === project)), [tasks, project, known]);
  const stats = useMemo(() => computeStats(scoped, range, finished, todayIso), [scoped, range, finished, todayIso]);
  const prev = useMemo(() => computeStats(scoped, shiftPeriod(unit, range, -1), finished, todayIso), [scoped, unit, range, finished, todayIso]);
  const overdue = useMemo(() => overdueNow(scoped, todayIso), [scoped, todayIso]);
  const upcoming = useMemo(() => upcomingDeadlines(scoped, todayIso), [scoped, todayIso]);

  const label = periodLabel(unit, range);
  const s = stats;
  const lateAll = s.late + s.overdue;
  const prevLate = prev.late + prev.overdue;
  const noHistory = historyState === 'missing' || historyState === 'bad';

  const projectOptions = [
    { value: ALL, label: 'All projects' },
    ...projects.map(p => ({ value: p.id, label: p.name, leading: <ProjectLogo project={p} size="xs" /> })),
    ...(tasks.some(t => !t.project || !known.has(t.project)) ? [{ value: NONE, label: 'No project' }] : []),
  ];

  // Links into the Table page, filtered to what a number or chart part counts.
  const period = { from: iso(range.from), to: iso(range.to) };
  const ACTIVE: StatusId[] = ['todo', 'doing', 'done'];
  const to = (d: Drill, pj = project) => drillHref(d, pj);

  const kpis: { key: string; label: string; value: ReactNode; sub: string; Icon: typeof IconDone; tone: string; delta: ReactNode; meter?: number; alert?: boolean; href: string }[] = [
    { key: 'planned', label: 'Planned', value: s.active, sub: s.status.canceled ? `${s.status.canceled} canceled` : 'tasks in this period', Icon: IconCalendar, tone: 'var(--color-accent)',
      href: to({ ...period, status: ACTIVE }),
      delta: <Delta now={s.active} before={prev.active} unit={unit} neutral /> },
    { key: 'done', label: 'Completed', value: s.status.done, sub: s.rate + '% of planned', Icon: IconDone, tone: TONE.done, meter: s.rate,
      href: to({ ...period, status: ['done'] }),
      delta: <Delta now={s.status.done} before={prev.status.done} unit={unit} /> },
    { key: 'late', label: 'Late', value: lateAll, sub: `${s.late} finished late · ${s.overdue} overdue`, Icon: IconAlert, tone: lateAll ? TONE.overdue : 'var(--color-faint)', alert: lateAll > 0,
      href: to({ ...period, timing: ['late', 'overdue'] }),
      delta: <Delta now={lateAll} before={prevLate} unit={unit} invert /> },
    { key: 'ontime', label: 'On time', value: s.onTimeRate === null ? '—' : s.onTimeRate + '%', sub: `${s.onTime} of ${s.status.done + s.overdue} due so far`, Icon: IconFlag, tone: TONE.done, meter: s.onTimeRate ?? 0,
      href: to({ ...period, timing: ['on_time'] }),
      delta: s.onTimeRate !== null && prev.onTimeRate !== null ? <Delta now={s.onTimeRate} before={prev.onTimeRate} unit={unit} suffix="%" /> : <span className="delta">&nbsp;</span> },
    { key: 'doing', label: 'In progress', value: s.status.doing, sub: `${s.status.todo} still to do`, Icon: IconDoing, tone: TONE.doing,
      href: to({ ...period, status: ['doing'] }),
      delta: <Delta now={s.status.doing} before={prev.status.doing} unit={unit} neutral /> },
    { key: 'subs', label: 'Subtasks done', value: s.subtasks.done, sub: s.subtasks.total ? `of ${s.subtasks.total} subtasks` : 'no subtasks', Icon: IconSubtasks, tone: 'var(--purple-400)',
      meter: s.subtasks.total ? Math.round(s.subtasks.done / s.subtasks.total * 100) : 0,
      href: to({ ...period, subs: true }),
      delta: <Delta now={s.subtasks.done} before={prev.subtasks.done} unit={unit} /> },
  ];

  const bestWeekday = s.weekdays.some(Boolean) ? s.weekdays.indexOf(Math.max(...s.weekdays)) : -1;

  const projectRows: BarRow[] = s.projects.map(p => {
    const pj = projectById(p.id);
    const name = pj?.name ?? 'No project';
    return {
      key: p.id || NONE, name, value: p.done, total: p.total, tone: pj?.color ?? 'var(--color-faint)',
      label: <>{pj ? <ProjectLogo project={pj} size="xs" /> : <span className="hbar-dot" />}<span>{name}</span></>,
      extra: p.late ? p.late + ' late' : undefined,
      href: to({ ...period, status: ACTIVE }, p.id && pj ? p.id : NONE),
    };
  });
  const prioTone: Record<string, string> = { urgent: 'var(--color-bad)', high: 'var(--color-warn)', low: 'var(--color-accent)', '': 'var(--color-faint)' };
  const prioRows: BarRow[] = s.priorities.filter(p => p.total).map(p => ({
    key: p.id || 'none', name: p.name, value: p.done, total: p.total, tone: prioTone[p.id],
    label: <><IconFlag size={14} /><span>{p.name}</span></>,
    href: to({ ...period, status: ACTIVE, prio: [p.id || 'none'] }),
  }));

  const taskRow = (t: Task, kind: 'over' | 'soon') => {
    const pj = projectById(t.project);
    return (
      <li key={t.id}>
        <button type="button" className="dash-task" onClick={() => openPreview(t.id)} style={{ '--pj': pj?.color ?? 'var(--color-faint)' } as CSSProperties}>
          {pj ? <ProjectLogo project={pj} size="xs" /> : <span className="hbar-dot" />}
          <span className="dash-task-title">{t.title || 'Untitled'}</span>
          <span className={'dash-task-due' + (kind === 'over' ? ' is-bad' : '')}>{dueText(t, todayIso)}</span>
        </button>
      </li>
    );
  };

  return (
    <div className={'dash' + (loaded ? '' : ' is-loading')}>
      <div className="toolbar dash-toolbar">
        <div className="nav">
          <div className="nav-left">
            <button className="icon-btn" type="button" aria-label="Previous period" onClick={() => shift(-1)}><IconPrev /></button>
            <PeriodTitle at={range.from.getTime()} label={label} />
            <button className="icon-btn" type="button" aria-label="Next period" onClick={() => shift(1)}><IconNext /></button>
            {unit !== 'custom' && (
              <button className="ghost" type="button" onClick={now} disabled={isNow} aria-label="Back to the current period">
                <IconToday size={16} /><span className="dash-now">Now</span>
              </button>
            )}
          </div>
        </div>
        <div className="dash-controls">
          <UnitSwitch unit={unit} onPick={pickUnit} />
          <span id="dashProject" className="sr-only">Project</span>
          <Dropdown value={project} options={projectOptions} onChange={setProject} labelledBy="dashProject" className="dash-project" />
        </div>
      </div>

      {unit === 'custom' && (
        <div className="dash-custom panel">
          <label className="field"><span id="dashFrom">From</span>
            <DatePicker value={iso(range.from)} labelledBy="dashFrom" clearable={false}
              onChange={v => v && setRange(r => { const f = parse(v); return { from: f, to: f > r.to ? f : r.to }; })} />
          </label>
          <label className="field"><span id="dashTo">To</span>
            <DatePicker value={iso(range.to)} labelledBy="dashTo" clearable={false}
              onChange={v => v && setRange(r => { const t = parse(v); return { from: t < r.from ? t : r.from, to: t }; })} />
          </label>
        </div>
      )}

      <section className="dash-kpis" aria-label="Numbers for this period">
        {kpis.map(k => (
          <Link key={k.key} href={k.href} className={'dkpi' + (k.alert ? ' is-alert' : '')} style={{ '--tone': k.tone } as CSSProperties}
            aria-label={`${k.label}: ${k.value}, ${k.sub}. Open in Table`}>
            <div className="dkpi-head">
              <span className="dkpi-icon"><k.Icon size={18} /></span>
              <span className="dkpi-label">{k.label}</span>
              <IconChevronRight size={16} className="dkpi-go" />
            </div>
            <b className="dkpi-value">{k.value}</b>
            <span className="dkpi-sub">{k.sub}</span>
            {k.delta}
            {k.meter !== undefined && <span className="dkpi-meter" aria-hidden="true"><i style={{ width: k.meter + '%' }} /></span>}
          </Link>
        ))}
      </section>

      <div className="dash-grid">
        <section className="dcard dcard-wide" aria-labelledby="dcTrend">
          <header className="dcard-head">
            <div><h3 id="dcTrend">Planned vs done</h3><p>By the day each task is planned for</p></div>
            <div className="dcard-tools">
              <ul className="key">
                <li className="key-back">Planned</li><li className="key-front">Done</li><li className="key-flag">Late</li>
              </ul>
              <OpenLink href={to({ ...period, status: ACTIVE })} what="planned tasks" />
            </div>
          </header>
          <Columns label="Planned and done tasks over the period" backName="planned" frontName="done" flagName="late"
            cols={s.buckets.map(b => ({ key: b.bucket.key, label: b.bucket.label, tip: b.bucket.tip, minor: b.bucket.minor, back: b.planned, front: b.done, flag: b.late, now: b.bucket.from <= todayIso && b.bucket.to >= todayIso,
              href: to({ from: b.bucket.from, to: b.bucket.to, status: ACTIVE }) }))} />
        </section>

        <section className="dcard" aria-labelledby="dcStatus">
          <header className="dcard-head"><div><h3 id="dcStatus">Status</h3><p>Where the period’s tasks are now</p></div><OpenLink href={to(period)} what="all tasks of the period" /></header>
          <Donut label="Tasks by status" center={{ value: s.rate + '%', caption: 'done' }} slices={[
            { key: 'done', label: 'Done', value: s.status.done, tone: TONE.done, href: to({ ...period, status: ['done'] }) },
            { key: 'doing', label: 'In progress', value: s.status.doing, tone: TONE.doing, href: to({ ...period, status: ['doing'] }) },
            { key: 'todo', label: 'To do', value: s.status.todo, tone: TONE.todo, href: to({ ...period, status: ['todo'] }) },
            { key: 'canceled', label: 'Canceled', value: s.status.canceled, tone: TONE.canceled, href: to({ ...period, status: ['canceled'] }) },
          ]} />
        </section>

        <section className="dcard" aria-labelledby="dcTiming">
          <header className="dcard-head"><div><h3 id="dcTiming">Deadlines</h3><p>Due day: the deadline, or the planned day</p></div><OpenLink href={to({ ...period, timing: ['late', 'overdue'] })} what="late tasks" /></header>
          <Donut label="Tasks by timing" center={{ value: s.onTimeRate === null ? '—' : s.onTimeRate + '%', caption: 'on time' }} slices={[
            { key: 'ontime', label: 'Done on time', value: s.onTime, tone: TONE.done, href: to({ ...period, timing: ['on_time'] }) },
            { key: 'late', label: 'Done late', value: s.late, tone: TONE.late, href: to({ ...period, timing: ['late'] }) },
            { key: 'overdue', label: 'Overdue', value: s.overdue, tone: TONE.overdue, href: to({ ...period, timing: ['overdue'] }) },
            { key: 'open', label: 'Not due yet', value: s.status.todo + s.status.doing - s.overdue, tone: TONE.todo, href: to({ ...period, timing: ['open'] }) },
          ]} />
          {noHistory && <p className="dash-note">Finish times come from task history, which is not set up yet, so “done late” can’t be counted.</p>}
        </section>

        <section className="dcard" aria-labelledby="dcProjects">
          <header className="dcard-head"><div><h3 id="dcProjects">Projects</h3><p>Done out of planned</p></div><OpenLink href={to({ ...period, status: ACTIVE })} what="the period's tasks" /></header>
          <BarList rows={projectRows} empty="No tasks in this period." />
        </section>

        <section className="dcard" aria-labelledby="dcDays">
          <header className="dcard-head">
            <div><h3 id="dcDays">Best days</h3><p>{bestWeekday >= 0 ? `You finish the most on ${DAYS[bestWeekday]}` : 'Tasks finished on each weekday'}</p></div>
            <OpenLink href={to({ ...period, status: ['done'] })} what="finished tasks" />
          </header>
          <Columns label="Tasks finished by weekday" frontName="done"
            cols={s.weekdays.map((n, i) => ({ key: DAYS_S[i], label: DAYS_S[i], tip: DAYS[i], front: n, back: 0, best: i === bestWeekday,
              href: to({ ...period, wd: i }) }))} />
          {s.bestDay && <p className="dash-note">Best day: <Link className="dash-link" href={to({ ...period, fday: s.bestDay.day })}>{shortDate(parse(s.bestDay.day))}</Link>, {s.bestDay.done} done.</p>}
        </section>

        <section className="dcard" aria-labelledby="dcPrio">
          <header className="dcard-head"><div><h3 id="dcPrio">Priorities</h3><p>Done out of planned</p></div><OpenLink href={to({ ...period, status: ACTIVE })} what="the period's tasks" /></header>
          <BarList rows={prioRows} empty="No tasks in this period." />
        </section>

        <section className="dcard" aria-labelledby="dcOver">
          <header className="dcard-head">
            <div><h3 id="dcOver">Overdue now</h3><p>Open tasks past their due day</p></div>
            <div className="dcard-tools">
              {overdue.length > 0 && <span className="count-pill is-bad">{overdue.length}</span>}
              {overdue.length > 0 && <OpenLink href={to({ timing: ['overdue'] })} what="all overdue tasks" />}
            </div>
          </header>
          {overdue.length
            ? <ul className="dash-tasks">{overdue.slice(0, 6).map(t => taskRow(t, 'over'))}</ul>
            : <p className="dash-empty"><IconDone size={16} /> Nothing overdue. Nice.</p>}
          {overdue.length > 6 && <p className="dash-note"><Link className="dash-link" href={to({ timing: ['overdue'] })}>+{overdue.length - 6} more</Link></p>}
        </section>

        <section className="dcard" aria-labelledby="dcSoon">
          <header className="dcard-head">
            <div><h3 id="dcSoon">Coming up</h3><p>Deadlines in the next 7 days</p></div>
            <div className="dcard-tools">
              {upcoming.length > 0 && <span className="count-pill">{upcoming.length}</span>}
              {upcoming.length > 0 && <OpenLink href={to({ due: 7 })} what="upcoming deadlines" />}
            </div>
          </header>
          {upcoming.length
            ? <ul className="dash-tasks">{upcoming.slice(0, 6).map(t => taskRow(t, 'soon'))}</ul>
            : <p className="dash-empty"><IconTaskAdd size={16} /> No deadlines this week.</p>}
          {upcoming.length > 6 && <p className="dash-note"><Link className="dash-link" href={to({ due: 7 })}>+{upcoming.length - 6} more</Link></p>}
        </section>
      </div>
    </div>
  );
}
