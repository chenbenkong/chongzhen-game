#!/usr/bin/env node
/**
 * 启动前置检查：Node 版本是否满足间接依赖的 engines 要求。
 *
 * 为什么需要它 —— 2026-10-03 起连续三次部署失败，根因是这个：
 *
 *   jsdom@30  →  undici@8.11.2  →  lib/web/webidl/index.js
 *     webidl.util.markAsUncloneable = require('node:worker_threads').markAsUncloneable
 *
 * `markAsUncloneable` 自 Node 22.19 才存在于 node:worker_threads。
 * 在 Node 20 上它是 `undefined`，于是 `undici/index.js` 顶层
 * `new CacheStorage()` 抛出
 *
 *   TypeError: webidl.util.markAsUncloneable is not a function
 *
 * 整步单元测试失败 → 部署被拦下 → Pages 静默停留在旧版本。
 * 报错发生在 vitest 的依赖深处，日志里完全看不出是 Node 版本问题。
 *
 * 所以这里做两件事：
 *   1. 比对本仓库 package.json 的 engines.node；
 *   2. 反向扫描 node_modules 里 engines 最高的那个包，报出真实的下限。
 *
 * 用法：node scripts/check-node-engine.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)/

function fail(msg) {
  console.error(`\n[check-node-engine] 失败：${msg}\n`)
  process.exit(1)
}

const current = process.versions.node
const currentParts = SEMVER_RE.exec(current)
if (!currentParts) fail(`无法解析当前 Node 版本：${current}`)

const cmp = (a, b) => {
  for (let i = 0; i < 3; i++) {
    const d = Number(a[i]) - Number(b[i])
    if (d !== 0) return d
  }
  return 0
}

/** 从 ">=22.19.0" / "^24.0.0" / "20.x" 里取出最低版本号 */
function minVersion(range) {
  if (!range || typeof range !== 'string') return null
  const m = SEMVER_RE.exec(range.replace(/^[^\d]*/, ''))
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** 扫 node_modules，取所有 engines.node 里最高的下限 */
function scanInstalledEngines() {
  const nm = path.join(ROOT, 'node_modules')
  if (!fs.existsSync(nm)) return null
  let worst = null
  const offenders = []

  const visit = dir => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === '.bin' || entry.name === '.cache') continue
      const pkgPath = path.join(dir, entry.name, 'package.json')
      if (!fs.existsSync(pkgPath)) continue
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
        const v = minVersion(pkg?.engines?.node)
        if (v) {
          if (!worst || cmp(v, worst) > 0) worst = v
          offenders.push({ name: pkg.name, version: pkg.version, need: v })
        }
      } catch {
        /* 忽略无法解析的 package.json */
      }
      const nested = path.join(dir, entry.name, 'node_modules')
      if (fs.existsSync(nested)) visit(nested)
    }
  }

  visit(nm)
  return { worst, offenders }
}

const installed = scanInstalledEngines()

console.log(`[check-node-engine] 当前 Node: v${current}`)
if (installed && installed.worst) {
  const w = installed.worst.join('.')
  console.log(`[check-node-engine] 依赖要求的最高下限: >=${w}`)
  console.log(
    `[check-node-engine] 涉及的关键包: ${
      installed.offenders
        .filter(o => cmp(o.need, [22, 0, 0]) >= 0)
        .slice(0, 6)
        .map(o => `${o.name}@${o.version}`)
        .join(', ') || '（无 >=22 的包）'
    }`
  )
  if (cmp(currentParts, installed.worst) < 0) {
    fail(
      `当前 Node v${current} 低于已安装依赖要求的 >=${w}。\n` +
        `这会导致 jsdom/undici 在加载期抛 "webidl.util.markAsUncloneable is not a function"。\n` +
        `请升级 Node（CI 已固定为 24）。`
    )
  }
} else {
  console.log('[check-node-engine] 未发现带 engines.node 的已安装依赖，跳过依赖侧检查。')
}

console.log('[check-node-engine] OK')