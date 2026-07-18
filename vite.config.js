import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// ===== chongzhen-game 文件树 API 独立 server =====
const IGNORE = new Set(['node_modules', '.git', 'dist', 'dist-ssr', '.trae', '.vscode', 'public'])
const SKIP_FILES = new Set(['package-lock.json', 'tsconfig.tsbuildinfo', 'tsconfig.node.tsbuildinfo'])

function scanDir(dir, depth, maxDepth) {
  if (depth > maxDepth) return []
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) }
  catch { return [] }
  const result = []
  for (const ent of entries) {
    if (IGNORE.has(ent.name)) continue
    if (ent.name.startsWith('.') && ent.name !== '.trae') continue
    const fullPath = path.join(dir, ent.name)
    let stat
    try { stat = fs.statSync(fullPath) } catch { continue }
    const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/')
    if (ent.isDirectory()) {
      const children = scanDir(fullPath, depth + 1, maxDepth)
      result.push({ type: 'dir', name: ent.name, path: relPath, mtime: stat.mtimeMs, childCount: countFiles(children), children })
    } else if (ent.isFile()) {
      if (SKIP_FILES.has(ent.name)) continue
      if (ent.name.endsWith('.tsbuildinfo')) continue
      result.push({ type: 'file', name: ent.name, path: relPath, size: stat.size, mtime: stat.mtimeMs, ext: path.extname(ent.name) })
    }
  }
  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return result
}

function countFiles(nodes) {
  let n = 0
  for (const node of nodes) {
    if (node.type === 'file') n++
    else if (node.type === 'dir' && node.children) n += countFiles(node.children)
  }
  return n
}

function computeStats(nodes) {
  const stats = { totalFiles: 0, totalDirs: 0, byExt: {}, totalSize: 0 }
  function walk(arr) {
    for (const n of arr) {
      if (n.type === 'file') {
        stats.totalFiles++; stats.totalSize += n.size
        const ext = n.ext || '(no ext)'
        stats.byExt[ext] = (stats.byExt[ext] || 0) + 1
      } else {
        stats.totalDirs++
        if (n.children) walk(n.children)
      }
    }
  }
  walk(nodes)
  return stats
}

function fileTreeApiPlugin() {
  return {
    name: 'file-tree-api',
    configureServer(server) {
      const projectRoot = process.cwd()
      server.middlewares.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
        if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }

        if (req.url === '/api/file-tree' || (req.url && req.url.startsWith('/api/file-tree?'))) {
          try {
            const tree = scanDir(projectRoot, 0, 8)
            const stats = computeStats(tree)
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify({ root: path.basename(projectRoot), tree, stats, scannedAt: Date.now() }))
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: e.message }))
          }
          return
        }

        if (req.url && req.url.startsWith('/api/file')) {
          const url = new URL(req.url, 'http://localhost')
          const rel = url.searchParams.get('path')
          if (!rel) { res.statusCode = 400; res.end('missing path'); return }
          const full = path.resolve(projectRoot, rel)
          if (!full.startsWith(projectRoot)) {
            res.statusCode = 403; res.end('forbidden'); return
          }
          try {
            const stat = fs.statSync(full)
            if (!stat.isFile()) { res.statusCode = 404; res.end('not a file'); return }
            const content = fs.readFileSync(full, 'utf-8')
            const lines = content.split('\n')
            const preview = lines.slice(0, 200).join('\n')
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({
              path: rel.replace(/\\/g, '/'),
              size: stat.size, lines: lines.length,
              mtime: stat.mtimeMs, preview, truncated: lines.length > 200
            }))
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: e.message }))
          }
          return
        }

        next()
      })
    }
  }
}

export default defineConfig({
  base: '/chongzhen-game/',
  plugins: [
    react({
      // 生产环境使用自动 JSX 运行时
      jsxRuntime: 'automatic',
    }),
    fileTreeApiPlugin()
  ],
  build: {
    target: 'es2022',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
        pure_funcs: ['console.log', 'console.warn', 'console.info'],
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    // 禁用 CSS 代码分割：避免 GitHub Pages 缓存不一致时动态预加载 CSS 失败
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
          // 游戏数据分片：按年份/类型拆包，路由级按需加载
          // 历史事件按年份拆分，避免单 chunk 过大并提升缓存命中率
          const historicalYearMatch = id.match(/\/src\/data\/events\/historical\/(\d{4})[^/]*\.ts$/)
          if (historicalYearMatch) {
            return `events-historical-${historicalYearMatch[1]}`
          }
          if (id.includes('/src/data/events/historical/')) {
            return 'events-historical-misc'
          }
          // 过渡事件按年份拆分（文本量最大，单 chunk 曾达 600KB+）
          const transitionYearMatch = id.match(/\/src\/data\/events\/transition\/(\d{4})[^/]*\.ts$/)
          if (transitionYearMatch) {
            return `events-transition-${transitionYearMatch[1]}`
          }
          if (id.includes('/src/data/events/transition/')) {
            return 'events-transition-misc'
          }
          // 支线事件按类型拆分
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
          // 服务层独立 chunk，避免功能 chunk 与 UI chunk 循环引用
          if (id.includes('/src/services/')) {
            return 'services'
          }
          // AI / 图片功能独立 chunk（仅组件，服务已拆出）
          if (id.includes('/src/components/AIAdvisor')) {
            return 'feature-ai'
          }
          if (id.includes('/src/components/ImageGenerator')) {
            return 'feature-image'
          }
          // UI 组件库
          if (id.includes('/src/components/')) {
            return 'ui-components'
          }
          // 工具/类型
          if (id.includes('/src/utils/') || id.includes('/src/types/')) {
            return 'utils-types'
          }
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || ''
          if (info.endsWith('.css')) return 'assets/styles/[name]-[hash][extname]'
          if (info.endsWith('.mp3') || info.endsWith('.ogg') || info.endsWith('.wav')) return 'assets/media/[name]-[hash][extname]'
          if (/\.(webp|png|jpg|jpeg|gif|svg)$/.test(info)) return 'assets/images/[name]-[hash][extname]'
          if (/\.(woff2?|ttf|otf|eot)$/.test(info)) return 'assets/fonts/[name]-[hash][extname]'
          return 'assets/[name]-[hash][extname]'
        },
      },
    },
    // 启用构建缓存
    reportCompressedSize: false,
  },
  server: {
    port: 5173,
    strictPort: true,
    open: false,
    cors: true,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  // 路径别名，简化深层导入
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@data': path.resolve(__dirname, './src/data'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
})
