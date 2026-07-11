const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(2500); // 等字体加载 + 6 层背景渲染

  // 检查关键元素
  const check = await page.evaluate(() => {
    const main = document.querySelector('.title-main');
    const sub = document.querySelector('.title-sub');
    const frame = document.querySelector('.title-frame');
    const layers = document.querySelectorAll('.title-bg-layer');
    const bgm = document.querySelector('.bgm-toggle');
    const mainStyle = main ? window.getComputedStyle(main) : null;
    return {
      hasMain: !!main,
      mainText: main?.textContent,
      mainFont: mainStyle?.fontFamily,
      mainColor: mainStyle?.color,
      mainSize: mainStyle?.fontSize,
      subText: sub?.textContent,
      hasFrame: !!frame,
      bgLayerCount: layers.length,
      hasBgm: !!bgm,
      bgmText: bgm?.textContent,
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
    };
  });

  await page.screenshot({ path: 'shot-title.png', fullPage: false });
  console.log('=== CHECK ===');
  console.log(JSON.stringify(check, null, 2));
  console.log('=== ERRORS ===');
  console.log(errors);

  await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
