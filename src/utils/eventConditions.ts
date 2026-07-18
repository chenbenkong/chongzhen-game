// 事件条件检查工具
// 消除 GameScreen.tsx 中 findAvailableEvent / findAvailableEventWithState / findAllEventsForState 的重复条件检查代码

import { GameEvent } from '../types/event'
import { GameStateValues, Attributes, HiddenAttributes, OriginType } from '../types/game'
import { ATTR_MAP, STATE_MAP } from './constants'

type Range = { min?: number; max?: number }

/**
 * 检查单个事件的所有条件是否满足
 * @param event 事件对象
 * @param character 角色（提供 attributes / hidden / flags / origin）
 * @param state 状态（提供 currentYear / currentMonth 以及 gameState.* 字段）
 */
export function checkEventConditions(
  event: GameEvent,
  character: {
    attributes: Attributes
    hidden: HiddenAttributes
    flags: string[]
    origin: OriginType
  },
  state: GameStateValues
): boolean {
  const cond = event.conditions || {}
  if (!cond) return true

  // 年份
  if (cond.year) {
    if (cond.year.min !== undefined && state.currentYear < cond.year.min) return false
    if (cond.year.max !== undefined && state.currentYear > cond.year.max) return false
  }

  // 月份
  if (cond.month) {
    if (cond.month.min !== undefined && state.currentMonth < cond.month.min) return false
    if (cond.month.max !== undefined && state.currentMonth > cond.month.max) return false
  }

  // 公开属性
  if (cond.attributes) {
    for (const [key, range] of Object.entries(cond.attributes)) {
      const mappedKey = ATTR_MAP[key] || key
      const attrKey = mappedKey as keyof Attributes
      const value = character.attributes[attrKey] || 0
      const r = range as Range
      if (r.min !== undefined && value < r.min) return false
      if (r.max !== undefined && value > r.max) return false
    }
  }

  // 隐藏属性
  if (cond.hidden) {
    for (const [key, range] of Object.entries(cond.hidden)) {
      const hiddenKey = key as keyof HiddenAttributes
      const value = character.hidden[hiddenKey]
      if (value === undefined) return false
      const r = range as Range
      if (r.min !== undefined && value < r.min) return false
      if (r.max !== undefined && value > r.max) return false
    }
  }

  // 全局状态（不包含 year/month/turn — 这些在前面单独检查）
  if (cond.gameState) {
    for (const [key, range] of Object.entries(cond.gameState)) {
      const mappedKey = STATE_MAP[key] || key
      if (mappedKey === 'currentYear' || mappedKey === 'currentMonth' || mappedKey === 'turn') continue
      const stateKey = mappedKey as keyof GameStateValues
      const value = state[stateKey] as number
      const r = range as Range
      if (r.min !== undefined && value < r.min) return false
      if (r.max !== undefined && value > r.max) return false
    }
  }

  // 出身限制
  if (cond.origin) {
    const allowed = Array.isArray(cond.origin) ? cond.origin : [cond.origin]
    if (!allowed.includes(character.origin)) return false
  }

  // 标志位
  if (cond.flags) {
    if (cond.flags.has?.some((f: string) => !character.flags.includes(f))) return false
    if (cond.flags.notHas?.some((f: string) => character.flags.includes(f))) return false
  }

  return true
}

/**
 * 从可用事件池中按"主优先"策略随机挑选 1 个事件
 * 策略：
 *  1. 30% 概率命中支线（emotion / gray），避免支线永远不出现
 *  2. 否则优先 historical（每个只触发一次）
 *  3. 然后 transition（每个只触发一次）
 *  4. 然后 random（可重复）
 *  5. 最后 normal（每个只触发一次）
 *
 * 剧情线加权（v3 新增）：
 *  - 如果传入了 currentStoryline，则在每个 tier 内对同 storyline 的事件加权 4 倍
 *  - 如果上一事件的 nextEvents 列表里有当前可用事件，则 100% 命中第一个匹配项
 */
export function pickEvent(
  availableEvents: GameEvent[],
  eventHistory: string[],
  currentStoryline?: string
): GameEvent | null {
  if (availableEvents.length === 0) return null

  // 加权抽样：构造一个 weight 数组，按 storyline 命中次数加权
  const weightedPick = (pool: GameEvent[]): GameEvent => {
    if (pool.length === 1) return pool[0]
    const weights = pool.map(e => {
      if (!currentStoryline) return 1
      // 同 storyline 加权 4 倍
      if (e.storyline && e.storyline === currentStoryline) return 4
      // 同 key 前缀 storyline 加权 2 倍（兼容子线）
      return 1
    })
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]
      if (r <= 0) return pool[i]
    }
    return pool[pool.length - 1]
  }

  // 1) 支线触发窗口
  const branchEvents = availableEvents.filter(e => e.type === 'emotion' || e.type === 'gray')
  if (branchEvents.length > 0 && Math.random() < 0.3) {
    const recent = eventHistory.slice(-5).filter(id => branchEvents.some(e => e.id === id))
    const notRecent = branchEvents.filter(e => !recent.includes(e.id))
    const pool = notRecent.length > 0 ? notRecent : branchEvents
    return weightedPick(pool)
  }

  // 2) historical
  const historical = availableEvents.filter(e => e.type === 'historical' && !eventHistory.includes(e.id))
  if (historical.length > 0) {
    return weightedPick(historical)
  }

  // 3) transition
  const transition = availableEvents.filter(e => e.type === 'transition' && !eventHistory.includes(e.id))
  if (transition.length > 0) {
    return weightedPick(transition)
  }

  // 4) random（包含 emotion/gray 兜底）
  const random = availableEvents.filter(e => e.type === 'random' || e.type === 'emotion' || e.type === 'gray')
  if (random.length > 0) {
    const recent = eventHistory.slice(-5).filter(id => random.some(e => e.id === id))
    const notRecent = random.filter(e => !recent.includes(e.id))
    const pool = notRecent.length > 0 ? notRecent : random
    return weightedPick(pool)
  }

  // 5) normal
  const normal = availableEvents.filter(e => e.type === 'normal' && !eventHistory.includes(e.id))
  if (normal.length > 0) {
    return weightedPick(normal)
  }

  return null
}
