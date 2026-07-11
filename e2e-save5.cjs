// 关键验证: 关 save-slots → 点主菜单 → 看"继续游戏"按钮
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

  // 验证自动存档已写
  const auto1 = await page.evaluate(() => {
    const r = localStorage.getItem('chongzhen_autosave');
    if (!r) return { present: false };
    const j = JSON.parse(r);
    return { present: true, bytes: r.length, player: j.playerName, turn: j.gameState?.turn, y: j.gameState?.currentYear, m: j.gameState?.currentMonth };
  });
  console.log('[进游戏后] 自动存档:', JSON.stringify(auto1));

  // 点"下月"几次（force: true 绕过任何遮挡）
  for (let i = 0; i < 3; i++) {
    // 先选事件
    const ev = await page.locator('.event-modal .choice-btn, .event-choice, [class*="choice"]:visible button').all();
    for (const b of ev) {
      if (await b.isVisible().catch(() => false)) {
        await b.click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
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
    return { present: true, bytes: r.length, turn: j.gameState?.turn, y: j.gameState?.currentYear, m: j.gameState?.currentMonth };
  });
  console.log('[玩 3 回合后] 自动存档:', JSON.stringify(auto2));

  // 直接点"主菜单"按钮（force: true 绕过任何 modal 拦截）
  const menuBtn = page.locator('.action-bar .menu-btn, .action-bar button[aria-label*="返回"]');
  if (await menuBtn.count() > 0) {
    console.log('点主菜单按钮...');
    await menuBtn.first().click({ force: true });
    await page.waitForTimeout(2000);
  }

  // 验证主菜单
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

  // 再验证点"继续游戏"能载入
  if (hasContinue) {
    await page.locator('button:has-text("继续游戏")').first().click({ force: true });
    await page.waitForTimeout(1500);
    const inGame = await page.locator('.action-bar').count();
    const loadedPlayer = await page.evaluate(() => {
      const r = localStorage.getItem('chongzhen_autosave');
      if (!r) return null;
      return JSON.parse(r).playerName;
    });
    console.log('--- 点"继续游戏"后 ---');
    console.log('  进入游戏(inGame):', inGame > 0 ? '✓' : '✗');
    console.log('  载入的玩家名:', loadedPlayer);
  }

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
