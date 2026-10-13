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
