// 深挖为什么 React 渲染不出来
const { chromium } = require('C:/Users/moli/Desktop/Trae/chongzhen-game/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  const consoleLogs = [];
  const pageErrors = [];
  page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => pageErrors.push(err.toString()));

  console.log('=== goto 5173 ===');
  await page.goto('http://localhost:5173', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(5000);

  // root 内容
  const rootHTML = await page.locator('#root').innerHTML();
  console.log('\n=== #root innerHTML 长度 ===', rootHTML.length);
  console.log('前 2000 字符:\n', rootHTML.slice(0, 2000));

  // 所有 class
  const allClasses = await page.evaluate(() => {
    const els = document.querySelectorAll('*');
    const set = new Set();
    els.forEach(e => e.className && typeof e.className === 'string' && set.add(e.className));
    return Array.from(set);
  });
  console.log('\n=== 所有 CSS class ===');
  console.log(allClasses);

  // 所有 button 文本
  const allBtns = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.innerText || b.textContent);
  });
  console.log('\n=== 所有 button 文本 ===');
  console.log(allBtns);

  // 错误边界是否触发
  const errorBoundary = await page.locator('.error-boundary').count();
  console.log('\n=== ErrorBoundary 是否触发 ===', errorBoundary);

  console.log('\n=== Console 日志 ===');
  for (const log of consoleLogs) console.log(log);

  console.log('\n=== Page 错误 ===');
  for (const err of pageErrors) console.log(err);

  await browser.close();
})().catch(err => {
  console.error('脚本失败:', err);
  process.exit(1);
});
