const { chromium } = require('C:/Users/moli/Desktop/Trae/chongzhen-game/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('pageerror', e => console.log('[ERR]', e.toString()));

  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  // 用 dynamic import from full URL
  const r = await page.evaluate(async () => {
    try {
      const m = await import('http://localhost:5173/node_modules/.vite/deps/react.js?v=6f5dbdab');
      return { ok: true, memo: typeof m.default.memo, reactKeys: Object.keys(m.default).slice(0, 5) };
    } catch (e) {
      return { err: e.toString() };
    }
  });
  console.log('Result:', JSON.stringify(r, null, 2));

  await browser.close();
})();
