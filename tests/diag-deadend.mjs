import { chromium } from 'playwright'

/**
 * 判定「玩家是否会被卡住」。
 *
 * 每次状态转换后，检查**至少存在一个可推进的入口**：
 *   · 有可点的选项 / 骰子（勉力一试）
 *   · 或「继续」按钮
 *   - 或「进 下 月」可点
 *   - 或已进结局
 * 全部为否 = 死锁。
 *
 * 这个检查比"按钮能不能点"更重要：用户报的是"下月按钮点不了"，
 * 但真正要回答的是"我还能不能玩下去"。
 */
const BASE = process.argv[2] || 'http://localhost:4173/'
const b = await chromium.launch({ headless: true })
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errs = []
page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)))

await page.goto(BASE, { waitUntil: 'load', timeout: 90000 })
await page.waitForTimeout(2000)
await page.locator('.title-btn', { hasText: '开' }).first().click()
await page.waitForTimeout(500)
const ins = page.locator('.setup-screen input[type="text"], .setup-screen input:not([type])')
for (let i = 0; i < await ins.count(); i++) {
  const e = ins.nth(i)
  if (!(await e.inputValue().catch(() => ''))) await e.fill(['测试', '字明', '苏州府'][i] || 'x').catch(() => {})
}
await page.locator('.setup-screen .confirm-btn').first().click()
await page.waitForTimeout(600)
await page.locator('.origin-card button, .origin-card').first().click().catch(() => {})
await page.waitForTimeout(1500)

const inspect = () => page.evaluate(() => {
  const vis = el => {
    if (!el) return false
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0
  }
  const nextBtn = [...document.querySelectorAll('button')].find(x => /进\s*下\s*月/.test(x.textContent || ''))
  const contBtn = [...document.querySelectorAll('button')].find(x => /^\s*继\s*续\s*$/.test(x.textContent || ''))
  const choices = [...document.querySelectorAll('.choice-card')].filter(vis)
  const dice = [...document.querySelectorAll('.dice-attempt-btn')].filter(vis).filter(x => !x.disabled)
  const allLocked = choices.length > 0 && choices.every(c => c.classList.contains('locked'))

  return {
    ended: !!document.querySelector('.game-screen--ended'),
    eventTitle: document.querySelector('.event-title')?.textContent?.trim() || null,
    turn: document.body.innerText.match(/第\s*(\d+)\s*回合/)?.[1] || '?',
    pending: document.body.innerText.match(/本月尚有\s*(\d+)\s*个事件/)?.[1] || '0',
    choicesVisible: choices.filter(c => !c.classList.contains('locked')).length,
    choicesTotal: choices.length,
    allChoicesLocked: allLocked,
    diceAvailable: dice.length,
    hasContinue: vis(contBtn),
    nextEnabled: !!(nextBtn && !nextBtn.disabled),
    // 唯一的推进入口
    canAct: choices.some(c => !c.classList.contains('locked')) || dice.length > 0 || vis(contBtn) || !!(nextBtn && !nextBtn.disabled)
  }
})

const deadEnds = []
let nextEnabledSeen = 0
let allLockedSeen = 0
let steps = 0

for (let i = 0; i < 120; i++) {
  const s = await inspect()
  steps++

  if (s.allChoicesLocked) {
    allLockedSeen++
    if (!s.diceAvailable && !s.hasContinue && !s.nextEnabled) {
      deadEnds.push({ step: i, ...s, why: '所有选项锁定且无骰子/继续/下月' })
    }
  }
  if (s.nextEnabled) nextEnabledSeen++

  if (!s.canAct && !s.ended) {
    deadEnds.push({ step: i, ...s, why: '没有任何可推进的入口' })
    console.log(`\n❌ 死锁 @step ${i}: ${s.why}`)
    console.log(`   事件=${s.eventTitle} 选项=${s.choicesTotal}(可用${s.choicesVisible}) 骰子=${s.diceAvailable} 继续=${s.hasContinue} 下月=${s.nextEnabled}`)
    await page.screenshot({ path: 'deadend.png' })
    break
  }
  if (s.ended) { console.log(`\n（触发结局，结束于 step ${i}，事件=${s.eventTitle}）`); break }

  // 推进：优先点可点选项，其次骰子，再次继续，最后下月
  const acted = await page.evaluate(() => {
    const vis = el => {
      if (!el) return false
      const s = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0
    }
    const c = [...document.querySelectorAll('.choice-card')].find(x => vis(x) && !x.classList.contains('locked'))
    if (c) { c.click(); return 'choice' }
    const d = [...document.querySelectorAll('.dice-attempt-btn')].find(x => vis(x) && !x.disabled)
    if (d) { d.click(); return 'dice' }
    const cont = [...document.querySelectorAll('button')].find(x => vis(x) && /^\s*继\s*续\s*$/.test(x.textContent || ''))
    if (cont) { cont.click(); return 'continue' }
    const n = [...document.querySelectorAll('button')].find(x => /进\s*下\s*月/.test(x.textContent || '') && !x.disabled)
    if (n) { n.click(); return 'next' }
    return 'none'
  })
  await page.waitForTimeout(acted === 'dice' ? 2600 : 800)
}

const fin = await inspect()
console.log('\n=== 结论 ===')
console.log(`共 ${steps} 步`)
console.log(`出现「所有选项锁定」的事件：${allLockedSeen} 次（其中带骰子兜底，不构成死锁）`)
console.log(`出现「进 下 月 可点」的状态：${nextEnabledSeen} 次`)
console.log(`死锁次数：${deadEnds.length}`)
for (const d of deadEnds.slice(0, 5)) console.log(`  step ${d.step}: ${d.why}（事件=${d.eventTitle}）`)
console.log(`最终：回合 ${fin.turn} 事件=${fin.eventTitle || '-'} 结局=${fin.ended}`)
console.log(`未捕获错误：${errs.length}`)

await b.close()
process.exit(deadEnds.length ? 1 : 0)