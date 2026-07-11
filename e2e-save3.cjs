// e2e 完整流程：关 tutorial → 玩 → 回主菜单看"继续游戏"
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

  // 强制清空 localStorage 重新开始
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 开始游戏
  await page.locator('button:has-text("开 始 游 戏")').first().click();
  await page.waitForTimeout(500);

  // 选寒门
  if (await page.locator('button:has-text("寒门")').count() > 0) {
    await page.locator('button:has-text("寒门")').first().click();
    await page.waitForTimeout(300);
  }
  // 名字
  const input = page.locator('input[type="text"]').first();
  if (await input.count() > 0) {
    await input.fill('测试');
    const confirm = page.locator('button:has-text("定 此 名 字")').first();
    if (await confirm.count() > 0) { await confirm.click(); await page.waitForTimeout(400); }
  }
  // 选出身
  const pickOrigin = page.locator('button:has-text("选 此 出 身")').first();
  if (await pickOrigin.count() > 0) {
    await pickOrigin.click();
    await page.waitForTimeout(800);
  }

  // 关键步骤 1: 关掉 tutorial overlay（点"知道了"或类似按钮）
  console.log('--- 关掉 tutorial ---');
  for (let i = 0; i < 6; i++) {
    const closeBtn = page.locator('.tutorial-overlay button, [class*="tutorial"] button, button:has-text("知道了"), button:has-text("开始"), button:has-text("下 一步"), button:has-text("下一 步"), button:has-text("完 毕")').first();
    if (await closeBtn.count() > 0 && await closeBtn.isVisible().catch(() => false)) {
      const t = (await closeBtn.innerText()).trim();
      await closeBtn.click();
      console.log(`  关掉第 ${i + 1} 步: "${t.slice(0, 20)}"`);
      await page.waitForTimeout(300);
    } else {
      break;
    }
  }

  await dumpLS('after-close-tutorial');

  // 关键步骤 2: 点"下月"几次，触发自动存档 fingerprint 变化
  const nextBtn = page.locator('.action-bar button:has-text("下 月")').first();
  for (let i = 0; i < 3; i++) {
    if (await nextBtn.count() > 0 && await nextBtn.isVisible().catch(() => false)) {
      // 先看是否有事件选项要选
      const eventChoice = await findEventChoice(page);
      if (eventChoice) {
        await eventChoice.click();
        await page.waitForTimeout(500);
        continue;
      }
      await nextBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  await dumpLS('after-3-months');

  // 关键步骤 3: 点存档按钮测试手动存档
  const saveBtn = page.locator('.action-bar button:has-text("存 档")').first();
  if (await saveBtn.count() > 0) {
    await saveBtn.click({ force: true });
    await page.waitForTimeout(500);
  }
  // 选 slot 1
  const slot1 = page.locator('.save-slot, [class*="save-slot"]').first();
  if (await slot1.count() > 0) {
    await slot1.click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
  }
  await dumpLS('after-save-slot1');

  // 关键步骤 4: 点"主菜单"返回
  const menuBtn = page.locator('.action-bar button:has-text("主菜单")').first();
  if (await menuBtn.count() > 0) {
    await menuBtn.click();
    await page.waitForTimeout(1500);
  }
  await dumpLS('after-return-to-menu');

  // 关键验证: 主菜单是否有"继续游戏"和"读取存档"按钮
  const loadBtn = await page.locator('button:has-text("读 取 存 档")').count();
  const continueBtn = await page.locator('button:has-text("继续游戏")').count();
  const startBtn = await page.locator('button:has-text("开 始 游 戏")').count();
  console.log('--- 主菜单按钮 ---');
  console.log('  读取存档:', loadBtn, '| 继续游戏:', continueBtn, '| 开始游戏:', startBtn);

  // 详细打印 autosave
  const autosave = await page.evaluate(() => {
    const raw = localStorage.getItem('chongzhen_autosave');
    if (!raw) return { present: false };
    try {
      const j = JSON.parse(raw);
      return { present: true, bytes: raw.length, player: j.playerName, turn: j.gameState?.turn, year: j.gameState?.currentYear, month: j.gameState?.currentMonth };
    } catch (e) { return { present: true, parseError: e.message }; }
  });
  console.log('--- autosave ---');
  console.log(JSON.stringify(autosave, null, 2));

  // 打印最后 30 条 console
  console.log('\n--- 最后 30 条 console ---');
  logs.slice(-30).forEach(l => console.log(l));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });

async function findEventChoice(page) {
  // 找事件弹窗里的选项按钮（带"一"/"二"/"三"开头或带"前往"/"接受"/"拒绝"等）
  const candidates = await page.locator('.event-modal button, [class*="event"] button, [class*="choice"] button, [class*="modal"] button').all();
  for (const b of candidates) {
    if (!await b.isVisible().catch(() => false)) continue;
    const t = (await b.innerText()).trim();
    if (!t) continue;
    // 跳过导航按钮
    if (/^(下 月|存 档|主菜单|成就|帮助|↩|🏆|❓|💾|✕|×|知道了|下一 步|下 一步|完 毕|开 始|关闭|取 消|确 定|确 认|暂 不)/.test(t)) continue;
    if (t.length < 2 || t.length > 80) continue;
    return b;
  }
  return null;
}
