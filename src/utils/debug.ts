/**
 * 开发者调试开关（控制状态栏里的「幽灵模式」按钮）。
 *
 * 默认值来自构建期常量 `__DEBUG_PANEL_DEFAULT__`（在 vite.config.js 里 define）：
 *   - GitHub Pages 演示站 / 本地 dev：默认 **开启**（项目所有者用它试玩）
 *   - 发行构建（desktop/ 的 Electron/Steam 打包，带 CZ_DEBUG_PANEL_DEFAULT=0）：默认 **关闭**
 *
 * 发行版必须关闭的原因：该面板可以任意改属性、跳年份，并且能**直接浏览全部事件与
 * 全部结局**，包括尚未解锁的结局 —— 对玩家是彻底剧透，商业发行不允许默认暴露。
 *
 * 启用规则（优先级从高到低）：
 *   1. 查询参数 `?debug=1` —— 开启，并记住
 *   2. 查询参数 `?debug=0` —— 关闭，并记住
 *   3. localStorage 里记住的上一次显式选择
 *   4. 构建期默认值 __DEBUG_PANEL_DEFAULT__
 */
const DEBUG_STORAGE_KEY = 'chongzhen_debug_enabled'

/** 发行构建可能未注入该常量（例如单测直接跑 src/），因此给出安全回退 */
declare const __DEBUG_PANEL_DEFAULT__: boolean | undefined

function buildDefault(): boolean {
  return typeof __DEBUG_PANEL_DEFAULT__ === 'boolean' ? __DEBUG_PANEL_DEFAULT__ : true
}

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

  // 交给构建期决定（见文件头说明）。
  return buildDefault()
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
