/**
 * Steam 商店页物料生成器
 * =============================================================================
 * Steam 后台对每张图都有**精确到像素**的尺寸要求，传错会被直接拒绝。
 * 这里一次性把全套物料按正确尺寸产出到 store-assets/。
 *
 * 两类产物：
 *  A. 胶囊图 / 背景图 —— 用游戏封面 + 标题排版合成（纯视觉，不含玩法信息）
 *  B. 截图 —— 用真实浏览器跑进游戏后截屏，所以展示的是玩家实际看到的画面
 *
 * 用法（先构建并起预览服务）：
 *   npm run build
 *   npx vite preview --port 4173
 *   cd tests && node store-assets.mjs [baseUrl]
 *
 * 产物清单见 README-STORE.md。
 *
 * ⚠️ 这些是**合规尺寸的占位物料**，用来先把后台配置流程跑通。
 *    正式发行前建议请美术重做封面与截图 —— 自动合成的排版达不到商业物料的品质。
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const BASE_URL = process.argv[2] || 'http://localhost:4173/'
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'store-assets')
const COVER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'cover-landscape.webp')

mkdirSync(OUT, { recursive: true })

if (!existsSync(COVER)) {
  console.error(`找不到封面图：${COVER}\n请先确认 src/assets/cover-landscape.webp 存在。`)
  process.exit(1)
}

const coverUrl = pathToFileURL(COVER).href
const coverData = 'data:image/webp;base64,' + readFileSync(COVER).toString('base64')

/**
 * 胶囊图与背景图的排版模板。
 * 字号用视口宽度按比例算，保证任何尺寸下标题占比一致。
 */
const CAPSULE_HTML = ({ w, h, title, sub, scale, align }) => `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:${w}px; height:${h}px; overflow:hidden;
    background:#0A0807;
    font-family:'Songti SC','STSong','SimSun','Noto Serif CJK SC',serif;
    display:flex; flex-direction:column;
    align-items:${align === 'center' ? 'center' : 'flex-start'};
    justify-content:center;
    padding:${Math.round(h * 0.1)}px ${Math.round(w * 0.07)}px;
    position:relative;
  }
  /* 封面图放大并轻微模糊：源图自带一圈硬边框与内嵌标题，
     直接 cover 会让那个矩形边角非常明显。放大 1.25 倍并柔化后
     它就退化成一层氛围底纹，不再与叠加的标题打架。 */
  .art {
    position:absolute; inset:-25%;
    background:#0A0807 url('__COVER__') center/cover no-repeat;
    filter:blur(3px) saturate(1.05);
    transform:scale(1.25);
  }
  body::before {
    content:''; position:absolute; inset:0;
    background:linear-gradient(${align === 'center' ? '180deg' : '100deg'},
      rgba(10,8,7,.52) 0%, rgba(10,8,7,.80) 55%, rgba(10,8,7,.95) 100%);
  }
  /* 四角压暗，进一步把视线收回中间的标题 */
  body::after {
    content:''; position:absolute; inset:0;
    background:radial-gradient(ellipse 78% 78% at center, transparent 42%, rgba(10,8,7,.75) 100%);
  }
  .gold { color:#C5A55A; }
  .parchment { color:#F5E6C8; }
  h1 {
    font-size:${Math.round(h * scale)}px; line-height:1.25; letter-spacing:${Math.round(h * scale * 0.12)}px;
    text-shadow:0 ${Math.max(2, Math.round(h*0.008))}px ${Math.round(h*0.03)}px rgba(0,0,0,.9);
    position:relative; z-index:1; font-weight:600; margin:0;
  }
  .rule {
    width:${Math.round(w*0.22)}px; height:${Math.max(2, Math.round(h*0.008))}px;
    background:linear-gradient(90deg, transparent, #C5A55A, transparent);
    margin:${Math.round(h*0.06)}px 0; position:relative; z-index:1;
  }
  p {
    font-size:${Math.round(h*scale*0.30)}px; letter-spacing:${Math.round(h*scale*0.05)}px;
    color:rgba(245,230,200,.82); position:relative; z-index:1; line-height:1.6; margin:0;
    text-align:${align === 'center' ? 'center' : 'left'};
  }
</style></head>
<body>
  <div class="art"></div>
  <h1 class="gold">${title}</h1>
  <div class="rule"></div>
  <p class="parchment">${sub}</p>
</body></html>`

