import { beforeEach, describe, expect, it } from 'vitest'
import {
  getCurrentAchievementData,
  loadAchievements,
  saveAchievements,
  setAchievementData,
  unlockAchievement,
  checkAndUnlockAchievements,
  ALL_ACHIEVEMENTS
} from '../../src/types/achievement'
import { makeAchievementContext } from './helpers/gameEngine'

/**
 * K-6：成就数据是模块级共享状态，读写必须收口。
 *
 * 完整重构（把成就数据并入 SaveData、去掉模块级变量）代价偏大、收益偏投机，
 * 因此这一步先解决其中**可落地且有实际风险**的一部分：引用别名。
 *
 * 原来 `setAchievementData` 直接按引用保存调用方的对象、`loadAchievements` 也按引用
 * 返回内部对象 —— 任何调用方的一次就地修改都会污染全局成就状态，而且不会有任何报错。
 * 现在读写边界上都做防御性拷贝，并用下面这些用例把契约钉住。
 */

const EMPTY = { unlocked: [], unlockTimes: {} }

beforeEach(() => {
  setAchievementData(EMPTY)
})

describe('K-6：成就存储的读写边界', () => {
  it('setAchievementData 之后修改调用方传入的对象，不应影响内部状态', () => {
    const mine = { unlocked: ['first_official'], unlockTimes: { first_official: 't1' } }
    setAchievementData(mine)

    // 调用方随后就地修改自己的对象
    mine.unlocked.push('collector')
    mine.unlockTimes.first_official = '被改掉了'

    const stored = loadAchievements()
    expect(stored.unlocked).toEqual(['first_official'])
    expect(stored.unlockTimes.first_official).toBe('t1')
  })

  it('loadAchievements 返回的是副本，改它不应影响内部状态', () => {
    setAchievementData({ unlocked: ['first_official'], unlockTimes: { first_official: 't1' } })

    const got = loadAchievements()
    got.unlocked.push('伪造的成就')
    got.unlockTimes['伪造的成就'] = 'now'

    expect(loadAchievements().unlocked).toEqual(['first_official'])
    expect(getCurrentAchievementData().unlocked).toEqual(['first_official'])
  })

  it('saveAchievements 也存副本', () => {
    const mine = { unlocked: ['a'], unlockTimes: { a: 't' } }
    saveAchievements(mine)
    mine.unlocked.push('b')
    expect(loadAchievements().unlocked).toEqual(['a'])
  })

  it('unlockAchievement 是幂等的，且拒绝未知 id', () => {
    setAchievementData(EMPTY)

    expect(unlockAchievement('这个成就不存在')).toBeNull()
    expect(loadAchievements().unlocked).toEqual([])

    const first = unlockAchievement('first_official')
    expect(first?.id).toBe('first_official')
    expect(loadAchievements().unlocked).toEqual(['first_official'])

    // 再解一次应返回 null，且不产生重复条目
    expect(unlockAchievement('first_official')).toBeNull()
    expect(loadAchievements().unlocked).toEqual(['first_official'])
  })

  it('checkAndUnlockAchievements 对已解锁的成就不重复返回', () => {
    setAchievementData(EMPTY)

    const ctx = makeAchievementContext({ characterRank: '正七品·知县' })
    const firstRun = checkAndUnlockAchievements(ctx).map(a => a.id)
    const secondRun = checkAndUnlockAchievements(ctx).map(a => a.id)

    // 第二次不应再解锁任何东西
    expect(secondRun).toEqual([])
    // 且首次的解锁确实落进了存储
    for (const id of firstRun) {
      expect(loadAchievements().unlocked).toContain(id)
    }
  })

  it('每个成就 id 唯一（重复 id 会让收集链计数失真）', () => {
    const ids = ALL_ACHIEVEMENTS.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
