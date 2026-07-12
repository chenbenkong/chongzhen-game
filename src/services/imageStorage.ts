/** 持久化存储 v2：弃用 base64，仅存 URL + 元信息 */

import type { ImageSize, ImageRatio } from '../services/imageService'

export interface SavedImage {
  id: string
  /** 玩家原始输入 */
  userPrompt: string
  /** 完整 prompt（含增强风格词） */
  fullPrompt: string
  /** URL 输出（推荐存储，体积小） */
  url?: string
  /** Base64 输出（已弃用，永远不存） */
  b64Json?: never
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

const STORAGE_KEY = 'chongzhen_image_gallery_v2'
/** 容量保护：最多保留 20 条（base64 弃用后容量不是问题，但浏览性能仍是） */
const MAX_ITEMS = 20

/** 安全读取 + 自动清理：剥离历史数据中的 base64（避免画册卡死） */
function readAll(): SavedImage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      // 首次启动新版：清理老 key
      try { localStorage.removeItem('chongzhen_image_gallery_v1') } catch {}
      return []
    }
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    // 自动迁移：剥离 b64Json 字段（v1 时代可能写入过）
    let needRewrite = false
    const cleaned = arr.map((item: SavedImage) => {
      if (item.b64Json) {
        needRewrite = true
        const { b64Json, ...rest } = item
        return rest as SavedImage
      }
      return item
    })
    if (needRewrite) {
      // 异步写回（不阻塞当前调用）
      queueMicrotask(() => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned)) } catch {}
      })
    }
    return cleaned
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
    // 容量超限：丢弃一半最旧的
    if (items.length > 1) {
      const reduced = items.slice(0, Math.floor(items.length / 2))
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reduced))
      } catch {
        // 还失败就放弃
      }
    }
  }
}

/** 保存一张图（按时间倒序插入头部） */
export function saveImage(item: Omit<SavedImage, 'id' | 'createdAt' | 'b64Json'>): SavedImage {
  const all = readAll()
  // 再次过滤：确保 b64Json 永不入库
  const { b64Json: _drop, ...cleanItem } = item as SavedImage
  void _drop
  const newItem: SavedImage = {
    ...cleanItem,
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
