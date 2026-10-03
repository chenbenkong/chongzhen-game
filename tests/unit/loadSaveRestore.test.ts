import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import {
  flush,
  makeLifeRecord,
  makeProps,
  makeSaveData,
  renderGameEngine
} from './helpers/gameEngine'

/**
 * 缺陷 K-3：读档没有恢复 lifeRecords / playTime。
 *
 * 引擎已经挂载时切换存档（用 loadSaveData 换一份存档）只会恢复角色、局势、
 * 事件历史、统计等，lifeRecords 沿用上一局、playTime 甚至没有 setter。
 * 现实里 App.tsx 会先回标题页把 GameScreen 卸载，所以问题被掩盖了；
 * 但只要在挂载状态下换存档（切槽位、读自动存档后回到同一棵组件树），
 * 「生平回顾」就会把两辈子的事混在一起。
 */

const SAVE_A_RECORDS = [
  makeLifeRecord({ id: 'a-1', title: '甲局：流落街头', description: '你把最后一件棉袍当了。' }),
  makeLifeRecord({ id: 'a-2', title: '甲局：客死他乡', description: '你死在驿站的柴房里。' })
]

const SAVE_B_RECORDS = [
  makeLifeRecord({ id: 'b-1', title: '乙局：金榜题名', description: '殿试传胪，你名列三甲。' }),
  makeLifeRecord({ id: 'b-2', title: '乙局：初授知县', description: '你接过了县衙的印信。' }),
  makeLifeRecord({ id: 'b-3', title: '乙局：河工告成', description: '黄河故道的堤坝合龙了。' }),
  makeLifeRecord({ id: 'b-4', title: '乙局：弹劾权贵', description: '你上了一道措辞激烈的奏疏。' }),
  makeLifeRecord({ id: 'b-5', title: '乙局：致仕还乡', description: '你带着两箱书回到了吴县。' })
]

describe('缺陷 K-3：读档恢复 lifeRecords 与 playTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('在已挂载的引擎上切换到另一份存档后，生平流水与游玩时长都换成新存档的', async () => {
    const saveA = makeSaveData({ lifeRecords: SAVE_A_RECORDS, playTime: 100 })
    const saveB = makeSaveData({ lifeRecords: SAVE_B_RECORDS, playTime: 900 })

    const { result, rerender } = renderGameEngine({ loadSaveData: saveA })
    await flush()

    // 前提：存档 A 确实被读进来了（否则后面的对比没有意义）
    expect(result.current.lifeRecords.map(r => r.title)).toEqual(SAVE_A_RECORDS.map(r => r.title))
    expect(result.current.playTime).toBe(100)

    // 引擎不卸载，直接换一份存档（模拟切槽位 / 读另一份自动存档）
    rerender(makeProps({ loadSaveData: saveB }))
    await flush()

    expect(result.current.lifeRecords.map(r => r.title)).toEqual(SAVE_B_RECORDS.map(r => r.title))
    expect(result.current.lifeRecords).toHaveLength(5)
    expect(result.current.playTime).toBe(900)
  })

  it('游玩时长会随时间累计，并且写进手动存档的是累计后的秒数', async () => {
    // 只假造 setInterval 与 Date：30 秒一次的心跳由测试时钟推进，
    // 而引擎里那些 100/300/400ms 的 setTimeout 仍走真实定时器，
    // 这样 flush() 依旧可用于等待 effect 落地。
    vi.useFakeTimers({ toFake: ['setInterval', 'Date'] })

    const { result } = renderGameEngine()
    await flush()

    // 新开一局：还没玩过，时长为 0
    expect(result.current.playTime).toBe(0)

    // 推进 35 秒：30 秒时心跳把 state 同步到 30，之后又过了 5 秒（不足一次心跳）
    await act(async () => {
      vi.advanceTimersByTime(35_000)
    })
    expect(result.current.playTime).toBe(30)

    // 手动存档：写盘的时长必须补齐那不足一次心跳的 5 秒
    await act(async () => {
      result.current.handleSaveToSlot(1)
    })
    const raw = localStorage.getItem('chongzhen_save_slot_1')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw as string).playTime).toBe(35)
  })
})
