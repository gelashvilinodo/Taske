/**
 * While a task card is being dragged (and until its drop has landed), data fetched from the store is
 * held back: a reload in the middle would rebuild every card on the board and could change the task
 * being moved. The reload runs as soon as the drag is over.
 */
let held = false;
export const holdSync = (on: boolean) => { held = on; };
export const syncHeld = () => held;
