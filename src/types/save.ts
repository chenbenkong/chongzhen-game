import { Character, GameStateValues, OriginType, DegreeType, LifeRecord } from './game'
import { AchievementData } from './achievement'
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
}

export interface SaveSlot {
  id: number
  data: SaveData | null | undefined
  preview: SavePreview | null | undefined
}

export function getSaveKey(slotId: number): string {
  return `chongzhen_save_slot_${slotId}`
}

export function loadSaveSlot(slotId: number): SaveData | null {
  const key = getSaveKey(slotId)
  const data = localStorage.getItem(key)
  if (!data) {
    console.log(`[load] slot ${slotId} empty`)
    return null
  }

  try {
    const parsed = JSON.parse(data)
    if (parsed.character && parsed.gameState) {
      // 兼容旧存档：relationships 可能是 Map（旧版）或 {}（JSON.stringify 跳过 Map 写入）
      if (!(parsed.character.relationships instanceof Map)) {
        parsed.character.relationships = new Map(Object.entries(parsed.character.relationships || {}))
      }
      // 兼容：character 没有 family 字段时跳过 family.关系网
      if (parsed.character.family && parsed.character.family.关系网 && !(parsed.character.family.关系网 instanceof Map)) {
        parsed.character.family.关系网 = new Map(Object.entries(parsed.character.family.关系网 || {}))
      }
      console.log(`[load] slot ${slotId} ok`, { bytes: data.length, player: parsed.playerName, turn: parsed.gameState?.turn })
      return parsed
    }
    console.warn(`[load] slot ${slotId} parsed but missing character/gameState`)
    return null
  } catch (e) {
    console.error(`[load] slot ${slotId} parse FAILED:`, e)
    return null
  }
}

export function saveSaveSlot(slotId: number, data: SaveData): boolean {
  try {
    const key = getSaveKey(slotId)
    const json = JSON.stringify(data)
    localStorage.setItem(key, json)
    console.log(`[save] slot ${slotId} ok`, { bytes: json.length, player: data.playerName, turn: data.gameState?.turn })
    return true
  } catch (e: any) {
    // localStorage 满（QuotaExceededError）或隐私模式下静默失败。详细写出来便于诊断。
    console.error(`[save] slot ${slotId} FAILED:`, e?.name, e?.message, e?.code, e?.lengthComputable)
    if (e?.name === 'QuotaExceededError' || /quota/i.test(e?.message || '')) {
      console.error('[save] localStorage 容量已满。打开 DevTools → Application → Local Storage 清理旧存档')
    }
    return false
  }
}

export function deleteSaveSlot(slotId: number): void {
  const key = getSaveKey(slotId)
  localStorage.removeItem(key)
}

export function getSavePreview(slotId: number): SavePreview | null {
  const data = loadSaveSlot(slotId)
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

export function getAllSaveSlots(): SaveSlot[] {
  return [1, 2, 3].map(id => ({
    id,
    data: loadSaveSlot(id),
    preview: getSavePreview(id)
  }))
}

// ==========================================
// 自动存档（独立槽位，不占用 1/2/3 号手动槽）
// ==========================================
// 设计：自动存档在每个事件处理完毕 + 每次下月时静默写入；
// 与"读档/覆盖式存档"的 3 个槽位完全独立，玩家无法在普通存档槽位中误删它。
// 启动时（title 界面）会单独提供"继续上次自动存档"入口。

export const AUTOSAVE_KEY = 'chongzhen_autosave'

/** 保存到自动存档槽（静默，覆盖式） */
export function saveAutosave(data: SaveData): void {
  try {
    const json = JSON.stringify(data)
    localStorage.setItem(AUTOSAVE_KEY, json)
    console.log(`[autosave] ok`, { bytes: json.length, player: data.playerName, turn: data.gameState?.turn })
  } catch (e: any) {
    // localStorage 容量满 / 隐私模式下静默失败。详细写出来便于诊断。
    console.error(`[autosave] FAILED:`, e?.name, e?.message, e?.code)
    if (e?.name === 'QuotaExceededError' || /quota/i.test(e?.message || '')) {
      console.error('[autosave] localStorage 容量已满。打开 DevTools → Application → Local Storage 清理旧存档')
    }
  }
}

/** 读取自动存档（不存在 / 解析失败时返回 null） */
export function loadAutosave(): SaveData | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.character && parsed.gameState) {
      // 兼容旧存档：relationships 可能是 Map（旧版）或 {}（JSON.stringify 跳过 Map 写入）
      if (!(parsed.character.relationships instanceof Map)) {
        parsed.character.relationships = new Map(Object.entries(parsed.character.relationships || {}))
      }
      // 兼容：character 没有 family 字段时跳过 family.关系网
      if (parsed.character.family && parsed.character.family.关系网 && !(parsed.character.family.关系网 instanceof Map)) {
        parsed.character.family.关系网 = new Map(Object.entries(parsed.character.family.关系网 || {}))
      }
      return parsed
    }
    return null
  } catch (e) {
    // 解析失败时给出诊断信息
    console.error('[autosave-load] FAILED:', e)
    return null
  }
}

/** 是否有可用的自动存档 */
export function hasAutosave(): boolean {
  return loadAutosave() !== null
}

/** 获取自动存档的预览（用于 title 界面按钮显示） */
export function getAutosavePreview(): SavePreview | null {
  const data = loadAutosave()
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

/** 删除自动存档（新游戏时调用，避免和旧存档数据混淆） */
export function deleteAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY)
  } catch {
    // ignore
  }
}
