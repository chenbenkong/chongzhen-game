// 验证"继续游戏"恢复事件卡
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));

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
  await page.waitForTimeout(1000);

  // 关 tutorial
  for (let i = 0; i < 5; i++) {
    const closeBtn = page.locator('.tutorial-overlay button:has-text("×"), .tutorial-overlay .close-btn').first();
    if (await closeBtn.count() > 0 && await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    } else { break; }
  }
  await page.waitForTimeout(500);

  console.log('--- 第一次进游戏 ---');
  // 点下月 1 次，等事件出现
  await page.locator('.action-bar button:has-text("下 月")').first().click({ force: true });
  await page.waitForTimeout(1000);

  // 检查事件是否出现
  const evtTitle = await page.locator('.event-title, [class*="event"] h1, [class*="event"] h2, .main-content h1, .main-content h2').first().textContent().catch(() => null);
  console.log('事件标题:', evtTitle);

  // 不点选项，直接 reload
  console.log('\n--- 模拟退出后 reload ---');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 验证 autosave 还在 + currentEventId 有值
  const a = await page.evaluate(() => {
    const r = localStorage.getItem('chongzhen_autosave');
    if (!r) return null;
    const j = JSON.parse(r);
    return {
      turn: j.gameState?.turn,
      year: j.gameState?.currentYear,
      month: j.gameState?.currentMonth,
      currentEventId: j.currentEventId,
      hasCurrentEvent: !!j.currentEvent,
      currentEventTitle: j.currentEvent?.title || j.currentEvent?.text?.slice(0, 30) || null,
      pendingEvents: (j.pendingEvents || []).length,
    };
  });
  console.log('autosave:', JSON.stringify(a, null, 2));

  // 看主菜单有"继续游戏"
  const continueBtn = await page.locator('button:has-text("继续游戏")').count();
  console.log('主菜单"继续游戏"按钮数:', continueBtn);

  // 点继续游戏
  await page.locator('button:has-text("继续游戏")').first().click();
  await page.waitForTimeout(2000);

  // 验证事件卡恢复
  const restoredTitle = await page.locator('.event-title, [class*="event"] h1, [class*="event"] h2, .main-content h1, .main-content h2').first().textContent().catch(() => null);
  console.log('恢复后事件标题:', restoredTitle);

  // 看 main-content 是否有事件
  const hasEventCard = await page.evaluate(() => {
    const mc = document.querySelector('.main-content');
    if (!mc) return false;
    const t = mc.textContent || '';
    return /【.+】/.test(t) || /事件/.test(t) || t.length > 100;
  });
  console.log('事件卡显示:', hasEventCard);

  console.log('\n--- autosave 日志 ---');
  logs.filter(l => l.includes('[autosave]')).slice(-5).forEach(l => console.log(l));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
