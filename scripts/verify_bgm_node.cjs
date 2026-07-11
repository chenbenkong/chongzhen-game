// 验证 BGM 按钮渲染 + console 错误
const { chromium } = require('C:/Users/moli/Desktop/Trae/chongzhen-game/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const consoleLogs = [];
  const pageErrors = [];
  page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => pageErrors.push(err.toString()));

  console.log('=== goto 5173 ===');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('\n=== BGM 按钮检测 ===');
  const fixedBtns = await page.locator('.bgm-toggle--fixed').all();
  const inlineBtns = await page.locator('.bgm-toggle--inline').all();
  console.log(`fixed BGM: ${fixedBtns.length}`);
  for (const b of fixedBtns) {
    const bbox = await b.boundingBox();
    const text = await b.innerText();
    console.log(`  bbox: ${JSON.stringify(bbox)}, text: ${text.slice(0, 50)}`);
  }
  console.log(`inline BGM: ${inlineBtns.length}`);

  console.log('\n=== title-screen 直接子元素 ===');
  const childCount = await page.locator('.title-screen > *').count();
  console.log(`title-screen 子元素数: ${childCount}`);
  for (let i = 0; i < Math.min(childCount, 15); i++) {
    const tag = await page.locator('.title-screen > *').nth(i).evaluate(el => {
      return el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : '');
    });
    console.log(`  [${i}] ${tag}`);
  }

  // 测 FPS
  console.log('\n=== FPS ===');
  const fps = await page.evaluate(() => new Promise(resolve => {
    let frames = 0;
    const start = performance.now();
    function tick() {
      frames++;
      if (performance.now() - start < 1000) requestAnimationFrame(tick);
      else resolve(frames);
    }
    requestAnimationFrame(tick);
  }));
  console.log(`主菜单 FPS: ${fps}`);

  // 测 history-panel FPS (进游戏后)
  console.log('\n=== 进游戏 ===');
  await page.click('button.title-btn:has-text("开 始 仕 途")');
  await page.waitForTimeout(500);
  await page.fill('input[type="text"]', '测试玩家').catch(() => {});
  const confirmBtn = page.locator('button:has-text("确认"), button:has-text("下一步"), button:has-text("确定")').first();
  if (await confirmBtn.count() > 0) {
    await confirmBtn.click();
    await page.waitForTimeout(500);
  }
  // origin-select
  const originBtn = page.locator('.origin-card, [class*="origin"]').first();
  if (await originBtn.count() > 0) {
    await originBtn.click();
    await page.waitForTimeout(2000);
  }
  // 截图
  await page.screenshot({ path: 'C:/Users/moli/Desktop/Trae/ingame.png', fullPage: false });
  console.log('截图: C:/Users/moli/Desktop/Trae/ingame.png');

  // 在游戏界面测 FPS
  const fps2 = await page.evaluate(() => new Promise(resolve => {
    let frames = 0;
    const start = performance.now();
    function tick() {
      frames++;
      if (performance.now() - start < 1000) requestAnimationFrame(tick);
      else resolve(frames);
    }
    requestAnimationFrame(tick);
  }));
  console.log(`游戏内 FPS: ${fps2}`);

  // 模拟滚动 history-panel
  const historyPanel = page.locator('.history-panel').first();
  if (await historyPanel.count() > 0) {
    const bbox = await historyPanel.boundingBox();
    if (bbox) {
      await page.mouse.move(bbox.x + bbox.width/2, bbox.y + bbox.height/2);
      const fps3 = await page.evaluate(() => new Promise(resolve => {
        let frames = 0;
        const start = performance.now();
        function tick() {
          frames++;
          if (performance.now() - start < 2000) {
            requestAnimationFrame(tick);
          } else {
            resolve(frames);
          }
        }
        requestAnimationFrame(tick);
      }));
      console.log(`静止 2s FPS: ${fps3 / 2}`);

      // 持续滚动 2s
      const fps4 = await page.evaluate(async () => {
        let frames = 0;
        const start = performance.now();
        const panel = document.querySelector('.history-panel');
        return new Promise(resolve => {
          let scrollPos = 0;
          function tick() {
            frames++;
            scrollPos += 5;
            if (panel) panel.scrollTop = scrollPos;
            if (performance.now() - start < 2000) {
              requestAnimationFrame(tick);
            } else {
              resolve(frames);
            }
          }
          requestAnimationFrame(tick);
        });
      });
      console.log(`持续滚动 2s FPS: ${fps4 / 2}`);
    }
  }

  console.log('\n=== Console 日志 (后 30) ===');
  for (const log of consoleLogs.slice(-30)) console.log(log);

  console.log('\n=== Page 错误 ===');
  for (const err of pageErrors) console.log(err);

  await browser.close();
})().catch(err => {
  console.error('脚本失败:', err);
  process.exit(1);
});
