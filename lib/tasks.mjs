// Pure task-domain logic. No DOM, no I/O — fully unit-testable.

export const FILTER_ALL = 'all';
export const FILTER_ACTIVE = 'active';
export const FILTER_DONE = 'done';

/** Trim + collapse inner whitespace. */
export function normalizeText(raw) {
  return String(raw == null ? '' : raw).trim().replace(/\s+/g, ' ');
}

/** Returns a valid title (1..200 chars) or null. */
export function validateTitle(raw) {
  const title = normalizeText(raw);
  return title.length >= 1 && title.length <= 200 ? title : null;
}

/** Plain todo object; new items always start not done. */
export function createTodo(id, title, createdAt) {
  return { id, title, done: false, createdAt };
}

/** Smallest free id (max + 1) — safe after deletions. */
export function nextId(todos) {
  return todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;
}

/** Append a todo; returns a NEW array. Throws Error('INVALID_TITLE'). */
export function addTodo(todos, rawTitle, createdAt = Date.now()) {
  const title = validateTitle(rawTitle);
  if (!title) throw new Error('INVALID_TITLE');
  return [...todos, createTodo(nextId(todos), title, createdAt)];
}

/** Flip done for exactly one id; returns a NEW array. */
export function toggleTodo(todos, id) {
  return todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
}

/** Drop one id; returns a NEW array. */
export function removeTodo(todos, id) {
  return todos.filter((t) => t.id !== id);
}

/** Drop every completed item; returns a NEW array. */
export function removeAllDone(todos) {
  return todos.filter((t) => !t.done);
}

// --- completion time ---

/** Mark done at a chosen moment; returns a NEW array. */
export function completeTodo(todos, id, completedAt = Date.now()) {
  return todos.map((t) => (t.id === id ? { ...t, done: true, completedAt } : t));
}

/** Un-mark done and clear the completion time; returns a NEW array. */
export function uncompleteTodo(todos, id) {
  return todos.map((t) =>
    t.id === id ? { ...t, done: false, completedAt: null } : t
  );
}

/** Update the completion time of a done item; returns a NEW array. */
export function setCompletedAt(todos, id, completedAt) {
  return todos.map((t) => (t.id === id ? { ...t, done: true, completedAt } : t));
}

/** Format a timestamp as zero-padded local "HH:mm". */
export function formatTimeHM(ts) {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return hh + ':' + mm;
}

/** Merge a "HH:mm" pick into the calendar day of baseTs. Returns ts or null. */
export function combineDateAndTime(baseTs, timeStr) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(timeStr == null ? '' : timeStr));
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  const d = new Date(baseTs);
  d.setHours(hh, mm, 0, 0);
  return d.getTime();
}

/** Normalize one stored todo; returns a clean object or null if unusable. */
export function sanitizeTodo(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = Number(raw.id);
  const title = validateTitle(raw.title);
  if (!Number.isFinite(id) || id <= 0 || !title) return null;
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    id,
    title,
    done: raw.done === true,
    createdAt: num(raw.createdAt) ?? 0,
    completedAt: num(raw.completedAt),
  };
}
