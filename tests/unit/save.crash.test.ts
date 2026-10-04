import { beforeEach, describe, expect, it } from 'vitest'
import { normalizeAttributes, ATTRIBUTE_DEFAULTS } from '../../src/types/game'
import { loadAutosave, migrateSaveForTest, SAVE_SCHEMA_VERSION } from '../../src/types/save'

/**
 * 读档白屏的回归防线。
 *
 * 实测（真实 Chromium + 畸形存档模糊测试）发现的崩溃：
 *   character 存在但**整个 attributes 缺失**时，读档后渲染第一帧就抛
 *     TypeError: Cannot read properties of undefined (reading '理政')
 *   抛在 AttributePanel —— 它是直接下标访问 `attributes.理政` 的。
 *   整个游戏被 ErrorBoundary 接管，玩家看到的是崩溃界面。
 *
 * 为什么以前没被发现：`migrateSave` 为**每一个**字段都做了兜底
 *（flags / faction / difficulty / stats / hidden …），唯独漏了 `attributes`。
 * 于是"缺 character 或 gameState 才拒绝"的那道校验放行了这份存档，
 * 崩溃点被推迟到渲染期 —— 最难排查的那种白屏。
 *
 * 还有第二条独立路径：游戏内存档面板的「继续上次游戏」曾经自己
 * `JSON.parse` 而**绕过 migrateSave**，所以同一个存档从标题屏读没事、
 * 从游戏内读就崩。现已收敛到统一的 loadAutosave()。
 */

const VALID_CHAR = {
  name: '测试',
  courtesyName: '',
  hometown: '苏州',
  origin: '寒门',
  age: 22,
  degree: '进士',
  rank: '从七品·判官',
  attributes: { 财帛: 15, 文韬: 65, 理政: 30, 武略: 20, 体质: 60 },
  flags: []
}
const VALID_STATE = {
  turn: 5,
  currentYear: 1629,
  currentMonth: 3,
  国势: 75,
  圣眷: 20,
  中官: 20,
  清议: 25,
  士绅: 15,
  民望: 30
}

describe('normalizeAttributes：个人能力规整', () => {
  it('undefined 时返回完整默认值', () => {
    expect(normalizeAttributes(undefined)).toEqual(ATTRIBUTE_DEFAULTS)
  })

  it('null 时返回完整默认值', () => {
    expect(normalizeAttributes(null as never)).toEqual(ATTRIBUTE_DEFAULTS)
  })

  it('缺单个键时用默认值补齐（这正是崩溃的那个字段）', () => {
    const out = normalizeAttributes({ 财帛: 10, 文韬: 10, 武略: 10, 体质: 10 } as never)
    expect(out.理政).toBe(ATTRIBUTE_DEFAULTS.理政)
    expect(out.财帛).toBe(10)
  })

  it('NaN 被 JSON 序列化成 null —— 当成缺失而不是当 0 处理', () => {
    const out = normalizeAttributes({ 财帛: null, 文韬: null } as never)
    expect(out.财帛).toBe(ATTRIBUTE_DEFAULTS.财帛)
    expect(Number.isNaN(out.文韬)).toBe(false)
  })

  it('越界值被夹到 0-100 并取整', () => {
    const out = normalizeAttributes({ 财帛: -50, 文韬: 999, 理政: 30.7 } as never)
    expect(out.财帛).toBe(0)
    expect(out.文韬).toBe(100)
    expect(out.理政).toBe(31)
  })

  it('结果里不含 NaN（NaN 会污染存档并让条件判定前后矛盾）', () => {
    const out = normalizeAttributes({ 财帛: NaN, 文韬: Infinity } as never)
    for (const v of Object.values(out)) expect(Number.isFinite(v)).toBe(true)
  })
})

describe('migrateSave：畸形存档必须被安全拒绝或修复', () => {
  it('character 缺 attributes 时补齐（回归：曾经在此白屏）', () => {
    const out = migrateSaveForTest({ character: { ...VALID_CHAR, attributes: undefined }, gameState: VALID_STATE })
    expect(out).not.toBeNull()
    expect(Number.isFinite(out!.character.attributes.理政)).toBe(true)
    expect(Number.isFinite(out!.character.attributes.财帛)).toBe(true)
  })

  it('character 是字符串时干净拒绝，而不是抛 TypeError', () => {
    // 原实现只判 `!raw.character`，于是 character='x' 会走进
    // `raw.character.hidden = ...` 抛 "Cannot create property 'hidden' on string"
    expect(migrateSaveForTest({ character: 'not an object', gameState: VALID_STATE })).toBeNull()
  })

  it('gameState 是字符串时干净拒绝', () => {
    expect(migrateSaveForTest({ character: VALID_CHAR, gameState: 'not an object' })).toBeNull()
  })

  it('数组被拒绝', () => {
    expect(migrateSaveForTest([1, 2, 3])).toBeNull()
    expect(migrateSaveForTest({ character: [], gameState: VALID_STATE })).toBeNull()
  })

  it('缺 character / gameState 时拒绝', () => {
    expect(migrateSaveForTest({})).toBeNull()
    expect(migrateSaveForTest({ character: VALID_CHAR })).toBeNull()
    expect(migrateSaveForTest({ gameState: VALID_STATE })).toBeNull()
  })

  it('正常存档通过且版本号被提升', () => {
    const out = migrateSaveForTest({ character: VALID_CHAR, gameState: VALID_STATE })
    expect(out).not.toBeNull()
    expect(out!.schemaVersion).toBe(SAVE_SCHEMA_VERSION)
  })

  it('旧存档缺的字段一律补齐（回归：读档后各处下标访问）', () => {
    const out = migrateSaveForTest({
      character: { name: '旧档', age: 22 },
      gameState: { currentYear: 1629, currentMonth: 3 }
    })
    expect(out).not.toBeNull()
    const c = out!.character
    expect(Array.isArray(c.flags)).toBe(true)
    expect(Array.isArray(c.history)).toBe(true)
    expect(Array.isArray(c.wives)).toBe(true)
    expect(Array.isArray(c.lovers)).toBe(true)
    expect(Array.isArray(c.examHistory)).toBe(true)
    expect(typeof c.promotionCount).toBe('number')
    expect(typeof c.demotionCount).toBe('number')
    expect(c.faction).toBeTruthy()
    // 关键：属性也必须在
    for (const v of Object.values(c.attributes)) expect(Number.isFinite(v)).toBe(true)
    for (const v of Object.values(c.hidden)) expect(Number.isFinite(v)).toBe(true)
  })
})

describe('loadAutosave：坏存档不抛且不上抛', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('不存在时返回 null', () => {
    expect(loadAutosave()).toBeNull()
  })

  it('非法 JSON 返回 null 而不是抛出', () => {
    localStorage.setItem('chongzhen_autosave', '{"character":{"name":"x"')
    expect(() => loadAutosave()).not.toThrow()
    expect(loadAutosave()).toBeNull()
  })

  it('纯乱码返回 null', () => {
    localStorage.setItem('chongzhen_autosave', 'not json at all')
    expect(loadAutosave()).toBeNull()
  })

  it('缺 attributes 的旧存档能被修复并正常返回（回归：曾经白屏）', () => {
    localStorage.setItem(
      'chongzhen_autosave',
      JSON.stringify({ character: { name: '旧档', age: 22 }, gameState: { currentYear: 1629, currentMonth: 3 } })
    )
    const data = loadAutosave()
    expect(data).not.toBeNull()
    expect(Number.isFinite(data!.character.attributes.理政)).toBe(true)
  })
})