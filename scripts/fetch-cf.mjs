// Download cloudflared binary (slim image has no curl/wget).
import { writeFileSync } from 'node:fs';
const url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64';
const res = await fetch(url);
if (!res.ok) {
  console.error('DL_FAIL', res.status);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync('/tmp/cf', buf);
console.log('CF_BYTES', buf.length);
