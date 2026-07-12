// 调试脚本：模拟用户点击画册 → 打开 viewer → 关闭按钮
import { chromium } from 'playwright'

const URL = 'https://chenbenkong.github.io/chongzhen-game/'

const browser = await chromium.launch()
const page = await browser.newPage()
const logs = []
page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`))
page.on('pageerror', err => logs.push(`[pageerror] ${err.message}`))

await page.goto(URL, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

console.log('=== 1. 页面加载完成 ===')
console.log('--- console logs ---')
logs.forEach(l => console.log(l))
console.log('--- end logs ---')

// 注入几张假画（用一张远程小图）到 localStorage，模拟已有存档
await page.evaluate(() => {
  const items = [
    { id: 'test1', userPrompt: '测试图1', fullPrompt: '', url: 'https://picsum.photos/seed/1/400/400', size: '1K', ratio: '1:1', createdAt: Date.now() },
    { id: 'test2', userPrompt: '测试图2', fullPrompt: '', url: 'https://picsum.photos/seed/2/400/400', size: '1K', ratio: '1:1', createdAt: Date.now() - 1000 }
  ]
  localStorage.setItem('chongzhen_image_gallery_v2', JSON.stringify(items))
})

// 查找"丹青"按钮并点击
const danBtn = await page.$('button:has-text("丹青")')
if (!danBtn) {
  console.log('ERROR: 找不到丹青按钮')
  await browser.close()
  process.exit(1)
}
await danBtn.click()
await page.waitForTimeout(500)

// 切换到"画册" Tab
const galleryTab = await page.$('button.ig-tab:has-text("画册")')
if (galleryTab) await galleryTab.click()
await page.waitForTimeout(500)

console.log('=== 2. 画册打开 ===')
const cards = await page.$$('.ig-history-card')
console.log('画册卡片数:', cards.length)
if (cards.length === 0) {
  console.log('ERROR: 画册没有卡片')
  await browser.close()
  process.exit(1)
}

// 关闭 console listener 后点击第一张卡
logs.length = 0
await cards[0].click()
await page.waitForTimeout(500)

console.log('=== 3. 点击画册卡片后 ===')
console.log('--- console ---')
logs.forEach(l => console.log(l))

const viewer = await page.$('.ig-viewer-overlay')
console.log('viewer 显示:', !!viewer)

if (viewer) {
  const closeBtn = await page.$('.ig-viewer-btn.close')
  console.log('关闭按钮存在:', !!closeBtn)

  logs.length = 0
  await closeBtn.click()
  await page.waitForTimeout(300)

  console.log('=== 4. 点击关闭按钮后 ===')
  console.log('--- console ---')
  logs.forEach(l => console.log(l))

  const viewer2 = await page.$('.ig-viewer-overlay')
  console.log('viewer 还在:', !!viewer2)
}

await browser.close()
