// node:test — pure logic only (lib/tasks.mjs + lib/selectors.mjs). No DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeText,
  validateTitle,
  createTodo,
  nextId,
  addTodo,
  toggleTodo,
  removeTodo,
  removeAllDone,
  FILTER_ALL,
  FILTER_ACTIVE,
  FILTER_DONE,
} from '../lib/tasks.mjs';
import { filterTodos, countByStatus } from '../lib/selectors.mjs';

test('normalizeText trims and collapses inner whitespace', () => {
  assert.equal(normalizeText('  hoc   node  test  '), 'hoc node test');
});

test('validateTitle rejects empty / whitespace / nullish', () => {
  assert.equal(validateTitle(''), null);
  assert.equal(validateTitle('   '), null);
  assert.equal(validateTitle(null), null);
});

test('validateTitle accepts trimmed non-empty text', () => {
  assert.equal(validateTitle('  mua sua  '), 'mua sua');
});

test('createTodo starts not done', () => {
  const t = createTodo(1, 'bai tap', 123);
  assert.deepEqual(t, { id: 1, title: 'bai tap', done: false, createdAt: 123 });
});

test('nextId returns max+1 even after gaps', () => {
  assert.equal(nextId([]), 1);
  const list = [createTodo(3, 'a', 0), createTodo(7, 'b', 0)];
  assert.equal(nextId(list), 8);
});

test('addTodo appends a not-done todo and does not mutate input', () => {
  const before = [createTodo(1, 'a', 0)];
  const after = addTodo(before, 'b', 42);
  assert.equal(after.length, 2);
  assert.equal(after[1].title, 'b');
  assert.equal(after[1].done, false);
  assert.equal(after[1].createdAt, 42);
  assert.equal(before.length, 1); // original untouched
});

test('addTodo throws on empty title', () => {
  assert.throws(() => addTodo([], '   '), /INVALID_TITLE/);
});

test('toggleTodo flips only the target id', () => {
  const list = [createTodo(1, 'a', 0), createTodo(2, 'b', 0)];
  const out = toggleTodo(list, 2);
  assert.equal(out[1].done, true);
  assert.equal(out[0].done, false);
  assert.equal(list[1].done, false); // immutable
});

test('toggleTodo with unknown id keeps list unchanged', () => {
  const list = [createTodo(1, 'a', 0)];
  assert.deepEqual(toggleTodo(list, 99), list);
});

test('removeTodo deletes by id only', () => {
  const list = [createTodo(1, 'a', 0), createTodo(2, 'b', 0)];
  const out = removeTodo(list, 1);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 2);
});

test('removeAllDone removes only completed items', () => {
  const list = [createTodo(1, 'a', 0), createTodo(2, 'b', 0)];
  const done = toggleTodo(list, 2);
  const out = removeAllDone(done);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 1);
});

test('filterTodos supports all/active/done and defaults unknown to all', () => {
  const list = [createTodo(1, 'a', 0), createTodo(2, 'b', 0)];
  const mixed = toggleTodo(list, 2);
  assert.equal(filterTodos(mixed, FILTER_ALL).length, 2);
  assert.equal(filterTodos(mixed, FILTER_ACTIVE).length, 1);
  assert.equal(filterTodos(mixed, FILTER_DONE)[0].id, 2);
  assert.equal(filterTodos(mixed, 'garbage').length, 2);
});

test('countByStatus reports total/active/done', () => {
  const list = [createTodo(1, 'a', 0), createTodo(2, 'b', 0), createTodo(3, 'c', 0)];
  const mixed = toggleTodo(list, 3);
  assert.deepEqual(countByStatus(mixed), { total: 3, active: 2, done: 1 });
  assert.deepEqual(countByStatus([]), { total: 0, active: 0, done: 0 });
});
