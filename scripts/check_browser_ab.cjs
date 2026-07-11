const { chromium } = require('C:/Users/moli/Desktop/Trae/chongzhen-game/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('pageerror', e => console.log('[ERR]', e.toString()));
  page.on('console', m => {
    const t = m.text();
    if (t.includes('memo') || m.type() === 'error') console.log(`[${m.type()}]`, t);
  });

  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  // 在浏览器内 evaluate ActionBar 编译产物中的关键行
  const result = await page.evaluate(() => {
    return {
      // 测试 memo 是不是真存在
      reactMemo: typeof window.React?.memo,
      // fetch 实际 ActionBar 编译产物
      abSrc: null
    };
  });
  console.log('result:', result);

  // fetch ActionBar 编译产物
  const abSrc = await page.evaluate(async () => {
    const r = await fetch('/src/components/ActionBar.tsx');
    const text = await r.text();
    // 找 memo 出现的行
    const lines = text.split('\n');
    const memoLines = [];
    lines.forEach((l, i) => {
      if (l.includes('memo')) memoLines.push(`${i}: ${l.slice(0, 200)}`);
    });
    return { len: text.length, memoLines: memoLines.slice(0, 10) };
  });
  console.log('\n=== ActionBar 编译产物 memo 行 ===');
  console.log(abSrc);

  await browser.close();
})();
