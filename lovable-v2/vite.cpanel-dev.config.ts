// LOCAL TEST ONLY: runs the server edition in the browser against an in-memory copy of the PHP server's rules
// (src/femini/data/cpanel/fake-server.ts), started from a copy of the live data (.local/boot.json, never committed).
//   npx vite --config vite.cpanel-dev.config.ts
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import fs from 'node:fs';

const BOOT = process.env.FEMINI_LIVE_BOOT || path.resolve(__dirname, '.local/boot.json');

function fakeServer(): Plugin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let srv: any = null;
  return {
    name: 'femini-fake-server',
    async configureServer(server) {
      const { createFakeServer } = await server.ssrLoadModule('/src/femini/data/cpanel/fake-server.ts');
      const boot = JSON.parse(fs.readFileSync(BOOT, 'utf8'));
      const u = boot.user ?? { id: 'u1', name: 'Mosab', role: 'admin', perms: [] };
      srv = createFakeServer(boot, { id: u.id, name: u.name, role: u.role, perms: u.perms ?? [] });
      const json = (res: import('node:http').ServerResponse, code: number, body: unknown) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
      const read = (req: import('node:http').IncomingMessage) => new Promise<string>((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => ok(b)); });
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '/';
        if (url.startsWith('/api/sync/pull')) return json(res, 200, srv.pull(Number(new URL(url, 'http://x').searchParams.get('since') ?? 0)));
        if (url.startsWith('/api/sync/push')) { const r = srv.push(JSON.parse(await read(req))); return r.ok ? json(res, 200, { ok: true, rev: r.rev, prev: r.prev }) : json(res, r.status, { ok: false, error: r.error, message: r.message }); }
        if (url.startsWith('/api/files') && req.method === 'POST') { await read(req); return json(res, 201, { ok: true, file: { id: Date.now() % 100000, name: 'file', mime: 'image/jpeg', size: 1, hasThumb: false, uploadedAt: '2026-11-08 10:00:00' } }); }
        if (url.startsWith('/api/users')) return json(res, 200, { ok: true, users: (boot.state.users ?? []).map((x: Record<string, unknown>) => ({ ...x, active: x.on, hasPassword: true })), roles: boot.state.roles ?? {} });
        if (url.startsWith('/api/')) return json(res, 404, { ok: false, message: 'not in the local test server' });
        if (url.startsWith('/assets/fonts/')) { const f = path.resolve(__dirname, '../php-app/public', url.slice(1).split('?')[0]); if (fs.existsSync(f)) { res.setHeader('Content-Type', f.endsWith('.css') ? 'text/css' : 'font/woff2'); return res.end(fs.readFileSync(f)); } }
        // the app's own pages are one page
        if (req.method === 'GET' && !url.includes('.') && !url.startsWith('/@') && !url.startsWith('/src/') && !url.startsWith('/node_modules/')) req.url = '/cpanel.html';
        next();
      });
    },
    transformIndexHtml(html) { return html.replace('<!--FEMINI_BOOT-->', `<script>window.FEM_BOOT=${JSON.stringify(srv.bootNow())};</script>`); },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss(), fakeServer()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 5181, strictPort: true },
});
