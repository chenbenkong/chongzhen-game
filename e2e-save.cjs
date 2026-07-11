// E2E: open game, start, play 1 turn, return to menu, check localStorage
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Step 1: snapshot localStorage at title
  let ls = await page.evaluate(() => {
    const r = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      r[k] = (localStorage.getItem(k) || '').length;
    }
    return r;
  });
  console.log('--- step 1: title ---');
  console.log('localStorage keys+lengths:', JSON.stringify(ls));

  // Step 2: click "开始游戏"
  await page.locator('button:has-text("开始游戏")').click();
  await page.waitForTimeout(500);

  // Step 3: pick a character (random from origin options if there are)
  const originButtons = await page.locator('button:has-text("寒门"), button:has-text("士族"), button:has-text("军籍")').count();
  console.log('--- step 3: origin choices:', originButtons);
  if (originButtons > 0) {
    await page.locator('button:has-text("寒门")').first().click();
    await page.waitForTimeout(500);
  }
  // step 4: enter player name if asked
  const input = page.locator('input[type="text"]').first();
  if (await input.count() > 0) {
    await input.fill('测试玩家');
    await page.waitForTimeout(200);
    // confirm / start
    const confirmBtn = page.locator('button:has-text("开始"), button:has-text("确认"), button:has-text("确定")').first();
    if (await confirmBtn.count() > 0) await confirmBtn.click();
    await page.waitForTimeout(500);
  }
  // try to find "开始" or "下一" or "开始游戏" as final
  const finalStart = page.locator('button:has-text("开始游戏"):visible, button:has-text("开始"):visible').first();
  if (await finalStart.count() > 0) { try { await finalStart.click(); } catch {} }
  await page.waitForTimeout(1500);

  // Now we should be in the game (ActionBar visible)
  const actionBar = page.locator('.action-bar');
  const inGame = await actionBar.count();
  console.log('--- step 5: in game? action-bar count =', inGame);
  if (inGame === 0) {
    console.log('NOT IN GAME. last 30 logs:');
    logs.slice(-30).forEach(l => console.log(' ', l));
    // take a snapshot of current state
    const bodyText = await page.locator('body').innerText();
    console.log('body text (first 500):', bodyText.slice(0, 500));
    await page.screenshot({ path: 'c:/Users/moli/Desktop/Trae/test-snap.png', fullPage: true });
    await browser.close();
    return;
  }

  // Step 6: try to advance one month - look for 下月 button
  const nextBtn = page.locator('button:has-text("下月"), button:has-text("下 月")').first();
  if (await nextBtn.count() > 0) {
    try { await nextBtn.click(); } catch (e) { console.log('next month click err:', e.message); }
    await page.waitForTimeout(1500);
  }

  // Step 7: try the in-game "存档" button
  const saveBtn = page.locator('button:has-text("存档")').first();
  if (await saveBtn.count() > 0) {
    await saveBtn.click();
    await page.waitForTimeout(800);
  }

  // Step 8: snapshot localStorage now
  ls = await page.evaluate(() => {
    const r = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      r[k] = v ? v.length : 0;
    }
    return r;
  });
  console.log('--- step 8: after save attempt ---');
  console.log('localStorage:', JSON.stringify(ls, null, 2));

  // Step 9: close any open modal and click "主菜单" button to go back
  const esc = await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const menuBtn = page.locator('button:has-text("主菜单")').first();
  if (await menuBtn.count() > 0) {
    console.log('clicking 主菜单...');
    await menuBtn.click();
    await page.waitForTimeout(1000);
  } else {
    console.log('no 主菜单 button found!');
  }

  // Step 10: final localStorage check
  ls = await page.evaluate(() => {
    const r = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      r[k] = v ? v.length : 0;
    }
    return r;
  });
  console.log('--- step 10: after 返回主菜单 ---');
  console.log('localStorage:', JSON.stringify(ls, null, 2));

  // Step 11: are there 读取存档/继续游戏 buttons?
  const loadBtn = await page.locator('button:has-text("读取存档")').count();
  const continueBtn = await page.locator('button:has-text("继续游戏")').count();
  console.log('--- step 11: title buttons ---');
  console.log('读取存档 button count:', loadBtn);
  console.log('继续游戏 button count:', continueBtn);

  // Dump all logs
  console.log('\n--- ALL CONSOLE LOGS ---');
  logs.forEach(l => console.log(l));

  await page.screenshot({ path: 'c:/Users/moli/Desktop/Trae/test-final.png', fullPage: true });
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
