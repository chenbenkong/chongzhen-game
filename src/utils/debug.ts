/**
 * 开发者调试开关（控制状态栏里的「幽灵模式」按钮）。
 *
 * ⚠️ 当前默认值是**开启**，这是项目所有者的明确选择。
 *
 * 需要知道代价：该面板可以任意改属性、跳年份，并且能**直接浏览全部事件与全部结局**，
 * 包括尚未解锁的结局 —— 对玩家来说这是严重剧透。审计时它被列为发布阻断项，
 * 一度被改成"仅开发构建或 ?debug=1 时可见"。所有者选择改回常驻可见，
 * 因为这是他本人的开发/试玩工具，且项目目前并不打算真的发行。
 *
 * 启用规则（优先级从高到低）：
 *   1. 查询参数 `?debug=0` —— 关闭，并记住（便于随时用"玩家视角"检查界面）
 *   2. 查询参数 `?debug=1` —— 开启，并记住
 *   3. localStorage 里记住的上一次选择
 *   4. 默认：**开启**
 *
 * 若将来要发行、想让玩家看不到它，把 computeDebugEnabled 末尾的 `return true`
 * 改成 `return false` 即可（其余机制无需改动）。
 */
const DEBUG_STORAGE_KEY = 'chongzhen_debug_enabled'

let cached: boolean | null = null

function computeDebugEnabled(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    const flag = params.get('debug')

    if (flag === '1') {
      localStorage.setItem(DEBUG_STORAGE_KEY, '1')
      return true
    }
    if (flag === '0') {
      localStorage.setItem(DEBUG_STORAGE_KEY, '0')
      return false
    }

    // 记住的上一次显式选择优先于默认值
    const saved = localStorage.getItem(DEBUG_STORAGE_KEY)
    if (saved === '1') return true
    if (saved === '0') return false
  } catch {
    // 隐私模式 / 非浏览器环境：落到下面的默认值
  }

  // 默认开启。要发行时把这一行改成 `return false`。
  return true
}

/** 是否显示调试工具。结果会被缓存，避免每次渲染都解析 URL */
export function isDebugModeEnabled(): boolean {
  if (cached === null) cached = computeDebugEnabled()
  return cached
}

/** 供测试或运行时切换后手动刷新缓存 */
export function resetDebugModeCache(): void {
  cached = null
}
