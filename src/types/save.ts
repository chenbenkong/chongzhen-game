import { Character, GameStateValues, OriginType, DegreeType, LifeRecord, normalizeHidden } from './game'
import { AchievementData } from './achievement'
import type { DifficultyLevel } from './difficulty'
import type { GameEvent } from './event'

export interface SavePreview {
  playerName: string
  year: number
  month: number
  rank: string
  degree: string
  savedAt: string
  playTime?: number
  title: string
}

export interface SaveData {
  character: Character
  gameState: GameStateValues
  eventHistory: string[]
  /** 存档时正在处理的事件 id（兼容旧存档） */
  currentEventId?: string | null
  /** 存档时正在处理的事件对象（"继续游戏"时直接恢复事件卡） */
  currentEvent?: GameEvent | null
  /** 同月多事件队列里还没处理的事件 */
  pendingEvents?: GameEvent[]
  origin: OriginType
  degree: DegreeType
  playerName: string
  identityType: string
  lifeRecords: LifeRecord[]
  savedAt: string
  playTime?: number
  /** 每个存档独立的成就数据（新游戏时为空数组） */
  achievements?: AchievementData
  /** 当前持久化剧情线（玩家主动选择后保存） */
  currentStoryline?: string
  /** 本局难度。旧存档缺失时按 'normal' 处理 */
  difficulty?: DifficultyLevel
  /**
   * 局内统计计数（成就判定用）。
   * 升迁/贬官次数不在这里 —— 它们已经存在 character.promotionCount / character.demotionCount 上。
   * 旧存档缺失时由 migrateSave 补成全 0。
   */
  stats?: PlayerStats
  /** 存档格式版本，用于后续迁移 */
  schemaVersion?: number
}

/**
 * 局内统计计数（成就判定用，随存档持久化）。
 * 每个字段都对应 AchievementContext 里的同名计数器。
 */
export interface PlayerStats {
  /** 连续「非负面回合」计数 */
  luckyStreak: number
  /** 连续「负面回合」计数 */
  unluckyStreak: number
  /** 累计「选中当前事件的第一个选项」的事件数 */
  firstChoiceCount: number
  /** 累计「随机选择选项」次数（当前版本恒为 0，游戏内没有该入口） */
  randomChoiceCount: number
  /** 累计使用悔棋/回退的次数 */
  undoCount: number
  /** 累计手动存档次数（不含自动存档） */
  saveCount: number
}

/** 全 0 的初始统计（新游戏 / 旧存档迁移用） */
export function createEmptyPlayerStats(): PlayerStats {
  return {
    luckyStreak: 0,
    unluckyStreak: 0,
    firstChoiceCount: 0,
    randomChoiceCount: 0,
    undoCount: 0,
    saveCount: 0
  }
}

/**
 * 把任意来源的统计对象规整成完整的 PlayerStats：
 * 缺失键补 0，非有限数（NaN / Infinity / null / 字符串）一律补 0 并向下取整为自然数。
 * 历史存档没有 stats 字段，因此这里必须容忍 undefined。
 */
export function normalizePlayerStats(input?: Partial<PlayerStats> | null): PlayerStats {
  const out = createEmptyPlayerStats()
  if (!input || typeof input !== 'object') return out
  for (const key of Object.keys(out) as Array<keyof PlayerStats>) {
    const value = (input as Record<string, unknown>)[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = Math.max(0, Math.floor(value))
    }
  }
  return out
}

export interface SaveSlot {
  id: number
  data: SaveData | null | undefined
  preview: SavePreview | null | undefined
}

// ============================================================
// 存档格式版本与迁移
// ============================================================

/**
 * 存档格式版本。
 *  1 — 初始版本（character.hidden 只有三项，可能含 NaN/null）
 *  2 — 补齐 机敏值 / 忠诚值；隐藏属性统一规整为 0-100 的有限数
 *  3 — 新增 stats（局内成就统计计数）；旧存档补成全 0
 * 每次改动 SaveData 的结构都应递增，并在 migrateSave 里补上对应分支。
 */
