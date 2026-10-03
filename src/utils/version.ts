/**
 * 版本号单一来源：由 vite.config.js 在构建期从 package.json 注入 __APP_VERSION__。
 * 这样标题屏显示的版本不会和 package.json 漂移（历史上出现过标题写 v0.3.0、
 * package.json 写 0.1.0 的不一致）。
 */
function readVersion(): string {
  try {
    if (typeof __APP_VERSION__ === 'string' && __APP_VERSION__.length > 0) {
      return __APP_VERSION__
    }
  } catch {
    // 未经过 Vite 构建（例如被直接 import 的单测）时走兜底
  }
  return '0.0.0-dev'
}

export const APP_VERSION = readVersion()

/** 标题屏展示用，如 "v0.4.0" */
export const APP_VERSION_LABEL = `v${APP_VERSION}`
