import { describe, expect, it } from 'vitest'
import { advanceMonths, flush, renderGameEngine } from './helpers/gameEngine'

/**
 * 缺陷 K-1b：`handleNextMonth` 把副作用写在了 setGameState 的更新函数里。
 *
 * 那个更新函数除了算新月份状态，还顺手做了三件有副作用的事：
 *   1. `setCharacter` 给角色增龄
 *   2. 排一个 300ms 的 `setTimeout`（里面挑事件、写事件历史、调 checkBoundary）
 *   3. 在定时器里再改 currentEvent / pendingEvents / eventHistory
 *
 * React 的更新函数**必须是纯的**：StrictMode 在开发构建下会重复调用它来暴露不纯的代码，
 * 并发渲染下也可能重放。一旦被重放，上面三件事就各执行两遍 ——
 * 事件 id 重复写进历史、年龄加两次、两个定时器互相抢事件。
 *
 * 这里用 StrictMode 把缺陷稳定复现出来。修法是：把纯计算抽出来，
 * 副作用全部移到更新函数之外。
 */

/** 事件历史里出现次数 > 1 的 id */
function duplicateIds(history: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const id of history) {
    if (seen.has(id)) dupes.add(id)
    seen.add(id)
  }
  return [...dupes]
}

describe('缺陷 K-1b：StrictMode 下推进月份不应重复产生副作用', () => {
  it('推进一个月后，事件历史里不应出现重复的事件 id', async () => {
    const { result } = renderGameEngine({}, { strict: true })
    await flush()

    // 挂载阶段已经有一次事件初始化（那一处此前已加了一次性 ref 守卫）
    expect(duplicateIds(result.current.eventHistory)).toEqual([])

    const turnBefore = result.current.gameState.turn
    await advanceMonths(result, 1)

    // 一个月只应推进一格 turn
    expect(result.current.gameState.turn - turnBefore).toBe(1)
    // 关键断言：事件 id 不能因为更新函数被重放而写入两次
    expect(duplicateIds(result.current.eventHistory)).toEqual([])
  })

  it('连推三个月，事件历史仍不应出现重复 id', async () => {
    const { result } = renderGameEngine({}, { strict: true })
    await flush()

    await advanceMonths(result, 3)

    expect(duplicateIds(result.current.eventHistory)).toEqual([])
    // turn 应按月递增，且不因重放而翻倍
    expect(result.current.gameState.turn).toBe(3)
  })
})
