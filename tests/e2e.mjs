// Browser checks against a running build: node tests/e2e.mjs [baseUrl]
// Routes render at desktop and phone widths in both surfaces, with no console errors, no horizontal
// overflow, and live protocol numbers on the page (so the chain layer really read Base).
import { chromium } from '/Users/web3warrior/Code/mordiem-whale-monitor/node_modules/playwright-core/index.mjs';

const base = process.argv[2] ?? 'http://localhost:3000';
const READ_ONLY = '0x8Bf5941d27176242745B716251943Ae4892a3C26';
const routes = ['/', '/protocol', '/positions', `/a/${READ_ONLY}`];
const viewports = [{ name: 'desktop', width: 1300, height: 950 }, { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }];
const out = [];
const ok = (name, cond, extra = '') => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`);

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const vp of viewports) {
  for (const surface of ['night', 'day']) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    await ctx.addInitScript((s) => { try { localStorage.setItem('surface', s); } catch {} }, surface);
    for (const route of routes) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
      await page.goto(base + route, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.waitForTimeout(2500);
      const tag = `${vp.name}/${surface} ${route}`;
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      ok(`${tag} no horizontal overflow`, overflow <= 0, `(${overflow}px)`);
      ok(`${tag} no console errors`, errors.length === 0, errors.length ? JSON.stringify(errors.slice(0, 3)) : '');
      const text = await page.evaluate(() => document.body.innerText);
      ok(`${tag} live numbers present`, /\d{2,3}(\.\d+)?\s*MDM/.test(text) || /\d+(\.\d+)?\s*MCU/.test(text), '');
      ok(`${tag} surface applied`, (await page.evaluate(() => document.documentElement.dataset.surface)) === surface);
      await page.screenshot({ path: `/private/tmp/claude-501/-Users-web3warrior-Code/fee05b38-5b74-42e4-8a99-9ef902bb0a51/scratchpad/stake-${vp.name}-${surface}${route.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: vp.name === 'phone' });
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
console.log(out.join('\n'));
const fails = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`\n${out.length - fails}/${out.length} passed`);
process.exit(fails ? 1 : 0);
