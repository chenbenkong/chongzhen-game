// 验证：事件出现时自动存档是否更新
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

  // 1) 进游戏时
  const a1 = await autosaveSnapshot(page);
  console.log('[进游戏后] turn=' + a1.turn + ' currentEventId=' + a1.currentEventId);

  // 2) 点"下月"
  await page.locator('.action-bar button:has-text("下 月")').first().click({ force: true });
  await page.waitForTimeout(500);
  const a2 = await autosaveSnapshot(page);
  console.log('[点下月后] turn=' + a2.turn + ' currentEventId=' + a2.currentEventId);

  // 3) 等 500ms 看看事件出现时自动存档
  await page.waitForTimeout(1000);
  const a3 = await autosaveSnapshot(page);
  console.log('[事件出现后] turn=' + a3.turn + ' currentEventId=' + a3.currentEventId);

  // 4) 选事件选项
  const ev = await page.locator('.event-modal button, [class*="event"] button, [class*="choice"] button').all();
  let pickedOne = false;
  for (const b of ev) {
    if (!await b.isVisible().catch(() => false)) continue;
    const t = (await b.innerText()).trim();
    if (!t || t.length < 2 || t.length > 80) continue;
    if (/^(下 月|存 档|主菜单|成就|帮助|↩|🏆|❓|💾|✕|×|知道了|下一 步|下 一步|完 毕|开 始|关闭|取 消|确 定|确 认|暂 不)/.test(t)) continue;
    try { await b.click({ force: true, timeout: 1500 }); console.log('选: ' + t.slice(0, 30)); pickedOne = true; break; } catch {}
  }
  if (pickedOne) {
    await page.waitForTimeout(1000);
    const a4 = await autosaveSnapshot(page);
    console.log('[选完事件后] turn=' + a4.turn + ' currentEventId=' + a4.currentEventId);
  }

  // 5) 再点几次下月
  for (let i = 0; i < 3; i++) {
    // 先选事件
    const ev2 = await page.locator('.event-modal button, [class*="event"] button, [class*="choice"] button').all();
    for (const b of ev2) {
      if (!await b.isVisible().catch(() => false)) continue;
      const t = (await b.innerText()).trim();
      if (!t || t.length < 2 || t.length > 80) continue;
      if (/^(下 月|存 档|主菜单|成就|帮助|↩|🏆|❓|💾|✕|×|知道了|下一 步|下 一步|完 毕|开 始|关闭|取 消|确 定|确 认|暂 不)/.test(t)) continue;
      try { await b.click({ force: true, timeout: 1500 }); break; } catch {}
    }
    await page.locator('.action-bar button:has-text("下 月")').first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
  }
  const a5 = await autosaveSnapshot(page);
  console.log('[玩 3 回合后] turn=' + a5.turn + ' currentEventId=' + a5.currentEventId);

  console.log('\n--- autosave 日志 ---');
  logs.filter(l => l.includes('[autosave]')).forEach(l => console.log(l));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });

async function autosaveSnapshot(page) {
  return await page.evaluate(() => {
    const r = localStorage.getItem('chongzhen_autosave');
    if (!r) return { turn: -1, currentEventId: null };
    try {
      const j = JSON.parse(r);
      return {
        turn: j.gameState?.turn,
        currentEventId: j.currentEventId,
        year: j.gameState?.currentYear,
        month: j.gameState?.currentMonth,
        bytes: r.length
      };
    } catch { return { turn: -2, currentEventId: null }; }
  });
}
