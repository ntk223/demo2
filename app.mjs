// DOM wiring only — all logic lives in lib/ (tested there).
import {
  normalizeText,
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
  FILTER_ALL,
  FILTER_ACTIVE,
  FILTER_DONE,
} from './lib/tasks.mjs';
import { filterTodos, countByStatus } from './lib/selectors.mjs';

const STORAGE_KEY = 'todo-tracker.v1';
const FILTERS = [FILTER_ALL, FILTER_ACTIVE, FILTER_DONE];
const $ = (sel) => document.querySelector(sel);

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      todos: (Array.isArray(raw.todos) ? raw.todos : [])
        .map(sanitizeTodo)
        .filter(Boolean),
      filter: FILTERS.includes(raw.filter) ? raw.filter : FILTER_ALL,
    };
  } catch {
    return { todos: [], filter: FILTER_ALL };
  }
}

let state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function render() {
  const visible = filterTodos(state.todos, state.filter);
  const counts = countByStatus(state.todos);

  const list = $('#todo-list');
  list.replaceChildren();
  for (const todo of visible) {
    const li = document.createElement('li');
    li.dataset.id = String(todo.id);
    if (todo.done) li.className = 'done';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = todo.done;
    check.dataset.action = 'toggle';
    check.setAttribute('aria-label', 'Hoàn thành');

    const label = document.createElement('span');
    label.className = 'title';
    label.textContent = todo.title;

    li.append(check, label);

    if (todo.done) {
      const when = document.createElement('span');
      when.className = 'when';
      when.textContent = '✓ ' + formatTimeHM(todo.completedAt || Date.now());

      const timeEdit = document.createElement('input');
      timeEdit.type = 'time';
      timeEdit.className = 'time-edit';
      timeEdit.value = formatTimeHM(todo.completedAt || Date.now());
      timeEdit.dataset.action = 'set-time';
      timeEdit.setAttribute('aria-label', 'Chọn giờ hoàn thành');

      li.append(when, timeEdit);
    }

    const del = document.createElement('button');
    del.textContent = '✕';
    del.dataset.action = 'remove';
    del.setAttribute('aria-label', 'Xoá');

    li.append(del);
    list.append(li);
  }

  $('#count-total').textContent = String(counts.total);
  $('#count-active').textContent = String(counts.active);
  $('#count-done').textContent = String(counts.done);
  $('#empty-hint').hidden = visible.length !== 0;

  for (const btn of document.querySelectorAll('[data-filter]')) {
    btn.classList.toggle('active', btn.dataset.filter === state.filter);
  }
}

function mutate(fn) {
  state = { ...state, todos: fn(state.todos) };
  saveState();
  render();
}

document.addEventListener('DOMContentLoaded', () => {
  $('#todo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#todo-input');
    const title = normalizeText(input.value);
    if (!title) return;
    mutate((todos) => addTodo(todos, title, Date.now()));
    input.value = '';
    input.focus();
  });

  $('#todo-list').addEventListener('click', (e) => {
    if (e.target.dataset.action !== 'remove') return;
    const id = Number(e.target.closest('li').dataset.id);
    mutate((todos) => removeTodo(todos, id));
  });

  $('#todo-list').addEventListener('change', (e) => {
    const action = e.target.dataset.action;
    const id = Number(e.target.closest('li').dataset.id);
    if (action === 'toggle') {
      mutate((todos) =>
        e.target.checked ? completeTodo(todos, id, Date.now()) : uncompleteTodo(todos, id)
      );
      return;
    }
    if (action === 'set-time') {
      const todo = state.todos.find((t) => t.id === id);
      const base = (todo && todo.completedAt) || Date.now();
      const ts = combineDateAndTime(base, e.target.value);
      if (ts) mutate((todos) => setCompletedAt(todos, id, ts));
      else render(); // invalid pick — revert display
    }
  });

  for (const btn of document.querySelectorAll('[data-filter]')) {
    btn.addEventListener('click', () => {
      state = { ...state, filter: btn.dataset.filter };
      saveState();
      render();
    });
  }

  $('#clear-done').addEventListener('click', () => mutate(removeAllDone));

  render();
});
