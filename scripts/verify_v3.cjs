// 不主动 import 任何东西，看 React 真实错误
const { chromium } = require('C:/Users/moli/Desktop/Trae/chongzhen-game/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  const warns = [];
  page.on('pageerror', e => errs.push(e.toString()));
  page.on('console', m => {
    if (m.type() === 'error') errs.push(`[console.error] ${m.text()}`);
    if (m.type() === 'warning') warns.push(m.text());
  });

  await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(5000);

  const fixed = await page.locator('.bgm-toggle--fixed').count();
  const inline = await page.locator('.bgm-toggle--inline').count();
  const titleChildren = await page.locator('.title-screen > *').count();
  const rootHTML = await page.locator('#root').innerHTML();
  const rootLen = rootHTML.length;

  console.log('=== 验证 (无主动 import) ===');
  console.log('fixed BGM:', fixed);
  console.log('inline BGM:', inline);
  console.log('title-screen 子元素数:', titleChildren);
  console.log('#root 长度:', rootLen);
  if (rootLen < 500) console.log('#root 内容:', rootHTML);

  if (errs.length) {
    console.log('\n=== Page 错误 ===');
    for (const e of errs) console.log(e);
  } else {
    console.log('\n无 Page 错误');
  }

  if (warns.length) {
    console.log('\n=== Warnings ===');
    for (const w of warns.slice(0, 10)) console.log(w);
  }

  // FPS
  const fps = await page.evaluate(() => new Promise(resolve => {
    let f = 0;
    const s = performance.now();
    function tick() { f++; if (performance.now() - s < 1000) requestAnimationFrame(tick); else resolve(f); }
    requestAnimationFrame(tick);
  }));
  console.log('\n主菜单 FPS:', fps);

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
