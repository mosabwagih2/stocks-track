// Static build of the server edition for cPanel: `npm run build:cpanel` → php-app/public/app/ (served by php-app/public/index.php).
// No Node on the server: plain files, same-origin only (the server's CSP allows no CDN), fonts from php-app/public/assets/fonts.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  base: '/app/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    outDir: path.resolve(__dirname, '../php-app/public/app'),
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: { input: path.resolve(__dirname, 'cpanel.html') },
  },
});
