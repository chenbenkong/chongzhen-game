// 直接用现有 dev server，但 hard reload 清缓存
const { chromium } = require('C:/Users/moli/Desktop/Trae/chongzhen-game/node_modules/playwright');

async function verify() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    bypassCSP: true
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.toString()));
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') {
      console.log(`[${m.type()}] ${m.text()}`);
    }
  });

  // Hard reload - bypass HTTP cache
  await page.route('**/*', route => route.continue());
  await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(5000);

  const fixed = await page.locator('.bgm-toggle--fixed').count();
  const inline = await page.locator('.bgm-toggle--inline').count();
  const titleChildren = await page.locator('.title-screen > *').count();
  const rootHTML = await page.locator('#root').innerHTML();
  const rootLen = rootHTML.length;

  console.log('\n=== 验证 ===');
  console.log('fixed BGM:', fixed);
  console.log('inline BGM:', inline);
  console.log('title-screen 子元素数:', titleChildren);
  console.log('#root 长度:', rootLen);
  if (rootLen < 500) {
    console.log('#root 内容:', rootHTML);
  }

  if (errs.length) {
    console.log('\n=== Page 错误 ===');
    for (const e of errs) console.log(e);
  }

  // 看浏览器实际拿到的 ActionBar.tsx 模块
  const actionBarSrc = await page.evaluate(async () => {
    const m = await import('/src/components/ActionBar.tsx');
    return Object.keys(m);
  });
  console.log('\n=== ActionBar.tsx 运行时 exports ===');
  console.log(actionBarSrc);

  // 看实际 useContext 抛错情况
  const hasError = await page.evaluate(() => {
    return document.querySelector('.error-boundary') !== null;
  });
  console.log('ErrorBoundary 触发:', hasError);

  await browser.close();
}

verify().catch(e => { console.error(e); process.exit(1); });