export const SAVE_SCHEMA_VERSION = 3

/** 角色生平流水最大长度：纯展示用，超长时截断以约束存档体积 */
export const MAX_CHARACTER_HISTORY = 400
/** 单条存档序列化后的软上限（字符数）。超过则进一步裁剪 */
export const SAVE_SIZE_SOFT_LIMIT = 1_200_000

/**
 * 把任意版本的存档对象升级到当前 schema，并做字段规整。
 * 返回 null 表示这份数据无法救活（缺 character / gameState）。
 */
function migrateSave(parsed: unknown): SaveData | null {
  if (!parsed || typeof parsed !== 'object') return null
  const raw = parsed as Record<string, any>
  if (!raw.character || !raw.gameState) return null

  // v1 -> v2：隐藏属性可能缺键，或被 NaN 污染（NaN 经 JSON 序列化会变成 null）
  raw.character.hidden = normalizeHidden(raw.character.hidden)

  // 角色字段兜底：旧存档可能缺少后来才加入的字段
  const character = raw.character as Character
  if (!Array.isArray(character.flags)) character.flags = []
  if (!Array.isArray(character.history)) character.history = []
  if (!Array.isArray(character.wives)) character.wives = []
  if (!Array.isArray(character.lovers)) character.lovers = []
  if (!Array.isArray(character.examHistory)) character.examHistory = []
  if (typeof character.promotionCount !== 'number') character.promotionCount = 0
  if (typeof character.demotionCount !== 'number') character.demotionCount = 0
  if (!character.faction) {
    character.faction = { 东林好感: 50, 阉党好感: 50, 立场: '未定', 党争烈度: 30 }
  }

  // 三档难度是后来加入的，旧存档没有这个字段
  if (raw.difficulty !== 'easy' && raw.difficulty !== 'normal' && raw.difficulty !== 'hard') {
    raw.difficulty = 'normal'
  }

  if (!Array.isArray(raw.eventHistory)) raw.eventHistory = []
  if (!Array.isArray(raw.lifeRecords)) raw.lifeRecords = []

  // v2 -> v3：局内统计计数。旧存档没有 stats，这里补成全 0；
  // 已损坏的值（NaN / null / 负数）也一并规整，避免成就计数被污染成 NaN。
  raw.stats = normalizePlayerStats(raw.stats)

  raw.schemaVersion = SAVE_SCHEMA_VERSION
  return raw as SaveData
}

/** 裁剪纯展示用的流水，约束存档体积 */
function trimForStorage(data: SaveData): SaveData {
  const history = data.character?.history
  if (Array.isArray(history) && history.length > MAX_CHARACTER_HISTORY) {
    data.character.history = history.slice(-MAX_CHARACTER_HISTORY)
  }
  return data
}

/** 把存档序列化成字符串；体积超限时进一步裁剪后重试一次 */
function serializeSave(data: SaveData): string {
  trimForStorage(data)
  let json = JSON.stringify(data)
  if (json.length > SAVE_SIZE_SOFT_LIMIT) {
    // 极端长局：优先牺牲最早的流水记录
    if (data.character?.history?.length) {
      data.character.history = data.character.history.slice(-MAX_CHARACTER_HISTORY / 2)
    }
    const retry = JSON.stringify(data)
    if (retry.length < json.length) json = retry
  }
  return json
}

// ============================================================
// 槽位读写
// ============================================================

export function getSaveKey(slotId: number): string {
  return `chongzhen_save_slot_${slotId}`
}

/** 存储写入失败时派发的事件名，UI 可监听以提示玩家 */
export const STORAGE_ERROR_EVENT = 'chongzhen-storage-error'

function reportStorageError(context: string, error: unknown): void {
  const err = error as { name?: string; message?: string }
  const isQuota = err?.name === 'QuotaExceededError' || /quota|exceeded/i.test(err?.message || '')
  console.error(`[save] ${context} 写入失败：`, err?.name, err?.message)
  try {
    window.dispatchEvent(
      new CustomEvent(STORAGE_ERROR_EVENT, {
        detail: {
          context,
          quotaExceeded: isQuota,
          message: isQuota
            ? '浏览器本地存储已满，本次进度未能保存'
            : '本地存储写入失败，本次进度未能保存'
        }
      })
    )
  } catch {
    // 非浏览器环境（脚本 / 测试）忽略
  }
}

