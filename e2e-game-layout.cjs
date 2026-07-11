// 验证游戏内布局
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

  // 注入一个完整的 autosave 直接进游戏
  await page.evaluate(() => {
    const save = {
      playerName: '胡致远',
      character: {
        name: '胡致远', age: 22, origin: '寒门', rank: '正七品·知县', degree: '进士',
        attributes: { 财帛: 80, 文韬: 30, 理政: 65, 武略: 15, 体质: 50, 威望: 0, 人脉: 0, 魅力: 0, 运气: 0 },
        hidden: { 道德值: 30, 欲望值: 50, 野心值: 40 },
        flags: [], history: [], wives: [], lovers: [], examHistory: [],
        promotionCount: 0, demotionCount: 0,
        faction: { 东林好感: 50, 阉党好感: 50, 立场: '未定', 党争烈度: 30 },
        relationships: {}
      },
      gameState: { currentYear: 1628, currentMonth: 1, turn: 0,
        圣眷: 30, 中官: 40, 清议: 20, 士绅: 50, 民望: 20, 国势: 75 },
      eventHistory: [], origin: '寒门', degree: '进士',
      identityType: 'official', lifeRecords: [],
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('chongzhen_autosave', JSON.stringify(save));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 点"继续游戏"进游戏
  await page.locator('button:has-text("继续游戏")').first().click();
  await page.waitForTimeout(1500);

  // 关 tutorial
  for (let i = 0; i < 5; i++) {
    const closeBtn = page.locator('.tutorial-overlay button:has-text("×"), .tutorial-overlay .close-btn').first();
    if (await closeBtn.count() > 0 && await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    } else { break; }
  }
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'c:/Users/moli/Desktop/Trae/chongzhen-game/game-after.png' });
  console.log('截图: c:/Users/moli/Desktop/Trae/chongzhen-game/game-after.png');

  // 布局检查
  const positions = await page.evaluate(() => {
    const out = {};
    const statusBar = document.querySelector('.status-bar');
    const sidebar = document.querySelector('.sidebar');
    const rightSidebar = document.querySelector('.right-sidebar');
    const main = document.querySelector('.main-content');
    const meritPanel = document.querySelector('.merit-panel');
    const helper = (el) => el ? { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
    out.statusBar = helper(statusBar);
    out.sidebar = helper(sidebar);
    out.rightSidebar = helper(rightSidebar);
    out.main = helper(main);
    out.meritPanel = helper(meritPanel);
    out.viewport = { w: window.innerWidth, h: window.innerHeight };
    return out;
  });
  console.log(JSON.stringify(positions, null, 2));

  // merit-panel 在右 sidebar 里面？
  const meritInRight = await page.evaluate(() => {
    const mp = document.querySelector('.merit-panel');
    if (!mp) return null;
    let el = mp.parentElement;
    while (el) {
      if (el.classList && el.classList.contains('right-sidebar')) return true;
      if (el.classList && el.classList.contains('sidebar')) return false;
      el = el.parentElement;
    }
    return null;
  });
  console.log('merit-panel 在右边:', meritInRight);

  // 顶部 statusBar 下边沿到 main content 顶部的距离（应该小）
  const gap = await page.evaluate(() => {
    const sb = document.querySelector('.status-bar');
    const mc = document.querySelector('.main-content');
    if (!sb || !mc) return null;
    return Math.round(mc.getBoundingClientRect().y - sb.getBoundingClientRect().bottom);
  });
  console.log('status-bar 底到 main-content 顶的距离:', gap);

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
