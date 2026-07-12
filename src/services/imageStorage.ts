/**
 * 丹青画卷 - 持久化存储
 * 玩家生成的图像会存档到 localStorage，可按事件关联查看
 */

import type { ImageSize, ImageRatio } from '../services/imageService'

export interface SavedImage {
  id: string
  /** 玩家原始输入 */
  userPrompt: string
  /** 完整 prompt（含增强风格词） */
  fullPrompt: string
  /** URL 输出（优先存储，体积小） */
  url?: string
  /** Base64 输出（备选，体积大） */
  b64Json?: string
  size: ImageSize
  ratio: ImageRatio
  /** 关联事件 ID（如果是在"当前事件"模板下生成的） */
  eventId?: string
  /** 事件标题（事件 ID 可能已不在内存中，存标题用于历史展示） */
  eventTitle?: string
  /** 生成时的游戏内时间 */
  year?: number
  month?: number
  /** 模板类型：'event' | 'portrait' | 'court' | 'street' | 'custom' */
  templateKind?: string
  createdAt: number
}

const STORAGE_KEY = 'chongzhen_image_gallery_v1'
/** localStorage 容量有限，超出时截断旧记录 */
const MAX_ITEMS = 50

/** 安全读取 */
function readAll(): SavedImage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/** 安全写入（带容量控制） */
function writeAll(items: SavedImage[]): void {
  try {
    // 超出容量时按时间淘汰最旧的
    const trimmed = items.length > MAX_ITEMS
      ? items.slice(0, MAX_ITEMS)
      : items
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch (e) {
    // 容量超限（QuotaExceededError）：尝试只保留 URL，去掉 b64Json 后再写
    if (items.length > 1) {
      const reduced = items.slice(0, Math.floor(items.length / 2)).map(item => ({
        ...item,
        b64Json: undefined  // 丢弃 base64，只留 URL
      }))
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced))
      } catch {
        // 还失败就放弃
      }
    }
  }
}

/** 保存一张图（按时间倒序插入头部） */
export function saveImage(item: Omit<SavedImage, 'id' | 'createdAt'>): SavedImage {
  const all = readAll()
  const newItem: SavedImage = {
    ...item,
    id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now()
  }
  // 去重：如果已存在相同 URL 的图（重新生成），更新而非新增
  const dupIdx = newItem.url ? all.findIndex(x => x.url === newItem.url) : -1
  if (dupIdx >= 0) {
    all[dupIdx] = newItem
  } else {
    all.unshift(newItem)
  }
  writeAll(all)
  return newItem
}

/** 获取所有图 */
export function getAllImages(): SavedImage[] {
  return readAll()
}

/** 按事件 ID 查图 */
export function getImagesByEvent(eventId: string): SavedImage[] {
  if (!eventId) return []
  return readAll().filter(img => img.eventId === eventId)
}

/** 删除单张 */
export function deleteImage(id: string): void {
  const all = readAll().filter(x => x.id !== id)
  writeAll(all)
}

/** 清空所有 */
export function clearAllImages(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** 监听 storage 事件（跨 tab 同步） */
export function subscribeImages(cb: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb()
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