export function loadSaveSlot(slotId: number): SaveData | null {
  const key = getSaveKey(slotId)
  let rawData: string | null = null
  try {
    rawData = localStorage.getItem(key)
  } catch (e) {
    console.error(`[load] slot ${slotId} 读取失败：`, e)
    return null
  }
  if (!rawData) return null

  try {
    const migrated = migrateSave(JSON.parse(rawData))
    if (!migrated) {
      console.warn(`[load] slot ${slotId} 缺少 character/gameState，已忽略`)
      return null
    }
    return migrated
  } catch (e) {
    console.error(`[load] slot ${slotId} 解析失败：`, e)
    return null
  }
}

export function saveSaveSlot(slotId: number, data: SaveData): boolean {
  const key = getSaveKey(slotId)
  try {
    const json = serializeSave(data)
    localStorage.setItem(key, json)
    return true
  } catch (e) {
    reportStorageError(`slot ${slotId}`, e)
    return false
  }
}

export function deleteSaveSlot(slotId: number): void {
  try {
    localStorage.removeItem(getSaveKey(slotId))
  } catch {
    // ignore
  }
}

// ============================================================
// 预览
// ============================================================

function buildPreview(data: SaveData | null): SavePreview | null {
  if (!data) return null
  return {
    playerName: data.playerName || data.character?.name || '无名氏',
    year: data.gameState?.currentYear || 1628,
    month: data.gameState?.currentMonth || 1,
    rank: data.character?.rank || '待选',
    degree: data.character?.degree || '童生',
    savedAt: data.savedAt || new Date().toISOString(),
    playTime: data.playTime,
    title: data.identityType || '官员'
  }
}

export function getSavePreview(slotId: number): SavePreview | null {
  return buildPreview(loadSaveSlot(slotId))
}

export const MANUAL_SAVE_SLOT_IDS = [1, 2, 3] as const

export function getAllSaveSlots(): SaveSlot[] {
  return MANUAL_SAVE_SLOT_IDS.map(id => ({
    id,
    data: loadSaveSlot(id),
    preview: getSavePreview(id)
  }))
}

// ============================================================
// 自动存档（独立槽位，不占用 1/2/3 号手动槽）
// ============================================================
// 设计：自动存档在每个事件处理完毕 + 每次下月时静默写入；
// 与"读档/覆盖式存档"的 3 个槽位完全独立，玩家无法在普通存档槽位中误删它。
// 启动时（title 界面）会单独提供"继续上次自动存档"入口。

export const AUTOSAVE_KEY = 'chongzhen_autosave'

/**
 * 保存到自动存档槽（覆盖式）。
 * 返回是否写入成功——调用方应据此提示玩家，而不是像以前那样静默吞掉
 * QuotaExceededError，让玩家在毫无察觉的情况下丢掉整局进度。
 */
export function saveAutosave(data: SaveData): boolean {
  try {
    const json = serializeSave(data)
    localStorage.setItem(AUTOSAVE_KEY, json)
    return true
  } catch (e) {
    reportStorageError('自动存档', e)
    return false
  }
}

/** 读取自动存档（不存在 / 解析失败时返回 null） */
export function loadAutosave(): SaveData | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    return migrateSave(JSON.parse(raw))
  } catch (e) {
    console.error('[autosave] 读取失败：', e)
    return null
  }
}

/** 是否有可用的自动存档 */
export function hasAutosave(): boolean {
  return loadAutosave() !== null
}

/** 获取自动存档的预览（用于 title 界面按钮显示） */
export function getAutosavePreview(): SavePreview | null {
  return buildPreview(loadAutosave())
}

/** 删除自动存档（新游戏 / 重开时调用，避免和上一局数据混淆） */
export function deleteAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY)
  } catch {
    // ignore
  }
}
