import { beforeEach, describe, expect, it } from 'vitest'
import { isDebugModeEnabled, resetDebugModeCache } from '../../src/utils/debug'

/**
 * 调试面板开关的契约。
 *
 * 默认值被明确改成了**开启**（项目所有者要求「幽灵模式」常驻可见，
 * 代价是线上任何访客都能点开并浏览全部事件与未解锁结局）。
 * 这里把这个决定以及 `?debug=0` 逃生口一起钉住，
 * 免得日后有人看到按钮常驻以为是忘了加门禁、又默默地关掉。
 */

const KEY = 'chongzhen_debug_enabled'

/** 改掉当前 URL 的 query（jsdom 下用 history API） */
function setQuery(search: string): void {
  window.history.replaceState({}, '', search === '' ? '/' : `/${search}`)
  resetDebugModeCache()
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  resetDebugModeCache()
})

describe('调试开关', () => {
  it('默认开启（无参数、无历史记录）', () => {
    expect(isDebugModeEnabled()).toBe(true)
  })

  it('?debug=0 关闭，并记住这个选择', () => {
    setQuery('?debug=0')
    expect(isDebugModeEnabled()).toBe(false)
    expect(localStorage.getItem(KEY)).toBe('0')

    // 回到不带参数的地址：记住的选择仍然生效
    setQuery('')
    expect(isDebugModeEnabled()).toBe(false)
  })

  it('?debug=1 可以重新打开并覆盖之前的关闭', () => {
    setQuery('?debug=0')
    expect(isDebugModeEnabled()).toBe(false)

    setQuery('?debug=1')
    expect(isDebugModeEnabled()).toBe(true)

    setQuery('')
    expect(isDebugModeEnabled()).toBe(true)
  })

  it('无法访问 localStorage 时仍然默认开启（隐私模式等）', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    try {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('localStorage is not available')
        }
      })
      resetDebugModeCache()
      expect(isDebugModeEnabled()).toBe(true)
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original)
      resetDebugModeCache()
    }
  })
})
