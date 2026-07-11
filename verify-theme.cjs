const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  // 1) 主菜单
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'shot-1-title.png' });
  console.log('[1] shot-1-title.png done');

  // 2) 点开始仕途
  await page.locator('.title-btn').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'shot-2-name.png' });
  console.log('[2] shot-2-name.png done');

  // 输入名字
  await page.fill('input[type="text"]', '朱由检');
  await page.waitForTimeout(500);

  // 找 confirm-btn 按钮（不看 disabled）
  const btns = await page.$$eval('button', els => els.map(e => ({
    text: e.textContent?.trim().slice(0, 20),
    cls: e.className,
    disabled: e.disabled,
  })));
  console.log('buttons on name screen:', JSON.stringify(btns.filter(b => /名|确|定|下|随/.test(b.text)), null, 2));

  // 找 enabled 的 "定此名字" 按钮
  const confirmBtn = await page.locator('button.confirm-btn:not(.disabled)').first();
  if (await confirmBtn.count() > 0) {
    await confirmBtn.click({ force: true });
    console.log('clicked confirm');
  } else {
    console.log('confirm button not found, trying .confirm-btn');
    await page.locator('button.confirm-btn').first().click({ force: true });
  }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'shot-3-origin.png' });
  console.log('[3] shot-3-origin.png done');

  // 看现在的 phase
  const phase3 = await page.evaluate(() => {
    return {
      hasOrigin: !!document.querySelector('.origin-card, .char-card, [class*="origin"]'),
      bodyText: document.body.innerText.slice(0, 400),
    };
  });
  console.log('phase3:', JSON.stringify(phase3, null, 2));

  // 4) 点第一个出身
  const firstOrigin = await page.$('.origin-card, .char-card, [class*="origin-select"] button');
  if (firstOrigin) {
    await firstOrigin.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'shot-4-game.png' });
    console.log('[4] shot-4-game.png done');
  }

  console.log('=== ERRORS ===');
  console.log(errors);

  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
