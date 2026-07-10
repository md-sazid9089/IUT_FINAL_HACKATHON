import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const port = 4179;
const url = `http://127.0.0.1:${port}`;
const __dirname = dirname(fileURLToPath(import.meta.url));
const viteBin = resolve(__dirname, '../node_modules/vite/bin/vite.js');
const server = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: resolve(__dirname, '..'),
  stdio: 'ignore',
});

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Preview server did not start');
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForSelector('text=Hardware PoC', { timeout: 30000 });
  await page.waitForSelector('text=hardware-disabled', { timeout: 30000 });
  await page.waitForTimeout(1000);
  if (errors.length) throw new Error(`Browser console errors:\n${errors.join('\n')}`);
  await browser.close();
} finally {
  server.kill();
}
