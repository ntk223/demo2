// DOM wiring only — all logic lives in lib/ (tested there).
import {
  normalizeText,
  addTodo,
  toggleTodo,
  removeTodo,
  removeAllDone,
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
      todos: Array.isArray(raw.todos) ? raw.todos : [],
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
    label.textContent = todo.title;

    const del = document.createElement('button');
    del.textContent = '✕';
    del.dataset.action = 'remove';
    del.setAttribute('aria-label', 'Xoá');

    li.append(check, label, del);
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
    if (e.target.dataset.action !== 'toggle') return;
    const id = Number(e.target.closest('li').dataset.id);
    mutate((todos) => toggleTodo(todos, id));
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
