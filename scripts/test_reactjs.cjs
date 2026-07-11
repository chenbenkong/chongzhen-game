const { chromium } = require('C:/Users/moli/Desktop/Trae/chongzhen-game/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const reactjsResp = [];
  page.on('response', async (resp) => {
    if (resp.url().includes('react.js?v=')) {
      const text = await resp.text().catch(() => '');
      reactjsResp.push({ url: resp.url(), status: resp.status(), text });
    }
  });

  page.on('pageerror', e => console.log('[ERR]', e.toString()));

  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  console.log('=== react.js 响应 ===');
  for (const r of reactjsResp) {
    console.log('URL:', r.url);
    console.log('Status:', r.status);
    console.log('Body:', r.text);
  }

  // ActionBar 实际拿到的 react.js 内容（通过 fetch + 检查 memo 解析）
  const testRes = await page.evaluate(async () => {
    // 模拟 ActionBar 第 18 行的 import + destructuring
    const mod = await import('http://localhost:5173/node_modules/.vite/deps/react.js?v=6f5dbdab');
    return {
      defaultType: typeof mod.default,
      defaultExists: !!mod.default,
      memoType: mod.default ? typeof mod.default.memo : 'no-default',
      tryCall: (() => {
        try {
          const m = mod.default.memo;
          return m('div') ? 'called' : 'returned';
        } catch (e) { return 'err: ' + e.message; }
      })()
    };
  });
  console.log('\n=== 浏览器内 memo 测试 ===');
  console.log(testRes);

  await browser.close();
})();
