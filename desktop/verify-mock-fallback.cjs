/**
 * 验证「steamworks.js 完全不存在」时 steam.cjs 依然可以正常 require 且不抛异常。
 * 做法：劫持 Module._load，让任何对 'steamworks.js' 的请求都抛 MODULE_NOT_FOUND，
 *      从而真实模拟"没装原生模块"的场景（比 preferMock 更有说服力）。
 */
'use strict'

const Module = require('node:module')
const path = require('node:path')

// ---- 劫持 require，让 steamworks.js 看起来不存在 ----
const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'steamworks.js') {
    const err = new Error("Cannot find module 'steamworks.js'")
    err.code = 'MODULE_NOT_FOUND'
    throw err
  }
  return originalLoad.call(this, request, parent, isMain)
}

const userData = path.join(__dirname, '.test-userdata-absent')

console.log('尝试 require("./steam.cjs") …')
let steam
try {
  steam = require('./steam.cjs')
  console.log('✓ require 成功（未抛异常）')
} catch (err) {
  console.error('✗ require 抛异常了：', err)
  process.exit(1)
}

console.log('\n调用 initSteam() …')
let status
try {
  status = steam.initSteam({ appId: 480, userDataPath: userData })
  console.log('✓ initSteam 未抛异常')
} catch (err) {
  console.error('✗ initSteam 抛异常了：', err)
  process.exit(1)
}

console.log('\ngetStatus() 返回：')
console.log(JSON.stringify(status, null, 2))

console.log('\n功能性检查：')
const results = []
results.push(['driver === mock', status.driver === 'mock'])
results.push(['available === false', status.available === false])
results.push(['error 说明了缺模块原因', typeof status.error === 'string' && status.error.includes('steamworks.js')])
results.push(['成就可解锁', steam.unlockAchievement('minister') === true])
results.push(['成就可查询', steam.isAchievementUnlocked('MINISTER') === true])
results.push(['云存档可写', steam.setCloudFile('t.json', '{"ok":true}') === true])
results.push(['云存档可读', steam.getCloudFile('t.json') === '{"ok":true}'])
results.push(['云存档可列举', steam.listCloudFiles().join(',') === 't.json'])
results.push(['shutdown 不抛', (() => { try { steam.shutdown(); return true } catch { return false } })()])

let failed = 0
for (const [label, ok] of results) {
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
}

require('node:fs').rmSync(userData, { recursive: true, force: true })

console.log(`\nerror 字段内容：${JSON.stringify(status.error)}`)
console.log(`\n=== ${failed === 0 ? '全部通过：steamworks.js 缺失时降级成功' : failed + ' 项失败'} ===`)
process.exit(failed === 0 ? 0 : 1)
