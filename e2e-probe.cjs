// Dump page structure to find correct selectors
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`[pageerror] ${err.message}`));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // dump button texts
  const btns = await page.locator('button').evaluateAll(els =>
    els.map(e => ({ text: e.innerText.trim().slice(0, 40), cls: e.className.slice(0, 50) }))
  );
  console.log('--- buttons on title page ---');
  console.log(JSON.stringify(btns, null, 2));

  // Try clicking any "开始" button
  const all = await page.locator('button').count();
  console.log('total buttons:', all);

  // dump body innerText first 600
  const body = await page.locator('body').innerText();
  console.log('body first 600:', body.slice(0, 600));

  await browser.close();
})();
