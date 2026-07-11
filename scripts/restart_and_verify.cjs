// 通过 Node 杀 vite 进程 + 重启 + 等就绪 + Playwright 验证
const { exec, spawn } = require('child_process');
const { chromium } = require('C:/Users/moli/Desktop/Trae/chongzhen-game/node_modules/playwright');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function killAllNode() {
  return new Promise((resolve) => {
    exec('taskkill /F /IM node.exe /T', (err, stdout) => {
      console.log('taskkill 输出:', stdout);
      resolve();
    });
  });
}

async function startDev() {
  return new Promise((resolve) => {
    const proc = spawn('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass',
      '-Command', "cd 'C:\\Users\\moli\\Desktop\\Trae\\chongzhen-game'; npm run dev"
    ], { detached: true, stdio: 'pipe' });

    let started = false;
    proc.stdout.on('data', (d) => {
      const s = d.toString();
      if (s.includes('ready in') && !started) {
        started = true;
        console.log('Vite 启动:', s.split('\n').filter(l => l.includes('Local') || l.includes('ready')).join('\n'));
        resolve(proc);
      }
    });
    proc.stderr.on('data', (d) => process.stderr.write(d));
  });
}

async function verify() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.toString()));

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const fixed = await page.locator('.bgm-toggle--fixed').count();
  const inline = await page.locator('.bgm-toggle--inline').count();
  const titleChildren = await page.locator('.title-screen > *').count();
  const rootHTML = await page.locator('#root').innerHTML();

  console.log('\n=== 验证结果 ===');
  console.log('fixed BGM:', fixed);
  console.log('inline BGM:', inline);
  console.log('title-screen 子元素数:', titleChildren);
  console.log('#root 长度:', rootHTML.length);
  console.log('前 500 字符:', rootHTML.slice(0, 500));
  console.log('\n=== Page 错误 ===');
  for (const e of errs) console.log(e);

  if (fixed > 0) {
    const bbox = await page.locator('.bgm-toggle--fixed').first().boundingBox();
    const text = await page.locator('.bgm-toggle--fixed').first().innerText();
    console.log('\n✓ BGM 按钮位置:', JSON.stringify(bbox), 'text:', text);
  }

  // FPS 测试
  const fps = await page.evaluate(() => new Promise(resolve => {
    let f = 0;
    const s = performance.now();
    function tick() { f++; if (performance.now() - s < 1000) requestAnimationFrame(tick); else resolve(f); }
    requestAnimationFrame(tick);
  }));
  console.log('主菜单 FPS:', fps);

  await browser.close();
}

(async () => {
  console.log('=== 杀 node 进程 ===');
  await killAllNode();
  await sleep(2000);
  console.log('=== 启 dev server ===');
  await startDev();
  await sleep(2000);
  console.log('=== Playwright 验证 ===');
  await verify();
  console.log('=== 完成 ===');
})();
