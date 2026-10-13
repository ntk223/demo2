// Smoke test for the static server (no curl in slim image).
const base = 'http://localhost:3000';
const paths = ['/', '/app.mjs', '/style.css', '/lib/tasks.mjs', '/missing.xyz'];
const stats = await Promise.all(
  paths.map((p) => fetch(base + p).then((r) => r.status).catch(() => 0))
);
console.log('SMOKE', paths.map((p, i) => p + ':' + stats[i]).join(' '));
const html = await fetch(base + '/').then((r) => r.text());
console.log(html.includes('Todo Tracker') ? 'HTML_TITLE_OK' : 'HTML_TITLE_MISSING');
