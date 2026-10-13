// node:test — pure logic only (lib/tasks.mjs + lib/selectors.mjs + lib/schedule.mjs). No DOM.
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
  completeTodo,
  uncompleteTodo,
  setCompletedAt,
  formatTimeHM,
  combineDateAndTime,
  sanitizeTodo,
  addScheduledTodo,
  setSchedule,
  FILTER_ALL,
  FILTER_ACTIVE,
  FILTER_DONE,
} from '../lib/tasks.mjs';
import { filterTodos, countByStatus } from '../lib/selectors.mjs';
import {
  toISODate,
  parseISODate,
  monthGrid,
  groupByDate,
  appointmentsOn,
  upcoming,
  buildScheduledTs,
  formatShort,
} from '../lib/schedule.mjs';

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
  assert.equal(before.length, 1);
});

test('addTodo throws on empty title', () => {
  assert.throws(() => addTodo([], '   '), /INVALID_TITLE/);
});

test('toggleTodo flips only the target id', () => {
  const list = [createTodo(1, 'a', 0), createTodo(2, 'b', 0)];
  const out = toggleTodo(list, 2);
  assert.equal(out[1].done, true);
  assert.equal(out[0].done, false);
  assert.equal(list[1].done, false);
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

test('completeTodo marks done with chosen timestamp, immutable', () => {
  const list = [createTodo(1, 'a', 0)];
  const out = completeTodo(list, 1, 1718172600000);
  assert.equal(out[0].done, true);
  assert.equal(out[0].completedAt, 1718172600000);
  assert.equal(list[0].done, false);
});

test('completeTodo with unknown id keeps list unchanged', () => {
  const list = [createTodo(1, 'a', 0)];
  assert.deepEqual(completeTodo(list, 99, 123), list);
});

test('uncompleteTodo un-marks done and clears completedAt', () => {
  const list = completeTodo([createTodo(1, 'a', 0)], 1, 500);
  const out = uncompleteTodo(list, 1);
  assert.equal(out[0].done, false);
  assert.equal(out[0].completedAt, null);
});

test('setCompletedAt updates time and keeps item done', () => {
  const list = completeTodo([createTodo(1, 'a', 0)], 1, 500);
  const out = setCompletedAt(list, 1, 900);
  assert.equal(out[0].done, true);
  assert.equal(out[0].completedAt, 900);
  assert.deepEqual(setCompletedAt(list, 99, 900), list);
});

test('formatTimeHM renders zero-padded HH:mm', () => {
  assert.equal(formatTimeHM(new Date(2024, 5, 12, 9, 5).getTime()), '09:05');
  assert.equal(formatTimeHM(new Date(2024, 5, 12, 23, 59).getTime()), '23:59');
});

test('combineDateAndTime merges picked time into base day', () => {
  const base = new Date(2024, 5, 12, 8, 0).getTime();
  assert.equal(combineDateAndTime(base, '14:30'), new Date(2024, 5, 12, 14, 30).getTime());
  assert.equal(combineDateAndTime(base, '9:05'), new Date(2024, 5, 12, 9, 5).getTime());
});

test('combineDateAndTime rejects malformed input', () => {
  const base = new Date(2024, 5, 12, 8, 0).getTime();
  assert.equal(combineDateAndTime(base, '25:99'), null);
  assert.equal(combineDateAndTime(base, 'abc'), null);
  assert.equal(combineDateAndTime(base, ''), null);
  assert.equal(combineDateAndTime(base, null), null);
});

test('sanitizeTodo cleans stored objects, drops junk', () => {
  const good = sanitizeTodo({ id: '7', title: '  hoc bai ', done: true, createdAt: '10', completedAt: '999' });
  assert.deepEqual(good, { id: 7, title: 'hoc bai', done: true, createdAt: 10, completedAt: 999, scheduledAt: null });
  const defaults = sanitizeTodo({ id: 3, title: 'x' });
  assert.deepEqual(defaults, { id: 3, title: 'x', done: false, createdAt: 0, completedAt: null, scheduledAt: null });
  assert.equal(sanitizeTodo(null), null);
  assert.equal(sanitizeTodo({ title: 'no id' }), null);
  assert.equal(sanitizeTodo({ id: 4, title: '' }), null);
  assert.equal(sanitizeTodo('junk'), null);
});

test('sanitizeTodo keeps a valid scheduledAt', () => {
  const out = sanitizeTodo({ id: 5, title: 'gap', scheduledAt: '123456' });
  assert.equal(out.scheduledAt, 123456);
});

// --- scheduling API ---

test('addScheduledTodo creates todo with appointment time', () => {
  const out = addScheduledTodo([], 'hop ke toan', 1718172600000, 42);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], { id: 1, title: 'hop ke toan', done: false, createdAt: 42, scheduledAt: 1718172600000 });
  assert.throws(() => addScheduledTodo([], '  ', 1), /INVALID_TITLE/);
});

