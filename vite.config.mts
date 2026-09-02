import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command }) => {
  // React Refresh injects an inline preamble in development only.
  const devNonce = command === 'serve' ? randomBytes(16).toString('base64') : undefined;

  return {
    plugins: [
      react(),
      {
        name: 'development-csp',
        apply: 'serve',
        transformIndexHtml: {
          order: 'pre',
          handler: (html) =>
            html.replace("script-src 'self'", `script-src 'self' 'nonce-${devNonce}'`),
        },
      },
    ],
    html: { cspNonce: devNonce },
    base: './',
    server: { host: 'localhost', port: 5173, strictPort: true },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  };
});
