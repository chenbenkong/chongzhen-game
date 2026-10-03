/**
 * 多分辨率布局回归 —— 在真实浏览器里逐档视口检查横向溢出与关键控件可见性。
 *
 * 用法（先在仓库根目录 npm run build && npx vite preview --port 4173）：
 *   cd tests && npm run test:layout
 *
 * 每个视口做三件事：
 *   1. 断言 documentElement.scrollWidth 不超过视口宽度（横向溢出的硬指标）
 *   2. 断言标题框、右下角按钮组、难度选择器都完整落在视口内
 *   3. 截图存到 tests/screenshots/
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173/'
const SHOT_DIR = new URL('./screenshots/', import.meta.url).pathname.replace(/^\//, '')

const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 640, note: '最小手机竖屏' },
  { name: 'phone-390', width: 390, height: 844, note: 'iPhone 14 竖屏' },
  { name: 'phone-844-landscape', width: 844, height: 390, note: '手机横屏' },
  { name: 'tablet-768', width: 768, height: 1024, note: '平板竖屏（旧版标题框会在此溢出）' },
  { name: 'tablet-820', width: 820, height: 1180, note: 'iPad Air 竖屏' },
  { name: 'laptop-1024', width: 1024, height: 768, note: '小平板/小笔电' },
  { name: 'laptop-1280', width: 1280, height: 800, note: 'Steam Deck 分辨率' },
  { name: 'desktop-1440', width: 1440, height: 900, note: '常规桌面' },
  { name: 'desktop-1920', width: 1920, height: 1080, note: '全高清' }
]

const failures = []

function pass(msg) {
  console.log(`  \u2713 ${msg}`)
}
function fail(msg) {
  failures.push(msg)
  console.log(`  \u2717 ${msg}`)
}

/** 判断元素是否完整落在视口内 */
const WITHIN_VIEWPORT = `(sel) => {
  const el = document.querySelector(sel)
  if (!el) return { found: false }
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden') return { found: true, hidden: true }
  return {
    found: true,
    hidden: false,
    left: Math.round(r.left),
    right: Math.round(r.right),
    top: Math.round(r.top),
    bottom: Math.round(r.bottom),
    width: Math.round(r.width),
    height: Math.round(r.height),
    overflowRight: Math.round(r.right - window.innerWidth),
    overflowLeft: Math.round(-r.left),
    overflowBottom: Math.round(r.bottom - window.innerHeight)
  }
}`

async function checkViewport(browser, vp) {
  console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) — ${vp.note} ===`)
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.width <= 480,
    hasTouch: vp.width <= 1024
  })
  const page = await context.newPage()
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 60000 })
  await page.waitForTimeout(2200)

  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    innerWidth: window.innerWidth,
    scrollHeight: document.documentElement.scrollHeight,
    innerHeight: window.innerHeight
  }))

  const overflowX = metrics.scrollWidth - metrics.clientWidth
  if (overflowX <= 1) {
    pass(`无横向溢出 (scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth})`)
  } else {
    fail(`横向溢出 ${overflowX}px (scrollWidth=${metrics.scrollWidth} > clientWidth=${metrics.clientWidth})`)
  }

  for (const sel of ['.title-frame', '.title-difficulty', '.title-corner-buttons', '.title-main']) {
    const box = await page.evaluate(new Function('sel', `return (${WITHIN_VIEWPORT})(sel)`), sel)
    if (!box.found) {
      fail(`${sel} 不存在`)
      continue
    }
    if (box.hidden) {
      fail(`${sel} 处于隐藏状态`)
      continue
    }
    if (box.overflowRight > 1 || box.overflowLeft > 1) {
      fail(
        `${sel} 横向超出视口 ${Math.max(box.overflowRight, box.overflowLeft)}px ` +
          `(left=${box.left}, right=${box.right}, 视口宽=${vp.width})`
      )
    } else {
      pass(`${sel} 完整落在视口内 (${box.width}x${box.height})`)
    }
  }

  // 纵向关键断言：主按钮「开 始 仕 途」必须在首屏内，不能要求玩家先滚动。
  // 这是矮屏（手机竖屏、横屏手机、小窗口）最容易踩的体验问题。
  const cta = await page.evaluate(
    new Function(
      'sel',
      `return (${WITHIN_VIEWPORT})(sel)`
    ),
    '.title-btn'
  )
  if (!cta.found || cta.hidden) {
    fail('主按钮 .title-btn 不存在或不可见')
  } else if (cta.overflowBottom > 1) {
    fail(
      `主按钮被挤到首屏之外，需向下滚动 ${cta.overflowBottom}px 才能点击 ` +
        `(top=${cta.top}, bottom=${cta.bottom}, 视口高=${vp.height})`
    )
  } else {
    pass(`主按钮在首屏内 (top=${cta.top}, bottom=${cta.bottom} / 视口高 ${vp.height})`)
  }

  await page.screenshot({ path: `${SHOT_DIR}vp-${vp.name}.png` })
  await context.close()
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  for (const vp of VIEWPORTS) {
    await checkViewport(browser, vp)
  }
  await browser.close()

  console.log('\n' + '='.repeat(60))
  if (failures.length > 0) {
    console.log(`布局回归未通过，共 ${failures.length} 项：`)
    failures.forEach(f => console.log(`  \u2717 ${f}`))
    process.exit(1)
  }
  console.log('布局回归通过：所有视口均无横向溢出，关键控件均在视口内')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