const TITLE = '崇祯 · 宦海浮沉'
const SUB = '明末十七年 · 科举与党争之间'

/** 尺寸取自 Steamworks 后台「商店页」各栏要求 */
const LAYOUTS = [
  { file: 'capsule-header-460x215.png',    w: 460,  h: 215,  scale: 0.30, align: 'flex-start' },
  { file: 'capsule-small-231x87.png',      w: 231,  h: 87,   scale: 0.34, align: 'flex-start' },
  { file: 'capsule-main-616x353.png',      w: 616,  h: 353,  scale: 0.26, align: 'center' },
  { file: 'capsule-vertical-374x448.png',  w: 374,  h: 448,  scale: 0.17, align: 'center' },
  { file: 'page-background-1438x810.png',  w: 1438, h: 810,  scale: 0.17, align: 'center' },
  { file: 'library-capsule-600x900.png',   w: 600,  h: 900,  scale: 0.13, align: 'center' },
  { file: 'library-hero-3840x1240.png',    w: 3840, h: 1240, scale: 0.13, align: 'center' }
]

const browser = await chromium.launch({ headless: true })
const written = []

// ---------------------------------------------------------------------------
// A. 胶囊图与背景图
// ---------------------------------------------------------------------------
for (const L of LAYOUTS) {
  const ctx = await browser.newContext({ viewport: { width: L.w, height: L.h }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  // 用 data URL 内联封面，避免 file:// 下的跨源限制
  const html = CAPSULE_HTML({ ...L, title: TITLE, sub: SUB }).replace('__COVER__', coverData)
  await page.setContent(html, { waitUntil: 'load' })
  await page.waitForTimeout(250)
  const buf = await page.screenshot({ type: 'png' })
  writeFileSync(path.join(OUT, L.file), buf)
  written.push({ file: L.file, size: `${L.w}x${L.h}`, kind: '排版合成' })
  await ctx.close()
}

// ---------------------------------------------------------------------------
// B. 截图 —— 真实游戏画面
// ---------------------------------------------------------------------------
const SHOT_W = 1920
const SHOT_H = 1080

async function shotGame() {
  const ctx = await browser.newContext({ viewport: { width: SHOT_W, height: SHOT_H }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(2500)

  // 1) 标题屏
  let buf = await page.screenshot({ type: 'png' })
  writeFileSync(path.join(OUT, 'screenshot-01-title.png'), buf)
  written.push({ file: 'screenshot-01-title.png', size: `${SHOT_W}x${SHOT_H}`, kind: '真实截屏' })

  // 2) 取名
  await page.locator('.title-btn', { hasText: '开' }).first().click()
  await page.waitForTimeout(600)
  buf = await page.screenshot({ type: 'png' })
  writeFileSync(path.join(OUT, 'screenshot-02-naming.png'), buf)
  written.push({ file: 'screenshot-02-naming.png', size: `${SHOT_W}x${SHOT_H}`, kind: '真实截屏' })

  // 3) 出身选择
  const inputs = page.locator('.setup-screen input[type="text"], .setup-screen input:not([type])')
  const n = await inputs.count()
  for (let i = 0; i < n; i++) {
    const el = inputs.nth(i)
    if (!(await el.inputValue().catch(() => ''))) await el.fill(['张', '伯安', '苏州府'][i] || '张').catch(() => {})
  }
  await page.locator('.setup-screen .confirm-btn').first().click()
  await page.waitForTimeout(700)
  buf = await page.screenshot({ type: 'png' })
  writeFileSync(path.join(OUT, 'screenshot-03-origin.png'), buf)
  written.push({ file: 'screenshot-03-origin.png', size: `${SHOT_W}x${SHOT_H}`, kind: '真实截屏' })

  // 4) 主玩法（事件 + 属性 + 抉择）
  await page.locator('.origin-card button, .origin-card').first().click().catch(() => {})
  await page.waitForTimeout(2000)
  buf = await page.screenshot({ type: 'png' })
  writeFileSync(path.join(OUT, 'screenshot-04-gameplay.png'), buf)
  written.push({ file: 'screenshot-04-gameplay.png', size: `${SHOT_W}x${SHOT_H}`, kind: '真实截屏' })

  // 5) 结局图鉴
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const codex = btns.find(b => /图鉴/.test(b.textContent || ''))
    if (codex) codex.click()
  })
  await page.waitForTimeout(1200)
  if (await page.locator('.codex-tab, .codex-container, [class*=codex]').count()) {
    buf = await page.screenshot({ type: 'png' })
    writeFileSync(path.join(OUT, 'screenshot-05-codex.png'), buf)
    written.push({ file: 'screenshot-05-codex.png', size: `${SHOT_W}x${SHOT_H}`, kind: '真实截屏' })
  }

  // 6) 成就面板
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const a = btns.find(b => /成就/.test(b.textContent || ''))
    if (a) a.click()
  })
  await page.waitForTimeout(1200)
  if (await page.locator('[class*=achievement]').count()) {
    buf = await page.screenshot({ type: 'png' })
    writeFileSync(path.join(OUT, 'screenshot-06-achievements.png'), buf)
    written.push({ file: 'screenshot-06-achievements.png', size: `${SHOT_W}x${SHOT_H}`, kind: '真实截屏' })
  }

  await ctx.close()
}

