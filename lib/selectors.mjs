// Read-only selectors over the todo list. No mutation, no DOM.

import { FILTER_ALL, FILTER_ACTIVE, FILTER_DONE } from './tasks.mjs';

/** View for a filter chip; unknown filter falls back to all. */
export function filterTodos(todos, filter = FILTER_ALL) {
  if (filter === FILTER_ACTIVE) return todos.filter((t) => !t.done);
  if (filter === FILTER_DONE) return todos.filter((t) => t.done);
  return [...todos];
}

/** { total, active, done } counters. */
export function countByStatus(todos) {
  const done = todos.reduce((n, t) => n + (t.done ? 1 : 0), 0);
  return { total: todos.length, active: todos.length - done, done };
}
