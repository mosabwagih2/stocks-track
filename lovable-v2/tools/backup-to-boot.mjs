// LOCAL TEST ONLY: turns a full backup downloaded from the live site (Settings › full backup, femini-backup-YYYY-MM-DD.json)
// into .local/boot.json, the starting data of the local test server (vite.cpanel-dev.config.ts). The live site is not touched.
//   node tools/backup-to-boot.mjs <path to femini-backup-….json>
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('usage: node tools/backup-to-boot.mjs <femini-backup.json>'); process.exit(1); }
const b = JSON.parse(fs.readFileSync(src, 'utf8'));
if (b.app !== 'femini-stock' || !b.state) { console.error('not a Fémini backup'); process.exit(1); }
const users = b.users ?? [];
const admin = users.find((u) => u.role === 'admin') ?? users[0];
const boot = {
  rev: b.rev ?? 0,
  csrf: 'local',
  user: { id: String(admin?.id ?? 'u1'), name: String(admin?.name ?? 'Mosab'), role: 'admin', perms: [] },
  state: { ...b.state, users: users.map((u) => ({ ...u, on: u.active ?? u.on ?? true })), roles: b.roles ?? {} },
  // the files' records (without their contents: the test server does not serve files)
  files: (b.files ?? []).map(({ data, ...f }) => f),
};
const out = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../.local/boot.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
if (fs.existsSync(out)) fs.copyFileSync(out, out.replace(/\.json$/, `.before-${Date.now()}.json`));
fs.writeFileSync(out, JSON.stringify(boot));
// the files' contents, so the local server can show photos and download originals: .local/files/<id> (+ .type)
const dir = path.join(path.dirname(out), 'files'); fs.mkdirSync(dir, { recursive: true }); let nFiles = 0;
for (const f of b.files ?? []) {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(String(b.photos?.[f.data] ?? '')); if (!m) continue;
  fs.writeFileSync(path.join(dir, String(f.id)), m[2] ? Buffer.from(m[3], 'base64') : decodeURIComponent(m[3]));
  fs.writeFileSync(path.join(dir, `${f.id}.type`), f.mime || m[1] || 'application/octet-stream'); nFiles++;
}
console.log(`.local/files: ${nFiles} files`);
console.log(`.local/boot.json: rev ${boot.rev}, ${boot.state.moves.length} moves, ${boot.state.orders.length} orders, ${boot.files.length} file records, signed in as ${boot.user.name}`);
