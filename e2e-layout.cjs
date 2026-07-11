// 截图验证主菜单布局
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    // 注入假 autosave 让"继续游戏"按钮也显示
    localStorage.setItem('chongzhen_autosave', JSON.stringify({
      playerName: '玩家',
      gameState: { currentYear: 1628, currentMonth: 5, turn: 4 },
      character: { name: '玩家', degree: '进士', rank: '知县' },
      origin: '寒门',
      degree: '进士',
      identityType: 'official',
      savedAt: new Date().toISOString()
    }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // 截图
  await page.screenshot({ path: 'c:/Users/moli/Desktop/Trae/chongzhen-game/title-after.png', fullPage: false });
  console.log('截图: c:/Users/moli/Desktop/Trae/chongzhen-game/title-after.png');

  // 检查按钮位置
  const positions = await page.evaluate(() => {
    const out = {};
    const center = document.querySelector('.title-buttons');
    const corner = document.querySelector('.title-corner-buttons');
    if (center) {
      const r = center.getBoundingClientRect();
      out.centerButtons = { x: r.x, y: r.y, w: r.width, h: r.height, inCenter: r.x + r.width / 2 };
    }
    if (corner) {
      const r = corner.getBoundingClientRect();
      out.cornerButtons = { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    out.viewport = { w: window.innerWidth, h: window.innerHeight };
    return out;
  });
  console.log(JSON.stringify(positions, null, 2));

  // 列表按钮
  const visible = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.title-screen button'));
    return btns.filter(b => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map(b => ({
      text: b.textContent.trim().replace(/\s+/g, ' ').slice(0, 30),
      class: b.className,
      x: Math.round(b.getBoundingClientRect().x),
      y: Math.round(b.getBoundingClientRect().y)
    }));
  });
  console.log('--- 按钮位置 ---');
  visible.forEach(b => console.log(`  [${b.x},${b.y}] ${b.class.padEnd(25)} "${b.text}"`));

  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
