import { beforeEach, describe, expect, it } from 'vitest'
import {
  ALL_ACHIEVEMENTS,
  checkAndUnlockAchievements,
  setAchievementData
} from '../../src/types/achievement'
import { allEndingEvents } from '../../src/data/events/ending'
import { makeAchievementContext } from './helpers/gameEngine'

/**
 * K-7：结局收藏类成就的数据源与可达性。
 *
 * 原来的判据是 `ctx.eventHistory.filter(e => e.startsWith('ending_')).length >= N`。
 * 这条判据有两处致命问题：
 *   1. `eventHistory` 是**单局**的事件流水，而一局只会走到一个结局（结局即终局）；
 *      更何况 `handleGameOver` 是在把结局 id 写进 eventHistory **之前**调用
 *      `checkAchievements()` 的，检查时该局的结局数恒为 0。
 *   2. 即便统计口径正确，可收集的结局也只有 29 个，凑不满最高的 30 档。
 *
 * 现在数据源改成「当前存档内已解锁的成就列表」里的 `ending_*_done` 条目，
 * 并补齐了 5 个此前缺失的结局成就。下面把这两件事都钉住。
 */

const ENDING_DONE_IDS = ALL_ACHIEVEMENTS.filter(
  a => a.id.startsWith('ending_') && a.id.endsWith('_done')
).map(a => a.id)

beforeEach(() => {
  setAchievementData({ unlocked: [], unlockTimes: {} })
})

/** 解锁指定数量个结局成就，然后跑一次判定，返回新解锁的成就 id */
function unlockEndingsAndCheck(count: number): string[] {
  setAchievementData({ unlocked: ENDING_DONE_IDS.slice(0, count), unlockTimes: {} })
  const newly = checkAndUnlockAchievements(
    makeAchievementContext({ unlockedAchievements: ENDING_DONE_IDS.slice(0, count) })
  )
  return newly.map(a => a.id)
}

describe('K-7：结局收藏成就依赖跨局已解锁成就，而不是单局事件历史', () => {
  it('只解锁 4 个结局时，不应解锁「结局收藏家」', () => {
    const newly = unlockEndingsAndCheck(4)
    expect(newly).not.toContain('ending_collection_5')
  })

  it('解锁 5 个结局后，「结局收藏家」应当解锁', () => {
    const newly = unlockEndingsAndCheck(5)
    expect(newly).toContain('ending_collection_5')
  })

  it('解锁 15 个结局后不再有独立的中间档成就', () => {
    // 原先存在 ending_collection_15（5/15/30 三档）。该档已删除，原因：
    //   1. getUnlockedAchievements() 按 group 分桶、每组只展示 priority 最高的那一项，
    //      所以 15 档对玩家不可见；
    //   2. Steam 单 App 成就上限 100，删除它才能把总数压到上限之内。
    // 这里钉住"删除后不会再冒出来"，防止有人把它加回去。
    const newly = unlockEndingsAndCheck(15)
    expect(newly).not.toContain('ending_collection_15')
    expect(newly).toContain('ending_collection_5')
  })

  it('解锁 30 个结局后，「百味人生」应当解锁', () => {
    const newly = unlockEndingsAndCheck(30)
    expect(newly).toContain('ending_collection_30')
  })

  it('统计的是「不同结局」，重复解锁同一个不会重复计数', () => {
    // 把同一个结局成就重复塞进去（正常路径下不会这样，但判据不应被它骗过）
    const duplicated = [...ENDING_DONE_IDS.slice(0, 4), ENDING_DONE_IDS[0], ENDING_DONE_IDS[0]]
    setAchievementData({ unlocked: duplicated, unlockTimes: {} })
    const newly = checkAndUnlockAchievements(
      makeAchievementContext({ unlockedAchievements: duplicated })
    )
    // 4 个不同结局 < 5，所以不该解锁
    expect(newly.map(a => a.id)).not.toContain('ending_collection_5')
  })
})

describe('K-7：结局图鉴的可达性', () => {
  it('每个结局事件都必须有对应的 _done 成就（否则图鉴永远到不了 100%）', () => {
    // 只关心 ending_* 开头的真正结局事件；triggerable_* 之类的占位不在此列
    const realEndings = allEndingEvents.filter(e => e.id.startsWith('ending_'))
    const doneSet = new Set(ENDING_DONE_IDS.map(id => id.replace(/_done$/, '')))
    const missing = realEndings.filter(e => !doneSet.has(e.id)).map(e => e.id)
    expect(missing).toEqual([])
  })

  it('可收集的结局数量不少于最高档门槛（30），否则该档数学上不可达', () => {
    expect(ENDING_DONE_IDS.length).toBeGreaterThanOrEqual(30)
  })
})
