// Rebuild from the vector sources with the project's pinned Playwright Chromium.
// Run: node scripts/generate-app-icons.mjs
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  async function render(source, size, destination) {
    const svg = await readFile(new URL(source, import.meta.url), 'utf8');
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{width:100%;height:100%;display:block}</style>${svg}`);
    return page.screenshot({ path: destination && new URL(destination, import.meta.url).pathname, omitBackground: true });
  }
  for (const size of [152, 167, 180, 192, 512]) {
    const name = size < 192 ? `apple-touch-icon-${size}` : `app-${size}`;
    await render('../public/icons/holotable.svg', size, `../public/icons/${name}.png`);
  }
  // All foreground identity fits within the central 80% safe circle. The opaque
  // full-bleed background lets the OS choose its own icon mask and corner radius.
  await render('../public/icons/holotable.svg', 512, '../public/icons/app-maskable-512.png');
  const sizes = [16, 32, 48];
  const pngs = [];
  for (const size of sizes) pngs.push(await render('../public/favicon.svg', size,
    size === 32 ? '../public/icons/favicon-32.png' : undefined));
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const entry = 6 + 16 * i;
    header[entry] = size; header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(pngs[i].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += pngs[i].length;
  });
  await writeFile(new URL('../public/favicon.ico', import.meta.url), Buffer.concat([header, ...pngs]));
} finally { await browser.close(); }
