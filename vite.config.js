/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

const onnxWasmPlugin = {
  name: 'onnx-wasm-serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/wasm/ort-wasm')) {
        const filename = req.url.split('/').pop().split('?')[0];
        const filepath = path.join(dirname, 'node_modules/onnxruntime-web/dist', filename);
        if (fs.existsSync(filepath)) {
          const ext = path.extname(filename);
          const types = { '.wasm': 'application/wasm', '.mjs': 'application/javascript' };
          res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
          fs.createReadStream(filepath).pipe(res);
          return;
        }
      }
      next();
    });
  }
};

const wsDevPlugin = {
  name: 'websocket-dev',
  configureServer(server) {
    server.httpServer?.once('listening', async () => {
      const { connectDb } = await import('./src/lib/server/db.js');
      await connectDb();
      const { attachWebSocketServer } = await import('./src/lib/server/rooms.js');
      attachWebSocketServer(server.httpServer);
    });
  }
};

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [sveltekit(), onnxWasmPlugin, wsDevPlugin],
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },
  test: {
    expect: {
      requireAssertions: true
    },
    projects: [
      {
        extends: './vite.config.js',
        test: {
          name: 'client',
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [
              {
                browser: 'chromium',
                headless: true
              }
            ]
          },
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
          exclude: ['src/lib/server/**']
        }
      },
      {
        extends: './vite.config.js',
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
        }
      },
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook')
          })
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium'
              }
            ]
          },
          setupFiles: ['.storybook/vitest.setup.ts']
        }
      }
    ]
  }
});
