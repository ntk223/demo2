// Pure calendar / appointment helpers. No DOM.
import { formatTimeHM, combineDateAndTime } from './tasks.mjs';

/** Local "YYYY-MM-DD" for a timestamp. */
export function toISODate(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local midnight ts for "YYYY-MM-DD"; null on malformed/invalid dates. */
export function parseISODate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso == null ? '' : iso));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
  return d.getTime();
}

/** 42 cells (6 weeks, Monday-first) covering the given month (0-based). */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(year, month, 1 - lead);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    cells.push({
      ts: d.getTime(),
      iso: toISODate(d.getTime()),
      inMonth: d.getMonth() === month,
    });
  }
  return cells;
}

/** Map isoDate -> todos with an appointment that day; keys sorted ascending. */
export function groupByDate(todos) {
  const map = new Map();
  for (const t of todos) {
    if (t.scheduledAt == null) continue;
    const iso = toISODate(t.scheduledAt);
    if (!map.has(iso)) map.set(iso, []);
    map.get(iso).push(t);
  }
  return new Map([...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
}

/** Todos with an appointment on an ISO date, sorted by time. */
export function appointmentsOn(todos, iso) {
  return todos
    .filter((t) => t.scheduledAt != null && toISODate(t.scheduledAt) === iso)
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
}

/** Next `limit` not-done future appointments, sorted by time. */
export function upcoming(todos, now, limit = 5) {
  return todos
    .filter((t) => !t.done && t.scheduledAt != null && t.scheduledAt >= now)
    .sort((a, b) => a.scheduledAt - b.scheduledAt)
    .slice(0, limit);
}

/** Merge a date pick with an optional "HH:mm" (default 09:00). ts or null. */
export function buildScheduledTs(dateIso, timeStr) {
  const day = parseISODate(dateIso);
  if (day == null) return null;
  return combineDateAndTime(day, timeStr || '09:00');
}

/** Compact "dd/mm HH:mm" for badges. */
export function formatShort(ts) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm} ${formatTimeHM(ts)}`;
}
