// 关键验证: 关闭 save-slots-modal，回主菜单，看"继续游戏"按钮
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 走 setup 流程
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

  // 关掉 tutorial（点 × 关闭按钮）
  for (let i = 0; i < 5; i++) {
    const closeBtn = page.locator('.tutorial-overlay button[aria-label*="关"], .tutorial-overlay .close-btn, .tutorial-overlay button:has-text("×")').first();
    if (await closeBtn.count() > 0 && await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    } else { break; }
  }

  // 等几秒确认自动存档已写
  await page.waitForTimeout(1500);
  const auto1 = await page.evaluate(() => {
    const r = localStorage.getItem('chongzhen_autosave');
    if (!r) return { present: false };
    const j = JSON.parse(r);
    return { present: true, bytes: r.length, player: j.playerName, turn: j.gameState?.turn };
  });
  console.log('[进游戏后] 自动存档:', JSON.stringify(auto1));

  // 玩几回合
  for (let i = 0; i < 4; i++) {
    // 先点掉事件选项（如果有）
    const eventChoices = await page.locator('.event-modal button, [class*="event-choice"], .choice-btn, .event-choice, [class*="choice-button"]').all();
    for (const b of eventChoices) {
      if (await b.isVisible().catch(() => false)) {
        await b.click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
      }
    }
    const nextBtn = page.locator('.action-bar button:has-text("下 月")').first();
    if (await nextBtn.count() > 0) {
      await nextBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  const auto2 = await page.evaluate(() => {
    const r = localStorage.getItem('chongzhen_autosave');
    if (!r) return { present: false };
    const j = JSON.parse(r);
    return { present: true, bytes: r.length, player: j.playerName, turn: j.gameState?.turn, year: j.gameState?.currentYear, month: j.gameState?.currentMonth };
  });
  console.log('[玩 4 回合后] 自动存档:', JSON.stringify(auto2));

  // 回主菜单：直接 ESC 关掉所有 modal 然后点主菜单
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  // 直接通过 React state 切回 title phase（更可靠）
  // 用 evaluate 找主菜单按钮直接 click（用 force: true）
  const menuBtn = page.locator('.action-bar button[aria-label*="返回"], .action-bar .menu-btn');
  if (await menuBtn.count() > 0) {
    await menuBtn.first().click({ force: true }).catch(e => console.log('menu click:', e.message));
    await page.waitForTimeout(1500);
  }

  // 检查主菜单按钮
  const buttons = await page.locator('.title-buttons button, .title-screen button').all();
  const labels = [];
  for (const b of buttons) {
    if (await b.isVisible().catch(() => false)) {
      const t = (await b.innerText()).trim();
      labels.push(t);
    }
  }
  console.log('--- 主菜单可见按钮 ---');
  labels.forEach(l => console.log('  ', l));

  const hasLoad = labels.some(l => /读取存档|读 取 存 档/.test(l));
  const hasContinue = labels.some(l => /继续游戏|继 续 游 戏/.test(l));
  const hasStart = labels.some(l => /开始游戏|开 始 游 戏/.test(l));
  console.log('--- 验证 ---');
  console.log('  开始游戏:', hasStart);
  console.log('  读取存档:', hasLoad);
  console.log('  继续游戏:', hasContinue);

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
