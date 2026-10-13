// Smoke test for the static server (no curl in slim image).
const base = 'http://localhost:3000';
const paths = ['/', '/app.mjs', '/style.css', '/lib/tasks.mjs', '/missing.xyz'];
const stats = await Promise.all(
  paths.map((p) => fetch(base + p).then((r) => r.status).catch(() => 0))
);
console.log('SMOKE', paths.map((p, i) => p + ':' + stats[i]).join(' '));
const html = await fetch(base + '/').then((r) => r.text());
console.log(html.includes('TaskFlow') ? 'HTML_TITLE_OK' : 'HTML_TITLE_MISSING');
const appJs = await fetch(base + '/app.mjs').then((r) => r.text());
console.log(appJs.includes('set-time') ? 'APP_SYNCED' : 'APP_STALE');
const libJs = await fetch(base + '/lib/tasks.mjs').then((r) => r.text());
console.log(libJs.includes('combineDateAndTime') ? 'LIB_SYNCED' : 'LIB_STALE');
const css = await fetch(base + '/style.css').then((r) => r.text());
console.log(css.includes('#f1f5f9') ? 'CSS_LIGHT_THEME' : 'CSS_STALE');
