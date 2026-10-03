import { describe, expect, it } from 'vitest'
import {
  advanceMonths,
  flush,
  makeCharacter,
  makeGameState,
  makeSaveData,
  renderGameEngine
} from './helpers/gameEngine'

/**
 * 基座自检：先把"能渲染、能推进回合、能读档"这三件事钉死，
 * 再在其上写针对具体缺陷的用例。这个文件失败就意味着下面所有结论都不可信。
 */
describe('测试基座自检', () => {
  it('能以新游戏的方式渲染引擎，并给出初始角色与状态', () => {
    const { result } = renderGameEngine()

    expect(result.current.character.name).toBe('测试者')
    expect(result.current.character.origin).toBe('寒门')
    expect(result.current.gameState.currentYear).toBe(1628)
    expect(result.current.gameState.currentMonth).toBe(1)
    expect(result.current.isGameOver).toBe(false)
  })

  it('暴露了后续用例需要的那批接口', () => {
    const { result } = renderGameEngine()
    for (const key of [
      'character',
      'gameState',
      'lifeRecords',
      'playTime',
      'eventHistory',
      'handleNextMonth',
      'handleChoice',
      'handleUndo',
      'handleSaveToSlot',
      'checkBoundary',
      'addLifeRecord'
    ]) {
      expect(result.current).toHaveProperty(key)
    }
  })

  it('新角色带有全部 5 项隐藏属性（含此前缺失的机敏值/忠诚值）', () => {
    const { result } = renderGameEngine()
    const hidden = result.current.character.hidden
    // 用 as const 让 key 保持字面量类型，从而直接索引而无需类型断言
    for (const key of ['道德值', '欲望值', '野心值', '机敏值', '忠诚值'] as const) {
      expect(typeof hidden[key]).toBe('number')
      expect(Number.isFinite(hidden[key])).toBe(true)
    }
  })

  it('能在不抛异常的前提下推进若干个月', async () => {
    const { result } = renderGameEngine()
    await advanceMonths(result, 3)
    const { currentYear, currentMonth, turn } = result.current.gameState
    // 从 1628 年 1 月开始推进 3 次，至少应离开起点
    expect(turn).toBeGreaterThan(0)
    expect(currentYear * 12 + currentMonth).toBeGreaterThan(1628 * 12 + 1)
  })

  it('读档后角色与状态来自存档，而不是默认值', async () => {
    const save = makeSaveData({
      character: makeCharacter({
        name: '存档角色',
        rank: '正四品·知府',
        age: 44
      }),
      gameState: makeGameState({
        currentYear: 1635,
        currentMonth: 7,
        turn: 90
      })
    })

    const { result } = renderGameEngine({ loadSaveData: save })
    await flush()

    expect(result.current.character.name).toBe('存档角色')
    expect(result.current.character.age).toBe(44)
    expect(result.current.gameState.currentYear).toBe(1635)
    expect(result.current.gameState.currentMonth).toBe(7)
  })
})
