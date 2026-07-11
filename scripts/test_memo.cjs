const { chromium } = require('C:/Users/moli/Desktop/Trae/chongzhen-game/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('pageerror', e => console.log('[ERR]', e.toString()));

  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // 在浏览器内手动 import react.js 然后试 memo
  const r = await page.evaluate(async () => {
    try {
      const mod = await import('/node_modules/.vite/deps/react.js?v=6f5dbdab');
      const react = mod.default;
      return {
        modKeys: Object.keys(mod),
        reactType: typeof react,
        reactIsObj: react && typeof react === 'object',
        reactKeys: react ? Object.keys(react) : null,
        memo: react?.memo ? typeof react.memo : 'no-memo',
        memoToString: react?.memo ? react.memo.toString().slice(0, 100) : null
      };
    } catch (e) {
      return { err: e.toString() };
    }
  });
  console.log('react test:', JSON.stringify(r, null, 2));

  await browser.close();
})();
