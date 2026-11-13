/** Fired by the header "+" and a column's "+" to open the New task window (optionally on a given day).
 *  Kept apart from the window itself, so the buttons don't pull its code into the first page load. */
export const ADD_ON_DAY = 'ps:add-on-day';
export const requestAddOnDay = (day: string) => window.dispatchEvent(new CustomEvent(ADD_ON_DAY, { detail: day }));
