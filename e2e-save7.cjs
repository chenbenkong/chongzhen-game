// 直接验证 getAutosavePreview 是否能读到数据
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // setup 流程（已确认）
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

  // 关掉 tutorial
  for (let i = 0; i < 5; i++) {
    const closeBtn = page.locator('.tutorial-overlay button:has-text("×"), .tutorial-overlay .close-btn').first();
    if (await closeBtn.count() > 0 && await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    } else { break; }
  }
  await page.waitForTimeout(500);

  // 直接 reload 页面，模拟"从主菜单进入"
  // 然后检查 title 阶段 App.tsx 的 autosavePreview 状态
  console.log('--- reload 前 localStorage ---');
  const before = await page.evaluate(() => {
    return {
      autosave: !!localStorage.getItem('chongzhen_autosave'),
      length: (localStorage.getItem('chongzhen_autosave') || '').length
    };
  });
  console.log(JSON.stringify(before));

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // reload 后看主菜单
  const visible = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.title-buttons button, .title-screen button'));
    return btns.filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map(b => b.textContent.trim().replace(/\s+/g, ' '));
  });
  console.log('--- reload 后主菜单按钮 ---');
  visible.forEach(l => console.log('  ', l));

  const hasLoad = visible.some(l => /读取存档|读 取 存 档/.test(l));
  const hasContinue = visible.some(l => /继续游戏|继 续 游 戏/.test(l));
  console.log('  读取存档:', hasLoad ? '✓' : '✗');
  console.log('  继续游戏:', hasContinue ? '✓' : '✗');

  // 同时检查 React 组件的 autosavePreview state
  // 这不容易直接拿到，但可以通过重新调用 getAutosavePreview 验证
  const preview = await page.evaluate(() => {
    // 模拟 App.tsx 的 useEffect
    const r = localStorage.getItem('chongzhen_autosave');
    if (!r) return { hasRaw: false };
    try {
      const j = JSON.parse(r);
      return {
        hasRaw: true,
        hasChar: !!j.character,
        hasGS: !!j.gameState,
        player: j.playerName,
        turn: j.gameState?.turn,
        year: j.gameState?.currentYear,
        month: j.gameState?.currentMonth,
        relationships: j.character?.relationships,
        family: !!j.character?.family,
      };
    } catch (e) { return { parseError: e.message }; }
  });
  console.log('--- 解析 autosave ---');
  console.log(JSON.stringify(preview, null, 2));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
