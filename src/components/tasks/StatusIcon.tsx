import { IconFlag } from '@/components/shell/icons';

/** The tick (done) or cross (canceled) drawn inside a round status check. */
export function SubMark({ status }: { status: string }) {
  if (status === 'done') return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 8.4 7 10.8l4.6-5.3" /></svg>;
  if (status === 'canceled') return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" /></svg>;
  return null;
}

const STATUS_IDS = ['todo', 'doing', 'done', 'canceled'];
const PRIORITY_IDS = ['urgent', 'high', 'low', ''];

/**
 * Coloured icon for a status or priority menu entry: the round status check
 * (grey ring, half purple, green tick, grey cross) or the priority flag (red, amber, grey, faint).
 */
export function MenuIcon({ id }: { id: string }) {
  if (STATUS_IDS.includes(id)) return <span className={'sub-check menu-ic s-' + id} aria-hidden="true"><SubMark status={id} /></span>;
  if (PRIORITY_IDS.includes(id)) return <span className={'menu-ic menu-flag ' + (id ? 'pr-' + id : 'none')} aria-hidden="true"><IconFlag size={14} /></span>;
  return null;
}
