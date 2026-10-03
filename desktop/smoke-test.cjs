/**
 * steam.cjs 冒烟自检：验证「steamworks.js 缺失 / Steam 未运行」时 MOCK 驱动
 * 依然完整可用，且任何调用都不抛异常。
 *
 * 用法：node desktop/smoke-test.cjs
 * 注意：这不是单元测试框架，只是一个给 owner 用的可执行自检脚本。
 */

'use strict'

const path = require('node:path')
const fs = require('node:fs')

// 强制 mock，这样在没有 Steam 的 CI / 开发机上结果稳定
process.env.CHONGZHEN_FORCE_MOCK_STEAM = '1'

const steam = require('./steam.cjs')

const testUserData = path.join(__dirname, '.test-userdata')
fs.rmSync(testUserData, { recursive: true, force: true })

let failures = 0
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  =>  ${JSON.stringify(actual)}${ok ? '' : '  (期望 ' + JSON.stringify(expected) + ')'}`)
}

console.log('=== 1. 初始化（强制 mock） ===')
const status = steam.initSteam({ appId: 480, userDataPath: testUserData })
console.log('getStatus() =', JSON.stringify(status, null, 2))
check('driver 是 mock', status.driver, 'mock')
check('available 为 false', status.available, false)
check('appId 已记录', status.appId, 480)

console.log('\n=== 2. 成就：解锁 / 查询 / 幂等 / 未知 id ===')
check('解锁 from_ninth', steam.unlockAchievement('from_ninth'), true)
check('用 API Name 查询 FROM_NINTH', steam.isAchievementUnlocked('FROM_NINTH'), true)
check('重复解锁仍为 true', steam.unlockAchievement('from_ninth'), true)
check('未解锁的成就为 false', steam.isAchievementUnlocked('WAR_GOD'), false)
check('未知 id 返回 false（不抛异常）', steam.unlockAchievement('definitely_not_an_achievement'), false)
check('空字符串返回 false', steam.unlockAchievement(''), false)
check('null 返回 false', steam.unlockAchievement(null), false)

console.log('\n=== 3. 云存档：写 / 读 / 列表 / 安全校验 ===')
check('写入 save1.json', steam.setCloudFile('save1.json', '{"slot":1}'), true)
check('写回 save1.json', steam.setCloudFile('save1.json', '{"slot":1,"v":2}'), true)
check('写入 save2.json', steam.setCloudFile('save2.json', '{"slot":2}'), true)
check('读取 save1.json', steam.getCloudFile('save1.json'), '{"slot":1,"v":2}')
check('读取不存在的文件返回 null', steam.getCloudFile('nope.json'), null)
check('列表按字典序', steam.listCloudFiles(), ['save1.json', 'save2.json'])
check('拒绝路径穿越', steam.setCloudFile('../escape.json', 'x'), false)
check('拒绝空文件名', steam.setCloudFile('', 'x'), false)
check('拒绝非字符串内容', steam.setCloudFile('a.json', 12345), false)

console.log('\n=== 4. 持久化：重新 require 后状态仍在 ===')
delete require.cache[require.resolve('./steam.cjs')]
const steam2 = require('./steam.cjs')
steam2.initSteam({ appId: 480, userDataPath: testUserData })
check('成就已持久化', steam2.isAchievementUnlocked('FROM_NINTH'), true)
check('文件已持久化', steam2.getCloudFile('save1.json'), '{"slot":1,"v":2}')

console.log('\n=== 5. 优雅退出 ===')
steam.shutdown()
const afterShutdown = steam.getStatus()
check('退出后 driver 仍报 mock', afterShutdown.driver, 'mock')
check('退出后 available 为 false', afterShutdown.available, false)
steam.shutdown() // 重复调用必须安全
console.log('重复 shutdown() 未抛异常')

console.log('\n=== 6. 映射表统计 ===')
const apiNames = Object.keys(steam.ACHIEVEMENTS)
console.log(`Steam API Name 数量：${apiNames.length}`)
console.log(`游戏内部成就数量：${steam.INTERNAL_ACHIEVEMENT_COUNT}`)
console.log(`Steam 上限：${steam.STEAM_ACHIEVEMENT_LIMIT}`)
check('映射表条数 = 内部成就数', apiNames.length, steam.INTERNAL_ACHIEVEMENT_COUNT)
check('全部为 SCREAMING_SNAKE_CASE', apiNames.every((n) => /^[A-Z0-9_]+$/.test(n)), true)
check('内部 id 全部小写蛇形', apiNames.every((n) => /^[a-z0-9_]+$/.test(steam.ACHIEVEMENTS[n].id)), true)
const dupes = apiNames.length - new Set(apiNames.map((n) => steam.ACHIEVEMENTS[n].id)).size
check('内部 id 无重复', dupes, 0)
if (apiNames.length > steam.STEAM_ACHIEVEMENT_LIMIT) {
  console.log(`⚠️  注意：${apiNames.length} 条超过 Steam 上限 ${steam.STEAM_ACHIEVEMENT_LIMIT}，上线前必须裁剪/合并。`)
}

console.log(`\n=== 结果：${failures === 0 ? '全部通过' : failures + ' 项失败'} ===`)
fs.rmSync(testUserData, { recursive: true, force: true })
process.exit(failures === 0 ? 0 : 1)
