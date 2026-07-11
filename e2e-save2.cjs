// Real e2e: start game, play, check localStorage
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

  function dumpLS(tag) {
    return page.evaluate(() => {
      const r = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        r[k] = (localStorage.getItem(k) || '').length;
      }
      return r;
    }).then(r => { console.log(`[${tag}] localStorage:`, JSON.stringify(r)); return r; });
  }

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await dumpLS('title');

  // Click "开 始 游 戏"
  await page.locator('button:has-text("开 始 游 戏")').first().click();
  await page.waitForTimeout(800);

  // Look for origin selection - try 寒门
  const hanmen = page.locator('button:has-text("寒门")');
  if (await hanmen.count() > 0) {
    await hanmen.first().click();
    await page.waitForTimeout(400);
  }

  // Player name input
  const input = page.locator('input[type="text"]').first();
  if (await input.count() > 0) {
    await input.fill('测试');
    await page.waitForTimeout(200);
    // confirm: 角色创建页面是"定 此 名 字"
    const confirm = page.locator('button:has-text("定 此 名 字")').first();
    if (await confirm.count() > 0) { await confirm.click(); await page.waitForTimeout(500); }
  }

  // If still in setup (origin/出身 selection page)
  const pickOrigin = page.locator('button:has-text("选 此 出 身")').first();
  if (await pickOrigin.count() > 0 && await pickOrigin.isVisible().catch(() => false)) {
    await pickOrigin.click();
    await page.waitForTimeout(800);
  }

  // Wait for ActionBar
  const inGame = await page.locator('.action-bar').count();
  console.log('--- inGame? action-bar count =', inGame);
  if (inGame === 0) {
    console.log('NOT IN GAME. body:');
    const t = await page.locator('body').innerText();
    console.log(t.slice(0, 1500));
    console.log('\nLOGS:');
    logs.slice(-30).forEach(l => console.log(l));
    await browser.close();
    return;
  }

  await dumpLS('entered-game');

  // Wait a sec for any autosave useEffect
  await page.waitForTimeout(1500);
  await dumpLS('after-1.5s');

  // Check raw autosave key directly
  const autosave = await page.evaluate(() => {
    const raw = localStorage.getItem('chongzhen_autosave');
    if (!raw) return { present: false };
    try {
      const j = JSON.parse(raw);
      return {
        present: true,
        bytes: raw.length,
        player: j.playerName,
        turn: j.gameState?.turn,
        year: j.gameState?.currentYear,
        month: j.gameState?.currentMonth,
        hasChar: !!j.character,
        hasGameState: !!j.gameState,
      };
    } catch (e) {
      return { present: true, parseError: e.message, raw: raw.slice(0, 100) };
    }
  });
  console.log('--- autosave inspection ---');
  console.log(JSON.stringify(autosave, null, 2));

  // Click 下月
  const nextBtn = page.locator('.action-bar button:has-text("下 月")').first();
  if (await nextBtn.count() > 0) {
    await nextBtn.click({ force: true }).catch(e => console.log('next click err:', e.message));
    await page.waitForTimeout(1500);
  }
  await dumpLS('after-1-month');

  // If an event appeared, pick the first option
  const eventOpt = page.locator('button:visible').filter({ hasText: /^[一二三四五六七八九\d]/ }).first();
  // Use a simpler approach: any visible button with text that's not navigation
  const allVisibleBtns = await page.locator('button:visible').all();
  for (const b of allVisibleBtns) {
    const t = (await b.innerText()).trim();
    if (t.length > 4 && t.length < 100 && !/^(下 月|存 档|主菜单|成就|帮助|↩|🏆|❓|💾|✕|×)/.test(t)) {
      try { await b.click({ timeout: 1500 }); console.log('clicked event option:', t.slice(0, 30)); break; } catch {}
    }
  }
  await page.waitForTimeout(800);
  await dumpLS('after-event-choice');

  // Now try 下月 again
  if (await nextBtn.count() > 0) {
    try { await nextBtn.click({ force: true, timeout: 3000 }); } catch (e) { console.log('next 2 err:', e.message); }
    await page.waitForTimeout(1500);
  }
  await dumpLS('after-2nd-month');

  // Click 存档 button in ActionBar
  const saveBtn = page.locator('.action-bar button:has-text("存 档")').first();
  if (await saveBtn.count() > 0) {
    await saveBtn.click();
    await page.waitForTimeout(800);
  }
  await dumpLS('after-save-click');

  // Inspect modal - if SaveSlotsModal is open, click slot 1
  const slot1 = page.locator('.save-slot, [class*="save-slot"]').first();
  if (await slot1.count() > 0) {
    try { await slot1.click({ force: true, timeout: 2000 }); await page.waitForTimeout(800); } catch {}
  }
  await dumpLS('after-slot-pick');

  // Click 主菜单 to return
  const menuBtn = page.locator('.action-bar button:has-text("主菜单")').first();
  if (await menuBtn.count() > 0) {
    await menuBtn.click();
    await page.waitForTimeout(1500);
  }
  await dumpLS('after-return-to-menu');

  // Are 读取存档 / 继续游戏 buttons present now?
  const loadBtn = await page.locator('button:has-text("读取存档")').count();
  const continueBtn = await page.locator('button:has-text("继续游戏")').count();
  const startBtn = await page.locator('button:has-text("开 始 游 戏")').count();
  console.log('--- title buttons ---');
  console.log('  读取存档:', loadBtn, '| 继续游戏:', continueBtn, '| 开始游戏:', startBtn);

  console.log('\n--- ALL LOGS ---');
  logs.forEach(l => console.log(l));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
