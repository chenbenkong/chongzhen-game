import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'node:http'

// ===== chongzhen-game 文件树 API 独立 server =====
// Vite 的 SPA fallback / 中间件栈对自定义 /api 路由处理不可靠，
// 直接起一个独立 HTTP server 在 5174 端口处理 /api/file-tree 和 /api/file。
// HTML 端 fetch http://localhost:5174/api/file-tree（带 CORS 头）。
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
  plugins: [
    react(),
    fileTreeApiPlugin()
  ],
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
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
})
