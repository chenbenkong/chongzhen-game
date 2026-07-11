// 触发真实 React 事件验证主菜单
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // setup
  await page.locator('button:has-text("开 始 游 戏")').first().click();
  await page.waitForTimeout(400);
  if (await page.locator('button:has-text("寒门")').count() > 0) {
    await page.locator('button:has-text("寒门")').first().click();
    await page.waitForTimeout(200);
  }
  const input = page.locator('input[type="text"]').first();
  if (await input.count() > 0) {
    await input.fill('测试');
    await page.locator('button:has-text("定 此 名 字")').first().click();
    await page.waitForTimeout(300);
  }
  await page.locator('button:has-text("选 此 出 身")').first().click();
  await page.waitForTimeout(800);

  // 关掉 tutorial
  for (let i = 0; i < 5; i++) {
    const closeBtn = page.locator('.tutorial-overlay button:has-text("×"), .tutorial-overlay .close-btn').first();
    if (await closeBtn.count() > 0 && await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    } else { break; }
  }
  await page.waitForTimeout(800);

  const auto1 = await page.evaluate(() => {
    const r = localStorage.getItem('chongzhen_autosave');
    if (!r) return { present: false };
    const j = JSON.parse(r);
    return { present: true, bytes: r.length, player: j.playerName, turn: j.gameState?.turn };
  });
  console.log('[进游戏后] 自动存档:', JSON.stringify(auto1));

  // 用 dispatchEvent 触发真实 React click 事件
  const result = await page.evaluate(() => {
    const btn = document.querySelector('.action-bar .menu-btn');
    if (!btn) return { found: false, reason: 'no menu btn' };
    // 用 React 17+ 的方式：button 元素的 click() 方法触发
    btn.click();
    return { found: true, clicked: true };
  });
  console.log('[点击主菜单] 结果:', JSON.stringify(result));
  await page.waitForTimeout(2000);

  // 看主菜单
  const visible = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.title-buttons button, .title-screen button'));
    return btns.filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map(b => b.textContent.trim().replace(/\s+/g, ' '));
  });
  console.log('--- 主菜单可见按钮 ---');
  visible.forEach(l => console.log('  ', l));

  const hasLoad = visible.some(l => /读取存档|读 取 存 档/.test(l));
  const hasContinue = visible.some(l => /继续游戏|继 续 游 戏/.test(l));
  console.log('--- 验证 ---');
  console.log('  读取存档:', hasLoad ? '✓ 出现' : '✗ 没有');
  console.log('  继续游戏:', hasContinue ? '✓ 出现' : '✗ 没有');

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
