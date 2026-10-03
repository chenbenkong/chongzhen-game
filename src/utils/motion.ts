/* ============================================================
   动效偏好工具
   CSS 侧的 @media (prefers-reduced-motion: reduce) 无法拦截由 JS
   驱动的动效（setInterval 逐帧刷新、setTimeout 延迟揭示结果），
   因此统一在这里暴露给组件调用。
   ============================================================ */

/** 系统「减少动态效果」媒体查询 */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * 当前是否偏好减少动态效果。
 * matchMedia 不可用时（SSR、极老浏览器）一律按「未开启」处理，绝不抛错。
 */
export function prefersReducedMotion(): boolean {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia(REDUCED_MOTION_QUERY).matches
  } catch {
    return false
  }
}

/**
 * 动画延时收敛：偏好减少动态效果时返回 0（跳过动画、直接出结果），
 * 否则原样返回毫秒数。
 */
export function motionDelay(ms: number): number {
  if (prefersReducedMotion()) return 0
  return ms > 0 ? ms : 0
}
