const { chromium } = require('C:/Users/moli/Desktop/Trae/chongzhen-game/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 在浏览器内执行类似 ActionBar 第 18 行的代码
  const r = await page.evaluate(async () => {
    const r = await import('/node_modules/.vite/deps/react.js?v=6f5dbdab');
    const __vite__cjsImport3_react = r.default;
    return {
      type: typeof __vite__cjsImport3_react,
      isNull: __vite__cjsImport3_react === null,
      memo: __vite__cjsImport3_react ? __vite__cjsImport3_react['memo'] : 'no-cjs',
      memoType: __vite__cjsImport3_react && __vite__cjsImport3_react.memo ? typeof __vite__cjsImport3_react.memo : 'no-memo',
      // 模拟 ActionBar 编译产物行为
      tryMemo: (() => {
        try {
          const memo = __vite__cjsImport3_react['memo'];
          return typeof memo;
        } catch (e) { return 'err: ' + e.message; }
      })()
    };
  });

  console.log(JSON.stringify(r, null, 2));
  await browser.close();
})();
