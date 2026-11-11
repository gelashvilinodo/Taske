// Date helpers. Days are stored as local "YYYY-MM-DD" strings; the board shows Monday–Friday.

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const DAYS_S = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
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
/** The Monday of the week being planned: this week on weekdays, next week on weekends. */
export const planningMonday = () => {
  const t = today();
  return weekday(t) >= 5 ? addDays(mondayOf(t), 7) : mondayOf(t);
};
/** Weekend dates move to the following Monday. */
export const snapWeekday = (d: Date) => (weekday(d) >= 5 ? addDays(mondayOf(d), 7) : d);
export const isoWeek = (monday: Date) => {
  const th = addDays(monday, 3);
  const doy = Math.round((th.getTime() - new Date(th.getFullYear(), 0, 1).getTime()) / 864e5);
  return Math.floor(doy / 7) + 1;
};
export const shortDate = (d: Date) => d.getDate() + ' ' + MONTHS_S[d.getMonth()];
export const rangeLabel = (mon: Date, fri: Date, names: string[]) =>
  mon.getMonth() === fri.getMonth()
    ? mon.getDate() + '–' + fri.getDate() + ' ' + names[fri.getMonth()]
    : mon.getDate() + ' ' + names[mon.getMonth()] + ' – ' + fri.getDate() + ' ' + names[fri.getMonth()];
export const isDate = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parse(s).getTime());
export const weekDays = (monday: Date) => [0, 1, 2, 3, 4].map(i => addDays(monday, i));
export const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
/** Mondays of the work weeks that overlap the given month. */
export const monthWeeks = (first: Date) => {
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const out: Date[] = [];
  for (let m = mondayOf(first); m <= last; m = addDays(m, 7)) if (addDays(m, 4) >= first) out.push(m);
  return out;
};
export const commentTime = (ms: number) => {
  const d = new Date(ms);
  return shortDate(d) + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
};
