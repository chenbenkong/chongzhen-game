/// <reference types="vite/client" />

/** 构建期由 vite.config.js 的 define 注入，值取自 package.json 的 version */
declare const __APP_VERSION__: string

/**
 * 「幽灵模式」调试面板的构建期默认值。
 * 由 vite.config.js 根据 CZ_DEBUG_PANEL_DEFAULT 环境变量注入：
 * 演示站/开发为 true，发行构建（desktop/ 打包）为 false。
 */
declare const __DEBUG_PANEL_DEFAULT__: boolean
