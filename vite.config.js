import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// 说明：
// - base 固定为相对路径 './'：同一份产物要同时跑在
//     GitHub Pages 子路径（/chongzhen-game/）、本地 preview、以及 Electron 的 file:// 下。
//   历史上是 base:'/chongzhen-game/' + CI 里再用 --base=./ 覆盖，两处容易漂移；
//   本应用没有前端路由，相对 base 完全安全，因此统一在此声明。
// - 已移除旧版 file-tree-api 开发插件：它会在 dev server 上以 CORS:* 暴露
//   /api/file-tree 与 /api/file（可读取项目根下任意文件），属于面向生产交付的隐患，
//   且其配套页面 public/file-tree.html 已清理。
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version)
  },
  plugins: [
    react({
      // 生产环境使用自动 JSX 运行时
      jsxRuntime: 'automatic'
    })
  ],
  build: {
    target: 'es2022',
    minify: 'terser',
    terserOptions: {
      compress: {
        // 保留 console.warn / console.error：
        // 存档失败、音频加载失败等关键诊断信息都走 console.error，
        // 全量 drop_console 会让线上问题完全不可查。
        drop_console: false,
        drop_debugger: true,
        passes: 2,
        pure_funcs: ['console.log', 'console.debug', 'console.info']
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    },
    // 禁用 CSS 代码分割：全部 CSS 合成单文件，避免打开懒加载弹窗时出现样式闪烁
    cssCodeSplit: false,
    cssMinify: 'lightningcss',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React 生态 vendor
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }
          // 游戏数据分片：按年份/类型拆包，提升缓存命中率
          const historicalYearMatch = id.match(/\/src\/data\/events\/historical\/(\d{4})[^/]*\.ts$/)
          if (historicalYearMatch) {
            return `events-historical-${historicalYearMatch[1]}`
          }
          if (id.includes('/src/data/events/historical/')) {
            return 'events-historical-misc'
          }
          const transitionYearMatch = id.match(/\/src\/data\/events\/transition\/(\d{4})[^/]*\.ts$/)
          if (transitionYearMatch) {
            return `events-transition-${transitionYearMatch[1]}`
          }
          if (id.includes('/src/data/events/transition/')) {
            return 'events-transition-misc'
          }
          if (id.includes('/src/data/events/gray/')) {
            return 'events-gray'
          }
          if (id.includes('/src/data/events/emotion/')) {
            return 'events-emotion'
          }
          if (id.includes('/src/data/events/origin/')) {
            return 'events-origin'
          }
          if (id.includes('/src/data/events/ending/')) {
            return 'events-ending'
          }
          if (id.includes('/src/services/')) {
            return 'services'
          }
          if (id.includes('/src/components/AIAdvisor')) {
            return 'feature-ai'
          }
          if (id.includes('/src/components/ImageGenerator')) {
            return 'feature-image'
          }
          if (id.includes('/src/components/')) {
            return 'ui-components'
          }
          if (id.includes('/src/utils/') || id.includes('/src/types/')) {
            return 'utils-types'
          }
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: assetInfo => {
          const info = assetInfo.name || ''
          if (info.endsWith('.css')) return 'assets/styles/[name]-[hash][extname]'
          if (/\.(mp3|ogg|wav|m4a)$/.test(info)) return 'assets/media/[name]-[hash][extname]'
          if (/\.(webp|png|jpg|jpeg|gif|svg|avif)$/.test(info)) return 'assets/images/[name]-[hash][extname]'
          if (/\.(woff2?|ttf|otf|eot)$/.test(info)) return 'assets/fonts/[name]-[hash][extname]'
          return 'assets/[name]-[hash][extname]'
        }
      }
    },
    reportCompressedSize: false
  },
  server: {
    port: 5173,
    strictPort: true,
    open: false,
    cors: true,
    host: true
  },
  preview: {
    port: 4173,
    host: true
  },
  optimizeDeps: {
    include: ['react', 'react-dom']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@data': path.resolve(__dirname, './src/data'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types')
    }
  }
})
