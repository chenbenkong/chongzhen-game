import { act, renderHook } from '@testing-library/react'
import { useGameEngine, type UseGameEngineProps } from '../../../src/hooks/useGameEngine'
import type { SaveData } from '../../../src/types/save'
import type { Attributes, Character, DegreeType, GameStateValues, LifeRecord } from '../../../src/types/game'
import type { OriginType } from '../../../src/types/game'

/**
 * useGameEngine 的测试基座。
 *
 * 目标：让每个用例只写"我要什么存档 / 我要什么 props / 我断言什么"，
 * 不用重复构造那 40 多个字段的角色与存档对象。
 */

export const DEFAULT_ATTRIBUTES: Attributes = {
  财帛: 50,
  文韬: 50,
  理政: 50,
  武略: 50,
  体质: 50
}

export function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    name: '测试者',
    courtesyName: '子明',
    hometown: '南直隶苏州府吴县',
    age: 30,
    origin: '寒门' as OriginType,
    rank: '正七品·知县',
    degree: '进士' as DegreeType,
    attributes: { ...DEFAULT_ATTRIBUTES },
    hidden: { 道德值: 50, 欲望值: 50, 野心值: 50, 机敏值: 50, 忠诚值: 50 },
    flags: ['地方官任职'],
    history: [],
    wives: [],
    lovers: [],
    examHistory: [],
    promotionCount: 0,
    demotionCount: 0,
    faction: { 东林好感: 50, 阉党好感: 50, 立场: '未定', 党争烈度: 30 },
    ...overrides
  } as Character
}

export function makeGameState(overrides: Partial<GameStateValues> = {}): GameStateValues {
  return {
    currentYear: 1628,
    currentMonth: 1,
    turn: 0,
    圣眷: 50,
    中官: 50,
    清议: 50,
    士绅: 50,
    民望: 50,
    国势: 75,
    ...overrides
  }
}

export function makeLifeRecord(overrides: Partial<LifeRecord> = {}): LifeRecord {
  return {
    id: 'rec-1',
    year: 1628,
    month: 1,
    type: 'event',
    title: '初到任上',
    description: '你接过了县衙的印信。',
    ...overrides
  }
}

export function makeSaveData(overrides: Partial<SaveData> = {}): SaveData {
  return {
    character: makeCharacter(),
    gameState: makeGameState(),
    eventHistory: [],
    origin: '寒门' as OriginType,
    degree: '进士' as DegreeType,
    playerName: '测试者',
    identityType: 'official',
    lifeRecords: [],
    savedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    ...overrides
  }
}

export function makeProps(overrides: Partial<UseGameEngineProps> = {}): UseGameEngineProps {
  return {
    origin: '寒门' as OriginType,
    degree: '进士' as DegreeType,
    bonusAttributes: { ...DEFAULT_ATTRIBUTES },
    playerName: '测试者',
    playerCourtesyName: '子明',
    playerHometown: '南直隶苏州府吴县',
    playerCustomAge: 30,
    difficulty: 'normal',
    ...overrides
  }
}

/** 渲染引擎，并把常用的解构结果一起返回 */
export function renderGameEngine(overrides: Partial<UseGameEngineProps> = {}) {
  return renderHook((props: UseGameEngineProps) => useGameEngine(props), {
    initialProps: makeProps(overrides)
  })
}

/** 等待 effect / 微任务与短定时器落地 */
export async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, ms))
  })
}

/**
 * 推进 n 个月。handleNextMonth 会触发多次 setState 与 300ms 的调度定时器，
 * 因此每步都留出一点真实时间，避免断言落在中间态上。
 */
export async function advanceMonths(
  result: { current: ReturnType<typeof useGameEngine> },
  n: number
): Promise<void> {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      result.current.handleNextMonth()
    })
    await flush(30)
  }
}
