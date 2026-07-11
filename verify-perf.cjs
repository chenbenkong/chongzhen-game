const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2500);

  // 主菜单 BGM
  const title = await page.evaluate(() => {
    const fixed = document.querySelectorAll('.bgm-toggle--fixed').length;
    const inline = document.querySelectorAll('.bgm-toggle--inline').length;
    return { fixed, inline };
  });
  console.log('[title BGM]', title);

  // 测一次 FPS（5 帧）
  const fps = await page.evaluate(() => new Promise(resolve => {
    let count = 0;
    const start = performance.now();
    function tick() {
      count++;
      if (count >= 60) {
        const dur = performance.now() - start;
        resolve({ frames: count, ms: Math.round(dur), fps: Math.round(count * 1000 / dur) });
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }));
  console.log('[main menu FPS]', fps);

  // 进游戏
  await page.locator('.title-btn').first().click();
  await page.waitForTimeout(1000);
  await page.fill('input[type="text"]', '测试');
  await page.locator('button.confirm-btn').first().click({ force: true });
  await page.waitForTimeout(1500);
  const oc = await page.$('.origin-card, .selectable');
  if (oc) await oc.click();
  await page.waitForTimeout(1500);
  const enter = await page.$('button:has-text("进入游戏"), button:has-text("开始游戏")');
  if (enter) await enter.click();
  await page.waitForTimeout(2000);
  const skipTut = await page.$('button:has-text("跳过教程")');
  if (skipTut) await skipTut.click();
  await page.waitForTimeout(1500);

  // 游戏内 BGM + autosave
  const game = await page.evaluate(() => {
    const fixed = document.querySelectorAll('.bgm-toggle--fixed').length;
    const inline = document.querySelectorAll('.bgm-toggle--inline').length;
    return { fixed, inline };
  });
  console.log('[game BGM]', game);

  // 模拟连续 5 次 state 变化, 观察 autosave debounce 行为
  const before = await page.evaluate(() => {
    const raw = localStorage.getItem('chongzhen_autosave');
    return raw ? raw.length : 0;
  });
  console.log('[autosave before]', before);

  await page.screenshot({ path: 'shot-perf.png' });
  console.log('ERRORS:', errors);
  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