try {
  await shotGame()
} catch (e) {
  console.error(`截图环节失败（不影响已生成的胶囊图）：${e.message}`)
  console.error('请确认预览服务已启动：npx vite preview --port 4173')
}

await browser.close()

// ---------------------------------------------------------------------------
// 清单
// ---------------------------------------------------------------------------
const realShots = written.filter(w => w.kind === '真实截屏').length
const manifest = [
  '# Steam 商店页物料清单',
  '',
  `生成时间：${new Date().toISOString()}`,
  `来源页面：${BASE_URL}`,
  '',
  '## 已产出',
  '',
  '| 文件 | 尺寸 | 类型 |',
  '| --- | --- | --- |',
  ...written.map(w => `| \`${w.file}\` | ${w.size} | ${w.kind} |`),
  '',
  '## 上传到 Steamworks 后台的对应位置',
  '',
  '| 文件 | 后台位置 |',
  '| --- | --- |',
  '| `capsule-header-460x215.png` | 商店页 → 主要胶囊图（Header Capsule） |',
  '| `capsule-small-231x87.png` | 商店页 → 小型胶囊图（Small Capsule） |',
  '| `capsule-main-616x353.png` | 商店页 → 主胶囊图（Main Capsule） |',
  '| `capsule-vertical-374x448.png` | 商店页 → 纵向胶囊图（Vertical Capsule） |',
  '| `page-background-1438x810.png` | 商店页 → 页面背景（Page Background） |',
  '| `library-capsule-600x900.png` | 库页面 → 胶囊图（Library Capsule） |',
  '| `library-hero-3840x1240.png` | 库页面 → Hero 横幅（Library Hero） |',
  ...written.filter(w => w.kind === '真实截屏').map(w => `| \`${w.file}\` | 商店页 → 截图 |`),
  '',
  '## 尚未覆盖',
  '',
  '- **Library Logo（1280×720 透明 PNG）** —— 需要美术出带透明通道的字标，',
  '  自动合成无法产出合格的透明 logo，故未生成。',
  '- **宣传片 Trailer** —— 需录屏剪辑。',
  '',
  '## 重要提醒',
  '',
  realShots >= 5
    ? `✅ 截图 ${realShots} 张，满足 Steam「至少 5 张、分辨率不低于 1920×1080」的要求。`
    : `⚠️ 只产出 ${realShots} 张截图，Steam 要求至少 5 张 1920×1080 —— 请补齐后再提交。`,
  '',
  '这些是**尺寸合规的占位物料**，用于先把后台配置流程跑通。',
  '正式发行前建议请美术重做封面与截图：自动合成的排版达不到商业物料的品质，',
  '而商店页首图直接决定点击率。',
  ''
].join('\n')

writeFileSync(path.join(OUT, 'README-STORE.md'), manifest, 'utf8')

console.log('\n已产出到 store-assets/：')
for (const w of written) console.log(`  ${w.file.padEnd(38)} ${w.size.padEnd(11)} ${w.kind}`)
console.log(`\n清单：store-assets/README-STORE.md`)
console.log(realShots >= 5
  ? `✅ 截图 ${realShots} 张，满足 Steam 要求`
  : `⚠️ 截图 ${realShots} 张，Steam 要求至少 5 张 1920×1080`)