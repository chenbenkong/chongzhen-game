import { describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import { flush, makeCharacter, makeGameState, makeSaveData, renderGameEngine } from './helpers/gameEngine'

/**
 * 缺陷 K-2：`crisis` 类临界事件只在引擎挂载时检查过一次。
 *
 * `boundaryEventManager` 里注册了 'ending' 与 'crisis' 两类临界事件。
 * 挂载 effect 两类都查（各带 0.3 的概率门），但它有一次性 ref 守卫、只跑一次；
 * 而会被反复调用的 `checkBoundary()` 只查了 'ending'。
 * 结果是：所有 crisis 事件（例如「重病缠身」）只有在玩家**开局瞬间**就已经满足条件时
 * 才可能出现，游戏中途永远触发不了 —— 成了死内容。
 *
 * 测试要点：必须把挂载阶段的随机数压到概率门之外，只在推进月份时放开。
 * 否则挂载 effect 自己就会触发 crisis，测到的还是那条本来就正常的路径。
 */

/** 政绩分 452 → 官阶「正六品·同知」自洽；体质 18 满足 crisis 条件（< 20）但不触发「体弱多病」（< 15） */
function makeSaveWithConstitution(constitution: number) {
  return makeSaveData({
    character: makeCharacter({
      rank: '正六品·同知',
      degree: '进士',
      attributes: { 财帛: 60, 文韬: 90, 理政: 90, 武略: 90, 体质: constitution },
      hidden: { 道德值: 50, 欲望值: 50, 野心值: 50, 机敏值: 50, 忠诚值: 50 }
    }),
    gameState: makeGameState({ 圣眷: 50, 民望: 50, 士绅: 50, 清议: 50 })
  })
}

const CRISIS_EVENT_ID = 'boundary_serious_illness'

describe('缺陷 K-2：游戏中途应能触发 crisis 类临界事件', () => {
  it('体质低于 20 时，推进月份应有机会触发「重病缠身」', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.9)

    const { result } = renderGameEngine({ loadSaveData: makeSaveWithConstitution(18) })
    await flush()

    // 前提：挂载阶段因为随机数在概率门之外，没有触发 crisis
    expect(result.current.currentEvent?.id).not.toBe(CRISIS_EVENT_ID)

    // 放开概率门，然后推进一个月
    randomSpy.mockReturnValue(0.1)
    await act(async () => {
      result.current.handleNextMonth()
    })
    // checkBoundary 是在 300ms 的 setTimeout 里调用的，要等它落地
    await flush(600)

    expect(result.current.currentEvent?.id).toBe(CRISIS_EVENT_ID)
  })

  it('体质正常时，推进月份不应凭空触发 crisis', async () => {
    // 反向守卫：确认修复没有变成"无条件触发危机事件"
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.1)

    const { result } = renderGameEngine({ loadSaveData: makeSaveWithConstitution(60) })
    await flush()

    randomSpy.mockReturnValue(0.1)
    await act(async () => {
      result.current.handleNextMonth()
    })
    await flush(600)

    expect(result.current.currentEvent?.id).not.toBe(CRISIS_EVENT_ID)
  })
})