test('setSchedule sets and clears appointment, immutable', () => {
  const list = [createTodo(1, 'a', 0)];
  const set = setSchedule(list, 1, 777);
  assert.equal(set[0].scheduledAt, 777);
  assert.equal(list[0].scheduledAt, undefined);
  const cleared = setSchedule(set, 1, null);
  assert.equal(cleared[0].scheduledAt, null);
  assert.deepEqual(setSchedule(list, 99, 777), list);
});

// --- schedule.mjs ---

test('toISODate renders local YYYY-MM-DD', () => {
  assert.equal(toISODate(new Date(2024, 5, 4, 9, 30).getTime()), '2024-06-04');
});

test('parseISODate validates and rejects bad dates', () => {
  assert.equal(parseISODate('2024-06-12'), new Date(2024, 5, 12).getTime());
  assert.equal(parseISODate('2024-13-01'), null);
  assert.equal(parseISODate('2024-02-31'), null);
  assert.equal(parseISODate('abc'), null);
  assert.equal(parseISODate(null), null);
});

test('monthGrid returns 42 Monday-first cells for June 2024', () => {
  const cells = monthGrid(2024, 5); // June 2024, 1st = Saturday
  assert.equal(cells.length, 42);
  assert.equal(cells[0].iso, '2024-05-27'); // Monday of the first week
  assert.equal(cells.filter((c) => c.inMonth).length, 30);
  assert.equal(cells.some((c) => c.iso === '2024-06-01'), true);
  assert.equal(cells.some((c) => c.iso === '2024-06-30'), true);
});

test('monthGrid handles Sunday-start months (Dec 2024)', () => {
  const cells = monthGrid(2024, 11); // Dec 1 2024 = Sunday
  assert.equal(cells[0].iso, '2024-11-25'); // previous Monday
  assert.equal(cells.filter((c) => c.inMonth).length, 31);
});

test('groupByDate groups only scheduled todos, keys sorted asc', () => {
  const a = { id: 1, title: 'a', done: false, scheduledAt: new Date(2024, 5, 12, 9, 0).getTime() };
  const b = { id: 2, title: 'b', done: false, scheduledAt: new Date(2024, 5, 10, 15, 0).getTime() };
  const c = { id: 3, title: 'c', done: false, scheduledAt: null };
  const map = groupByDate([a, b, c]);
  const keys = [...map.keys()];
  assert.deepEqual(keys, ['2024-06-10', '2024-06-12']);
  assert.equal(map.get('2024-06-10')[0].id, 2);
});

test('appointmentsOn returns the day sorted by time', () => {
  const early = { id: 1, title: 'a', done: false, scheduledAt: new Date(2024, 5, 12, 8, 0).getTime() };
  const late = { id: 2, title: 'b', done: false, scheduledAt: new Date(2024, 5, 12, 17, 0).getTime() };
  const other = { id: 3, title: 'c', done: false, scheduledAt: new Date(2024, 5, 13, 9, 0).getTime() };
  const out = appointmentsOn([late, other, early], '2024-06-12');
  assert.deepEqual(out.map((t) => t.id), [1, 2]);
});

test('upcoming returns next not-done appointments limited', () => {
  const now = new Date(2024, 5, 10, 12, 0).getTime();
  const past = { id: 1, title: 'a', done: false, scheduledAt: new Date(2024, 5, 10, 9, 0).getTime() };
  const soon = { id: 2, title: 'b', done: false, scheduledAt: new Date(2024, 5, 10, 15, 0).getTime() };
  const later = { id: 3, title: 'c', done: false, scheduledAt: new Date(2024, 5, 12, 9, 0).getTime() };
  const doneItem = { id: 4, title: 'd', done: true, scheduledAt: new Date(2024, 5, 10, 16, 0).getTime() };
  const out = upcoming([past, doneItem, later, soon], now, 5);
  assert.deepEqual(out.map((t) => t.id), [2, 3]);
  assert.deepEqual(upcoming([later], now, 1).map((t) => t.id), [3]);
});

test('buildScheduledTs merges date and optional time (default 09:00)', () => {
  assert.equal(
    buildScheduledTs('2024-06-12', '14:30'),
    new Date(2024, 5, 12, 14, 30).getTime()
  );
  assert.equal(
    buildScheduledTs('2024-06-12', null),
    new Date(2024, 5, 12, 9, 0).getTime()
  );
  assert.equal(buildScheduledTs('bad', '10:00'), null);
});

test('formatShort renders dd/mm HH:mm', () => {
  assert.equal(formatShort(new Date(2024, 5, 4, 9, 5).getTime()), '04/06 09:05');
});
