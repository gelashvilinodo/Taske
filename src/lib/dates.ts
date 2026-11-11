// Date helpers. Days are stored as local "YYYY-MM-DD" strings; the board shows the full week, Monday–Sunday.

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAYS_S = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEK_LEN = 7;
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const parse = (s: string) => {
  const p = s.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
};
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const weekday = (d: Date) => (d.getDay() + 6) % 7;
export const mondayOf = (d: Date) => addDays(d, -weekday(d));
export const today = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};
/** The Monday of the current week (weekends included, so Saturday and Sunday stay in this week). */
export const planningMonday = () => mondayOf(today());
/** Sunday of the week that starts on the given Monday. */
export const weekEnd = (monday: Date) => addDays(monday, WEEK_LEN - 1);
export const isoWeek = (monday: Date) => {
  const th = addDays(monday, 3);
  const doy = Math.round((th.getTime() - new Date(th.getFullYear(), 0, 1).getTime()) / 864e5);
  return Math.floor(doy / 7) + 1;
};
export const shortDate = (d: Date) => d.getDate() + ' ' + MONTHS_S[d.getMonth()];
export const rangeLabel = (from: Date, to: Date, names: string[]) =>
  from.getMonth() === to.getMonth()
    ? from.getDate() + '–' + to.getDate() + ' ' + names[to.getMonth()]
    : from.getDate() + ' ' + names[from.getMonth()] + ' – ' + to.getDate() + ' ' + names[to.getMonth()];
export const isDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parse(s).getTime());
export const weekDays = (monday: Date) => Array.from({ length: WEEK_LEN }, (_, i) => addDays(monday, i));
export const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
/** Mondays of the weeks that overlap the given month. */
export const monthWeeks = (first: Date) => {
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const out: Date[] = [];
  for (let m = mondayOf(first); m <= last; m = addDays(m, 7)) if (weekEnd(m) >= first) out.push(m);
  return out;
};
export const commentTime = (ms: number) => {
  const d = new Date(ms);
  return shortDate(d) + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
};
