// 完整 E2E: 主菜单 -> 姓名 -> 出身 -> 难度 -> 游戏
const { chromium } = require('C:/Users/moli/Desktop/Trae/chongzhen-game/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const errs = [];
  page.on('pageerror', e => errs.push(e.toString()));
  page.on('console', m => {
    if (m.type() === 'error') errs.push(`[console] ${m.text()}`);
  });

  console.log('=== 1. 加载主菜单 ===');
  await page.goto('http://localhost:5173', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  // 跳过新手引导
  const tutorialClose = page.locator('button:has-text("跳过"), button:has-text("开始游戏"), button:has-text("知道了")').first();
  if (await tutorialClose.count() > 0 && await tutorialClose.isVisible()) {
    await tutorialClose.click();
    await page.waitForTimeout(500);
  }

  console.log('\n=== 2. 点 "开 始 仕 途" ===');
  const startBtn = page.locator('button.title-btn').first();
  console.log('title-btn 数:', await page.locator('button.title-btn').count());
  await startBtn.click();
  await page.waitForTimeout(1500);

  // 看看 phase 是什么
  const phase1 = await page.evaluate(() => {
    return {
      nameInput: document.querySelectorAll('input[type="text"]').length,
      originCard: document.querySelectorAll('.origin-card, [class*="origin"]').length,
      diffBtn: document.querySelectorAll('button').length
    };
  });
  console.log('点击后 DOM:', phase1);

  // 输姓名
  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.count() > 0) {
    await nameInput.fill('测试');
    await page.waitForTimeout(300);
    // 找下一步/确认按钮
    const nextBtn = page.locator('button:has-text("下一步"), button:has-text("确认"), button:has-text("开始")').first();
    if (await nextBtn.count() > 0) {
      await nextBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // 选出身
  const originCard = page.locator('.origin-card, [class*="origin-card"]').first();
  if (await originCard.count() > 0) {
    console.log('点出身...');
    await originCard.click();
    await page.waitForTimeout(500);
    const nextBtn2 = page.locator('button:has-text("下一步"), button:has-text("确认"), button:has-text("开始")').first();
    if (await nextBtn2.count() > 0) {
      await nextBtn2.click();
      await page.waitForTimeout(1000);
    }
  }

  // 选难度
  const diffCard = page.locator('.difficulty-card, [class*="difficulty"]').first();
  if (await diffCard.count() > 0) {
    console.log('点难度...');
    await diffCard.click();
    await page.waitForTimeout(500);
  }

  // 找开始/进入游戏 按钮
  const enterBtn = page.locator('button:has-text("进入游戏"), button:has-text("开始仕途"), button:has-text("开始")').first();
  if (await enterBtn.count() > 0) {
    await enterBtn.click();
    await page.waitForTimeout(3000);
  }

  // 看是否进游戏
  const inGame = await page.locator('.game-screen').count();
  console.log('game-screen 存在:', inGame);

  if (inGame > 0) {
    console.log('\n=== 3. 游戏内 FPS ===');
    const fps2 = await page.evaluate(() => new Promise(r => {
      let f = 0; const s = performance.now();
      function tick() { f++; if (performance.now() - s < 1000) requestAnimationFrame(tick); else r(f); }
      requestAnimationFrame(tick);
    }));
    console.log('游戏内 FPS:', fps2);

    // 组件计数
    const comps = {
      statusBar: await page.locator('.status-bar, [class*="status-bar"]').count(),
      attributePanel: await page.locator('.attribute-panel, [class*="attribute-panel"]').count(),
      statusPanel: await page.locator('.status-panel, [class*="status-panel"]').count(),
      eventDisplay: await page.locator('.event-display, .event-card, [class*="event-card"]').count(),
      actionBar: await page.locator('.action-bar, [class*="action-bar"]').count(),
      bgmInline: await page.locator('.bgm-toggle--inline').count(),
      historyPanel: await page.locator('.history-panel').count()
    };
    console.log('组件计数:', comps);

    // 模拟 history 滚动
    const historyUl = page.locator('.history-panel ul').first();
    if (await historyUl.count() > 0) {
      console.log('\n=== 4. history 滚动 ===');
      const fps3 = await page.evaluate(() => new Promise(r => {
        let f = 0; const s = performance.now();
        const ul = document.querySelector('.history-panel ul');
        function tick() {
          f++;
          ul.scrollTop += 5;
          if (performance.now() - s < 1500) requestAnimationFrame(tick);
          else r(f);
        }
        requestAnimationFrame(tick);
      }));
      console.log(`history 滚动 FPS (1.5s): ${fps3} (平均 ${(fps3/1.5).toFixed(1)})`);
    }

    // 等 1.5s 让 autosave debounce 触发
    console.log('\n=== 5. 等 autosave 触发 ===');
    await page.waitForTimeout(1500);
    const autosaveKey = await page.evaluate(() => {
      return !!localStorage.getItem('chongzhen_autosave');
    });
    console.log('autosave 写入:', autosaveKey);

    await page.screenshot({ path: 'C:/Users/moli/Desktop/Trae/02-game.png' });
  } else {
    await page.screenshot({ path: 'C:/Users/moli/Desktop/Trae/02-fail.png' });
  }

  console.log('\n=== Page 错误 ===');
  for (const e of errs) console.log(e);
  if (errs.length === 0) console.log('无错误');

  await browser.close();
  console.log('\n=== 完成 ===');
})().catch(e => { console.error(e); process.exit(1); });
