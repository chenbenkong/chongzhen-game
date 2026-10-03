import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import EventDisplay from '../../src/components/EventDisplay'
import type { EventChoice, GameEvent } from '../../src/types/event'
import { flush, makeCharacter, makeGameState, makeSaveData, renderGameEngine } from './helpers/gameEngine'

/**
 * K-7：「随心所欲」成就的达成入口。
 *
 * 这个成就要求「随机选择选项 50 次以上」，但此前游戏里**没有任何随机选项入口**，
 * `randomChoiceCount` 恒为 0，成就只能被标记 deadByDesign 排除在全收集判定之外。
 * 现在在选项列表下方加了「听 天 由 命」按钮：
 *   EventDisplay.handleRandomChoice → handleSelectChoice(choice, { random: true })
 *   → onChoice(choice, { random: true }) → 引擎 handleChoice 里自增 randomChoiceCount
 * 这里把两侧都钉住。
 */

function makeAvailableChoice(id: string, text: string): EventChoice {
  return { id, text, description: `${text}的说明`, effects: { attributes: { 文韬: 1 } } }
}

function makeLockedChoice(id: string, text: string): EventChoice {
  // 文韬需 ≥ 80 而角色只有 50 → 判定为不可选
  return {
    id,
    text,
    description: `${text}的说明`,
    showConditions: { attributes: { 文韬: { min: 80 } } },
    effects: { attributes: { 文韬: 1 } }
  }
}

function makeEvent(choices: EventChoice[]): GameEvent {
  return {
    id: 'ev-random',
    title: '测试事件',
    description: '一段用于测试的事件描述。',
    conditions: {},
    type: 'normal',
    choices
  }
}

function baseProps(event: GameEvent) {
  return {
    event,
    character: makeCharacter(),
    gameState: makeGameState(),
    onChoice: () => {},
    onContinue: () => {},
    onUndo: () => {},
    canUndo: false,
    isProcessing: false,
    pendingCount: 0
  }
}

describe('K-7：听天由命（随机选项）入口', () => {
  it('点击后以 { random: true } 结算，且只从**可选**的选项里挑', () => {
    const onChoice = vi.fn()
    const available1 = makeAvailableChoice('a1', '稳妥行事')
    const available2 = makeAvailableChoice('a2', '冒险一搏')
    const locked = makeLockedChoice('l1', '强行上疏')

    render(<EventDisplay {...baseProps(makeEvent([available1, available2, locked]))} onChoice={onChoice} />)

    fireEvent.click(screen.getByRole('button', { name: /听\s*天\s*由\s*命/ }))

    expect(onChoice).toHaveBeenCalledTimes(1)
    const [chosen, opts] = onChoice.mock.calls[0]
    // 必须带上随机标记，否则引擎不会计入 randomChoiceCount
    expect(opts).toEqual({ random: true })
    // 绝不能随机选中锁定项
    expect([available1.id, available2.id]).toContain(chosen.id)
    expect(chosen.id).not.toBe(locked.id)
  })

  it('只有 1 个可选选项时不显示该按钮（等于替玩家点它，没有意义）', () => {
    const onChoice = vi.fn()
    render(
      <EventDisplay
        {...baseProps(makeEvent([makeAvailableChoice('a1', '唯一选择'), makeLockedChoice('l1', '锁定项')]))}
        onChoice={onChoice}
      />
    )
    expect(screen.queryByRole('button', { name: /听\s*天\s*由\s*命/ })).toBeNull()
  })

  it('全部选项都不可选时不显示该按钮', () => {
    render(
      <EventDisplay
        {...baseProps(makeEvent([makeLockedChoice('l1', '甲'), makeLockedChoice('l2', '乙')]))}
        onChoice={() => {}}
      />
    )
    expect(screen.queryByRole('button', { name: /听\s*天\s*由\s*命/ })).toBeNull()
  })
})

describe('K-7：引擎侧的 randomChoiceCount', () => {
  it('带 random 标记的选择会累加 randomChoiceCount，普通选择不会', async () => {
    const choice: EventChoice = { id: 'c1', text: '选项', effects: { attributes: { 文韬: 1 } } }
    const event: GameEvent = {
      id: 'ev-engine-random',
      title: '测试事件',
      description: '',
      conditions: {},
      type: 'normal',
      choices: [choice]
    }
    const save = makeSaveData({ currentEvent: event, currentEventId: event.id })

    const { result } = renderGameEngine({ loadSaveData: save })
    await flush()

    expect(result.current.playerStats.randomChoiceCount).toBe(0)

    await act(async () => {
      result.current.handleChoice(choice, { random: true })
    })
    await flush(20)

    expect(result.current.playerStats.randomChoiceCount).toBe(1)
  })
})
