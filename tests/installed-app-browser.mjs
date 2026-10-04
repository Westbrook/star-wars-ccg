// Playwright 1.62.1 (package-lock): run against a local preview or built server.
// BASE_URL=http://localhost:5174 node tests/installed-app-browser.mjs
// WebKit emulation tests web behavior, not the iOS Home Screen installer.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, webkit, devices } from 'playwright';

const baseURL = process.env.BASE_URL || 'http://localhost:5173';
const output = process.env.SCREENSHOT_DIR || '/private/tmp/swccg-installed-app';
await mkdir(output, { recursive: true });

for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await engine.launch({ headless: true });
  try {
    for (const [device, options] of [
      ['phone', devices['iPhone 13']],
      ['tablet', devices['iPad Pro 11']],
      ['landscape', { ...devices['iPhone 13'], viewport: { width: 844, height: 390 } }],
    ]) {
      const context = await browser.newContext({ ...options, baseURL });
      // Avoid dependency on an external rules service; no game state is changed.
      await context.route('**/api/engine', route => route.fulfill({ json: { connected: false } }));
      const page = await context.newPage();
      await page.goto('/');
      await page.getByRole('button', { name: 'Install app', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      assert.match(await dialog.innerText(), /Open as Web App/);
      assert.match(await dialog.innerText(), /internet connection is required/);
      const box = await dialog.boundingBox();
      const viewport = page.viewportSize();
      assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `${name}/${device}: dialog fits`);
      await page.screenshot({ path: `${output}/${name}-${device}.png`, animations: 'disabled', scale: 'css' });
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Install app', exact: true }).evaluate(el => el === document.activeElement), true);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}/${device}: no horizontal overflow`);
      // Desktop emulation has zero physical safe-area values. Exercise the same
      // CSS variables with nonzero insets explicitly, without claiming OS QA.
      await page.addStyleTag({ content: ':root{--app-safe-top:47px;--app-safe-right:21px;--app-safe-bottom:34px;--app-safe-left:21px}' });
      await page.evaluate(() => scrollTo(0, 0));
      const header = await page.locator('.topbar').boundingBox();
      assert(header.y >= 47 && header.x >= 21, `${name}/${device}: header avoids cutouts`);
      await page.getByRole('button', { name: 'Install app', exact: true }).click();
      const safeDialog = await dialog.boundingBox();
      assert(safeDialog.width <= viewport.width - 42 && safeDialog.height <= viewport.height - 81, `${name}/${device}: inset dialog fits`);
      await page.getByRole('button', { name: 'Close', exact: true }).click();

      if (device === 'phone') {
        // Exercise the optional install API, including dismissal and one-shot use.
        await page.evaluate(() => {
          const event = new Event('beforeinstallprompt', { cancelable: true });
          event.prompt = async () => ({ outcome: 'dismissed' });
          dispatchEvent(event);
          if (!event.defaultPrevented) throw new Error('Install event was not captured');
        });
        await page.getByRole('button', { name: 'Install app', exact: true }).click();
        await page.getByRole('button', { name: 'Install Holotable', exact: true }).click();
        await page.getByRole('status').filter({ hasText: 'You can install later' }).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Install Holotable', exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Close', exact: true }).click();

        for (const path of ['/', '/matches', '/proof']) {
          await page.goto(path);
          const manifest = page.locator('link[rel=manifest]');
          assert.equal(await manifest.count(), 1);
          assert.equal(await manifest.getAttribute('crossorigin'), 'use-credentials');
          assert.equal(await page.locator('meta[name=apple-mobile-web-app-capable]').getAttribute('content'), 'yes');
          assert.equal(await page.locator('meta[name=viewport]').count(), 1);
          assert.match(await page.locator('meta[name=viewport]').getAttribute('content'), /viewport-fit=cover/);
        }
        const response = await context.request.get('/manifest.json');
        assert.equal(response.status(), 200);
        assert.match(response.headers()['content-type'], /json/);
        const manifest = await response.json();
        assert.equal(manifest.display, 'standalone');
        assert.equal(manifest.id, '/');
        for (const icon of manifest.icons) {
          const response = await context.request.get(icon.src);
          assert.equal(response.status(), 200);
          assert.match(response.headers()['content-type'], /image\/png/);
          const data = await response.body();
          assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`, icon.sizes);
        }
        if (name === 'chromium') {
          await page.goto('/');
          const cdp = await context.newCDPSession(page);
          const parsed = await cdp.send('Page.getAppManifest');
          assert.deepEqual(parsed.errors, [], 'Chromium parses the served manifest without errors');
        }
      }
      await context.close();
      console.log(`PASS ${name} ${device}: metadata, guide, focus, layout`);
    }
    const installed = await browser.newContext({ ...devices['iPhone 13'], baseURL });
    await installed.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
    const page = await installed.newPage();
    await page.goto('/');
    await page.waitForFunction(() => !document.querySelector('.install-app-trigger'));
    assert.equal(await page.getByRole('button', { name: 'Install app', exact: true }).count(), 0);
    await installed.close();
    console.log(`PASS ${name}: installed Apple mode hides installation control`);
  } finally { await browser.close(); }
}
