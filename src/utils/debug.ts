/**
 * 开发者调试开关。
 *
 * 背景（发布阻断项）：游戏里有一个「幽灵模式」面板（CheatMode），
 * 可以任意改属性、跳年份，并且能**直接浏览全部事件与全部结局**——
 * 包括尚未解锁的结局，属于严重剧透。它此前对每一个玩家都是常驻可见的按钮
 * （StatusBar 里的「幽灵模式」），这在正式发行版本里是不可接受的。
 *
 * 启用规则（优先级从高到低）：
 *   1. 开发构建（import.meta.env.DEV）—— 始终可用
 *   2. 显式查询参数 `?debug=1` —— 写入 localStorage 后长期有效（便于线上排查问题）
 *   3. 显式查询参数 `?debug=0` —— 关闭并清除
 *   4. localStorage 里已保存的开关
 * 生产构建默认关闭。
 */
const DEBUG_STORAGE_KEY = 'chongzhen_debug_enabled'

let cached: boolean | null = null

function computeDebugEnabled(): boolean {
  // 开发构建始终开启
  if (import.meta.env.DEV) return true

  try {
    const params = new URLSearchParams(window.location.search)
    const flag = params.get('debug')
    if (flag === '1') {
      localStorage.setItem(DEBUG_STORAGE_KEY, '1')
      return true
    }
    if (flag === '0') {
      localStorage.removeItem(DEBUG_STORAGE_KEY)
      return false
    }
    return localStorage.getItem(DEBUG_STORAGE_KEY) === '1'
  } catch {
    // 隐私模式 / 非浏览器环境
    return false
  }
}

/** 是否允许显示调试工具。结果会被缓存，避免每次渲染都解析 URL */
export function isDebugModeEnabled(): boolean {
  if (cached === null) cached = computeDebugEnabled()
  return cached
}

/** 供测试或运行时切换后手动刷新缓存 */
export function resetDebugModeCache(): void {
  cached = null
}
