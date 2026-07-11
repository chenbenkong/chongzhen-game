// 用 Playwright 拦截网络请求，看实际加载的 react module
const { chromium } = require('C:/Users/moli/Desktop/Trae/chongzhen-game/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const loaded = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('react.js') || url.includes('ActionBar') || url.includes('chunk-')) {
      loaded.push({ url, status: resp.status(), len: (await resp.body().catch(() => Buffer.alloc(0))).length });
    }
  });

  page.on('pageerror', e => console.log('[PAGE ERR]', e.toString()));
  page.on('console', m => {
    if (m.type() === 'error') console.log('[CONSOLE ERR]', m.text());
  });

  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(5000);

  console.log('=== 关键资源加载 ===');
  for (const l of loaded) {
    console.log(`${l.status} ${l.url} (${l.len} bytes)`);
  }

  // 浏览器内直接 evaluate React.memo
  const memoTest = await page.evaluate(async () => {
    try {
      const m = await import('/node_modules/.vite/deps/react.js?v=6f5dbdab');
      const react = m.default;
      return {
        defaultKeys: react ? Object.keys(react).slice(0, 10) : null,
        hasMemo: react ? typeof react.memo : null,
        memoType: react && react.memo ? typeof react.memo : null
      };
    } catch (e) {
      return { err: e.toString() };
    }
  });
  console.log('\n=== 浏览器内 React.memo 测试 ===');
  console.log(memoTest);

  await browser.close();
})();
