import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'

/**
 * 单元测试配置（与 Playwright 的端到端测试分开）。
 *
 *   npm run test:unit        # 跑一次
 *   npm run test:unit:watch  # 监听模式
 *
 * 复用 vite.config.js：这样 __APP_VERSION__ 等构建期 define、路径别名、
 * react 插件与生产构建完全一致，避免"测试里能过、构建后不行"。
 *
 * 端到端测试（真实 Chromium）在 tests/*.mjs，由 tests/package.json 管理，
 * 单独跑 `npm run test:e2e`——两者互不依赖，也互不拖慢。
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['tests/unit/**/*.test.{ts,tsx}'],
      setupFiles: ['./tests/unit/setup.ts'],
      // 每个用例之间完全隔离，避免模块级单例（如成就数据）串味
      isolate: true,
      restoreMocks: true,
      clearMocks: true,
      // 组件里 import 的 .css 直接忽略，不需要真的解析样式
      css: false,
      testTimeout: 20000
    }
  })
)
