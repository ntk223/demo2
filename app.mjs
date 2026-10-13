// DOM wiring only — all logic lives in lib/ (tested there).
import {
  normalizeText,
  addTodo,
  addScheduledTodo,
  removeTodo,
  removeAllDone,
  completeTodo,
  uncompleteTodo,
  setCompletedAt,
  setSchedule,
  formatTimeHM,
  combineDateAndTime,
  sanitizeTodo,
  FILTER_ALL,
  FILTER_ACTIVE,
  FILTER_DONE,
} from './lib/tasks.mjs';
import {
  toISODate,
  monthGrid,
  groupByDate,
  appointmentsOn,
  upcoming,
  buildScheduledTs,
  formatShort,
} from './lib/schedule.mjs';
import { filterTodos, countByStatus } from './lib/selectors.mjs';

const STORAGE_KEY = 'todo-tracker.v1';
const FILTERS = [FILTER_ALL, FILTER_ACTIVE, FILTER_DONE];
const $ = (sel) => document.querySelector(sel);

function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const now = new Date();
    return {
      todos: (Array.isArray(raw.todos) ? raw.todos : []).map(sanitizeTodo).filter(Boolean),
      filter: FILTERS.includes(raw.filter) ? raw.filter : FILTER_ALL,
      calYear: now.getFullYear(),
      calMonth: now.getMonth(),
      selectedDate: null,
      editingId: null,
    };
  } catch {
    const now = new Date();
    return { todos: [], filter: FILTER_ALL, calYear: now.getFullYear(), calMonth: now.getMonth(), selectedDate: null, editingId: null };
  }
}

let state = loadState();

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ todos: state.todos, filter: state.filter }));
  } catch {}
}

function isOverdue(todo) {
  return !todo.done && todo.scheduledAt != null && todo.scheduledAt < Date.now();
}

/* ---------- main list ---------- */

function renderList() {
  const visible = filterTodos(state.todos, state.filter);
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

    if (!todo.done && todo.scheduledAt != null) {
      const badge = document.createElement('span');
      badge.className = 'badge sched' + (isOverdue(todo) ? ' overdue' : '');
      badge.textContent = '📅 ' + formatShort(todo.scheduledAt);
      badge.dataset.action = 'edit-sched';
      badge.title = 'Bấm để đổi lịch hẹn';
      li.append(badge);
    }

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
    } else if (state.editingId === todo.id) {
      li.append(buildScheduleEditor(li, todo));
    }

    const del = document.createElement('button');
    del.textContent = 'Xoá';
    del.dataset.action = 'remove';
    del.setAttribute('aria-label', 'Xoá');

    li.append(del);
    list.append(li);
  }

  $('#empty-hint').hidden = visible.length !== 0;
}

/** Inline date+time editor; updates state + badge without re-rendering. */
function buildScheduleEditor(li, todo) {
  const box = document.createElement('div');
  box.className = 'sched-edit';

  const dateIn = document.createElement('input');
  dateIn.type = 'date';
  dateIn.value = todo.scheduledAt != null ? toISODate(todo.scheduledAt) : '';

  const timeIn = document.createElement('input');
  timeIn.type = 'time';
  timeIn.value = todo.scheduledAt != null ? formatTimeHM(todo.scheduledAt) : '09:00';

  const close = document.createElement('button');
  close.textContent = 'Xong';
  close.dataset.action = 'sched-close';

  const apply = () => {
    let badge = li.querySelector('.badge.sched');
    if (dateIn.value) {
      const ts = buildScheduledTs(dateIn.value, timeIn.value || null);
      if (!ts) return;
      state = { ...state, todos: setSchedule(state.todos, todo.id, ts) };
      saveState();
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'badge sched';
        badge.dataset.action = 'edit-sched';
        li.insertBefore(badge, li.querySelector('button'));
      }
      badge.textContent = '📅 ' + formatShort(ts);
      badge.classList.remove('overdue');
    } else if (badge) {
      state = { ...state, todos: setSchedule(state.todos, todo.id, null) };
      saveState();
      badge.remove();
    }
  };

  dateIn.addEventListener('change', apply);
  timeIn.addEventListener('change', apply);
  box.append(dateIn, timeIn, close);
  return box;
}

/* ---------- calendar ---------- */

function renderCalendar() {
  const { calYear: y, calMonth: m } = state;
  $('#cal-title').textContent = `Tháng ${m + 1} · ${y}`;

  const apptDays = new Set(groupByDate(state.todos).keys());
  const todayIso = toISODate(Date.now());
  const grid = $('#cal-grid');
  grid.replaceChildren();

  for (const cell of monthGrid(y, m)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-cell';
    btn.textContent = String(new Date(cell.ts).getDate());
    btn.dataset.calDay = cell.iso;
    if (!cell.inMonth) btn.classList.add('out');
    if (cell.iso === todayIso) btn.classList.add('today');
    if (cell.iso === state.selectedDate) btn.classList.add('selected');
    if (apptDays.has(cell.iso)) btn.classList.add('has-appt');
    grid.append(btn);
  }
}

/* ---------- day / upcoming panel ---------- */

