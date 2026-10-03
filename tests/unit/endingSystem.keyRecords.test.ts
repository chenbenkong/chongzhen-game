import { describe, expect, it } from 'vitest'
import { pickKeyLifeRecords } from '../../src/utils/endingSystem'
import { makeLifeRecord } from './helpers/gameEngine'
import type { LifeRecord } from '../../src/types/game'

/**
 * K-7：人物志与生平总结的关键事件筛选口径必须一致。
 *
 * 此前两处各写一套：类型过滤不同（一边算 marriage，一边算"带 impact 的 event"），
 * 取样方向还相反 —— 人物志取 `slice(0, 8)`（**最早** 8 条），总结取 `slice(-10)`。
 * 结果是一局 17 年的仕途，人物志只写早年的事，把后半生整段丢掉。
 * 现在两处共用 pickKeyLifeRecords，这里把它的契约钉住。
 */

/** 造 20 条混合类型的生平记录：索引即"时间顺序" */
function makeRecords(): LifeRecord[] {
  return Array.from({ length: 20 }, (_, i) =>
    makeLifeRecord({
      id: `rec-${i}`,
      title: `第${i}条`,
      // 交替类型，覆盖"关键"与"非关键"
      type: (['promotion', 'event', 'demotion', 'exam', 'marriage', 'choice', 'death'] as const)[i % 7],
      // 偶数索引的 event 带 impact（属于关键），奇数索引的不带（不属于）
      impact: i % 2 === 0 ? '有影响' : undefined
    })
  )
}

describe('K-7：关键生平事件筛选口径', () => {
  it('只保留关键类型：升迁/贬官/死亡/婚配，以及带 impact 的事件', () => {
    const picked = pickKeyLifeRecords(makeRecords(), 50)
    for (const r of picked) {
      const isKey =
        r.type === 'promotion' ||
        r.type === 'demotion' ||
        r.type === 'death' ||
        r.type === 'marriage' ||
        (r.type === 'event' && Boolean(r.impact))
      expect(isKey).toBe(true)
    }
    // 不带 impact 的 event 必须被排除
    expect(picked.some(r => r.type === 'event' && !r.impact)).toBe(false)
    // 非关键类型（exam/choice）必须被排除
    expect(picked.some(r => r.type === 'exam' || r.type === 'choice')).toBe(false)
  })

  it('取的是**最近**的关键事件，而不是最早的', () => {
    const records = makeRecords()
    const all = pickKeyLifeRecords(records, 1000)
    const lastThree = pickKeyLifeRecords(records, 3)

    // 应当等于"全部关键事件"的最后 3 条
    expect(lastThree.map(r => r.id)).toEqual(all.slice(-3).map(r => r.id))

    // 且最后一条必须是整份列表里最后一个关键事件 —— 这正是旧实现会丢掉的部分
    const lastKeyOverall = all[all.length - 1]
    expect(lastThree[lastThree.length - 1].id).toBe(lastKeyOverall.id)
  })

  it('按 limit 截断，且条数不足时原样返回', () => {
    const records = makeRecords()
    expect(pickKeyLifeRecords(records, 1)).toHaveLength(1)
    expect(pickKeyLifeRecords(records, 4)).toHaveLength(4)
    expect(pickKeyLifeRecords([], 8)).toEqual([])
    expect(pickKeyLifeRecords(records, 9999).length).toBeGreaterThan(4)
  })
})
