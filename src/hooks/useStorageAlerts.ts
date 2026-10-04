import { useEffect, useState } from 'react'
import {
  STORAGE_ERROR_EVENT,
  STORAGE_READ_ERROR_EVENT,
  takePendingReadError
} from '../types/save'

export interface StorageAlert {
  id: number
  message: string
  subMessage?: string
  tone: 'error' | 'warning'
}

/**
 * 监听本地存储的写入 / 读取失败，并转成玩家可见的提示。
 *
 * 为什么需要它：`save.ts` 一直在派发 `chongzhen-storage-error`，
 * 注释也写着"UI 可监听以提示玩家"，但**没有任何组件订阅过**。
 * 于是文档里"存档失败不再静默"这条其实并不成立 ——
 *   · localStorage 写满：玩家毫无提示地丢掉整局进度；
 *   · 存档损坏：「继续上次游戏」按钮直接消失，看起来像"存档没了"。
 * 这两种都会被玩家当成"游戏闪退 / 丢档"。
 *
 * ⚠️ 读错误必须**补取**（takePendingReadError），不能只靠监听事件：
 * 标题屏在渲染阶段就调用 hasAutosave()，而订阅发生在 useEffect 里 ——
 * 渲染早于 effect，只靠事件的话这条提示会被整个漏掉。
 *
 * 提示是自动消失的非阻塞浮层而不是模态框 ——
 * 写失败往往发生在推进月份的关键时刻，弹模态会打断操作。
 */
let nextId = 1

export function useStorageAlerts() {
  const [alerts, setAlerts] = useState<StorageAlert[]>([])

  useEffect(() => {
    const push = (message: string, tone: 'error' | 'warning', sub?: string) => {
      const id = nextId++
      setAlerts(prev => [...prev.slice(-2), { id, message, subMessage: sub, tone }])
      // 6 秒后自动消失；连续触发时靠 slice(-2) 只保留最新两条
      window.setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== id))
      }, 6000)
    }

    const onWriteError = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      push(
        detail.message || '本地存储写入失败，本次进度未能保存',
        'error',
        detail.quotaExceeded ? '浏览器空间已满 —— 清理浏览器数据或改用桌面版可以解决。' : undefined
      )
    }

    const onReadError = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      push(detail.message || '本地存档无法读取', 'warning')
    }

    window.addEventListener(STORAGE_ERROR_EVENT, onWriteError)
    window.addEventListener(STORAGE_READ_ERROR_EVENT, onReadError)

    // 补取渲染阶段就已经发生的读错误（见文件头说明）
    const pending = takePendingReadError()
    if (pending) {
      push('本地存档无法读取，可能已损坏。本次进度将从头开始（原存档不会被覆盖）。', 'warning')
    }

    return () => {
      window.removeEventListener(STORAGE_ERROR_EVENT, onWriteError)
      window.removeEventListener(STORAGE_READ_ERROR_EVENT, onReadError)
    }
  }, [])

  return alerts
}