function renderDayPanel() {
  const title = $('#day-title');
  const listEl = $('#day-list');
  listEl.replaceChildren();

  let items;
  if (state.selectedDate) {
    const d = new Date(state.selectedDate + 'T00:00:00');
    title.textContent = `📅 Ngày ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    items = appointmentsOn(state.todos, state.selectedDate);
  } else {
    title.textContent = 'Sắp tới';
    items = upcoming(state.todos, Date.now(), 5);
  }

  for (const todo of items) {
    const li = document.createElement('li');
    if (todo.done) li.className = 'done';

    const check = document.createElement('input');
    check.type = 'checkbox';
    check.checked = todo.done;
    check.dataset.dayToggle = '1';
    check.dataset.id = String(todo.id);

    const time = document.createElement('span');
    time.className = 'appt-time';
    time.textContent = todo.scheduledAt != null ? formatShort(todo.scheduledAt) : '';

    const label = document.createElement('span');
    label.className = 'title';
    label.textContent = todo.title;

    li.append(check, time, label);
    listEl.append(li);
  }

  if (items.length === 0) {
    const p = document.createElement('p');
    p.className = 'day-empty';
    p.textContent = 'Không có lịch hẹn nào.';
    listEl.append(p);
  }
}

/* ---------- misc render ---------- */

function renderStats() {
  const counts = countByStatus(state.todos);
  $('#count-total').textContent = String(counts.total);
  $('#count-active').textContent = String(counts.active);
  $('#count-done').textContent = String(counts.done);
}

function renderHeader() {
  const now = new Date();
  $('#today-chip').textContent = 'Hôm nay, ' + now.toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function render() {
  renderStats();
  renderList();
  renderCalendar();
  renderDayPanel();
  for (const btn of document.querySelectorAll('[data-filter]')) {
    btn.classList.toggle('active', btn.dataset.filter === state.filter);
  }
}

function mutate(fn) {
  state = { ...state, todos: fn(state.todos) };
  saveState();
  render();
}

/* Time edits must NOT rebuild the list: pickers fire input/change repeatedly
   while the user is still interacting, and a re-render destroys the picker. */
function handleTimePick(e) {
  if (e.target.dataset.action !== 'set-time') return;
  const id = Number(e.target.closest('li').dataset.id);
  const todo = state.todos.find((t) => t.id === id);
  const base = (todo && todo.completedAt) || Date.now();
  const ts = combineDateAndTime(base, e.target.value);
  if (!ts) return;
  state = { ...state, todos: setCompletedAt(state.todos, id, ts) };
  saveState();
  const when = e.target.closest('li').querySelector('.when');
  if (when) when.textContent = '✓ ' + formatTimeHM(ts);
}

document.addEventListener('DOMContentLoaded', () => {
  renderHeader();

  $('#todo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#todo-input');
    const title = normalizeText(input.value);
    if (!title) return;
    const dateVal = $('#sched-date').value;
    const timeVal = $('#sched-time').value;
    if (dateVal) {
      const ts = buildScheduledTs(dateVal, timeVal || null);
      mutate((todos) => addScheduledTodo(todos, title, ts, Date.now()));
    } else {
      mutate((todos) => addTodo(todos, title, Date.now()));
    }
    input.value = '';
    $('#sched-date').value = '';
    $('#sched-time').value = '';
    input.focus();
  });

  $('#todo-list').addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'remove') {
      const id = Number(e.target.closest('li').dataset.id);
      mutate((todos) => removeTodo(todos, id));
    } else if (action === 'edit-sched') {
      const id = Number(e.target.closest('li').dataset.id);
      state = { ...state, editingId: state.editingId === id ? null : id };
      render();
    } else if (action === 'sched-close') {
      state = { ...state, editingId: null };
      render();
    }
  });

  $('#todo-list').addEventListener('change', (e) => {
    if (e.target.dataset.action === 'set-time') {
      handleTimePick(e);
      return;
    }
    if (e.target.dataset.action !== 'toggle') return;
    const id = Number(e.target.closest('li').dataset.id);
    mutate((todos) =>
      e.target.checked ? completeTodo(todos, id, Date.now()) : uncompleteTodo(todos, id)
    );
  });

  $('#todo-list').addEventListener('input', handleTimePick);

  for (const btn of document.querySelectorAll('[data-filter]')) {
    btn.addEventListener('click', () => {
      state = { ...state, filter: btn.dataset.filter };
      saveState();
      render();
    });
  }

  $('#clear-done').addEventListener('click', () => mutate(removeAllDone));

  $('#cal-prev').addEventListener('click', () => {
    if (--state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
    render();
  });
  $('#cal-next').addEventListener('click', () => {
    if (++state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
    render();
  });

  $('#cal-grid').addEventListener('click', (e) => {
    const iso = e.target.dataset.calDay;
    if (!iso) return;
    state = { ...state, selectedDate: state.selectedDate === iso ? null : iso };
    render();
  });

  $('#day-list').addEventListener('change', (e) => {
    if (!e.target.dataset.dayToggle) return;
    const id = Number(e.target.dataset.id);
    mutate((todos) =>
      e.target.checked ? completeTodo(todos, id, Date.now()) : uncompleteTodo(todos, id)
    );
  });

  render();
});
