/**
 * ============================================================================
 *  main.cjs —— Electron 主进程（崇祯 · 宦海浮沉模拟器 桌面版）
 * ============================================================================
 *
 *  设计要点：
 *   1. 安全性优先：contextIsolation=true / nodeIntegration=false / sandbox=true，
 *      渲染进程只能通过 preload.cjs 暴露的白名单 API 与主进程通信。
 *   2. 有真实 CSP：file:// 页面本身带不了响应头，所以用
 *      session.defaultSession.webRequest.onHeadersReceived 强行注入 CSP。
 *   3. 导航封锁：禁止渲染进程自己跳转到站外，window.open 一律交给系统浏览器。
 *   4. Steam 严格可选：steam.cjs 永不抛异常，Steam 挂了游戏照常启动。
 * ============================================================================
 */

'use strict'

const { app, BrowserWindow, Menu, shell, session, globalShortcut, ipcMain, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const steam = require('./steam.cjs')

/* ==========================================================================
 *  常量与运行模式
 * ========================================================================== */

const APP_NAME = '崇祯 · 宦海浮沉'
const WINDOW_BACKGROUND = '#0A0807'

/**
 * 是否开发模式。
 * 判定顺序：--dev 命令行参数 > NODE_ENV !== 'production'。
 * 打包后的应用 NODE_ENV 通常为空，所以 packaged 判定兜底为生产。
 */
const IS_DEV = process.argv.includes('--dev') || process.env.NODE_ENV === 'development'
const IS_PACKAGED = app.isPackaged

/**
 * CSP（内容安全策略）。
 * 为什么必须用 onHeadersReceived 注入：打包后页面是 file:// 加载的，
 * file:// 协议没有 HTTP 响应头，<meta http-equiv> 又容易被早期脚本绕过，
 * 因此只能在主进程的响应头阶段补上。
 *
 * 关于 style-src 的 'unsafe-inline'：**这是必需的，不能去掉**。
 *   - 应用在 index.html 里内联了首屏关键 CSS（避免白屏闪烁）；
 *   - React 组件大量使用 style={{...}} 内联样式属性，浏览器按 CSP 规范
 *     把 style 属性也算作 inline style，去掉 'unsafe-inline' 会直接让界面错版。
 * 相比 style，script-src 保持严格的 'self'（无 unsafe-inline / unsafe-eval），
 * 这才是 XSS 防护里真正关键的那一项。
 */
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  // connect-src 需要 https: —— 可选的 AI 顾问 / 配图功能会直连外部
  // OpenAI 兼容端点（见 src/services/aiService.ts），这是纯前端应用，
  // 请求直接从渲染进程发出，不需要（也没有）自建后端代理。
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'"
].join('; ')

/** @type {BrowserWindow|null} */
let mainWindow = null
/** Steam 是否已经初始化过（避免重复 init） */
let steamInitialised = false

/* ==========================================================================
 *  web 构建产物的定位
 *  ------------------------------------------------------------------------
 *  开发（未打包）：仓库根的 dist/index.html，即 desktop/../dist/index.html
 *  打包后：electron-builder 通过 extraResources 把 ../dist 复制到
 *          <resources>/web，于是 index.html 在 <resources>/web/index.html，
 *          而 <resources> 就是 process.resourcesPath。
 *  两者必须与 electron-builder.yml 里的 extraResources 配置保持一致。
 * ========================================================================== */

/**
 * @returns {string} 渲染进程要加载的 index.html 绝对路径
 */
function resolveAppEntry() {
  if (IS_PACKAGED) {
    return path.join(process.resourcesPath, 'web', 'index.html')
  }
  return path.join(__dirname, '..', 'dist', 'index.html')
}

/**
 * 启动前检查 web 产物是否存在，缺失时给出**可操作**的报错，而不是白屏。
 * @param {string} entry
 */
function assertWebBuildExists(entry) {
  if (fs.existsSync(entry)) return
  const hint = IS_PACKAGED
    ? '打包产物里缺少 web 资源。请确认 electron-builder.yml 的 extraResources 指向 ../dist，并且打包前已在仓库根执行过 npm run build。'
    : '未找到仓库根的 dist/index.html。请先在仓库根目录执行：npm run build'
  // 用 dialog 会阻塞，这里用控制台 + 一个极简的错误页更稳妥
  console.error('[main] 找不到 web 构建产物：' + entry)
  console.error('[main] ' + hint)
}

/* ==========================================================================
 *  Steam AppID 的便利读取
 *  ------------------------------------------------------------------------
 *  真正的机制：steam_appid.txt 必须放在**可执行文件旁边**（Steam 发行版里
 *  通常由 Steam 自己注入 AppID，所以这个文件不打进 depot）。
 *  这里额外读一次，只是为了开发期的便利：把 desktop/steam/steam_appid.txt
 *  里的数字塞进 process.env.SteamAppId，这样 `npm run dev` 就能连上 Steam。
 *  steamworks.js 的 init(appId) 在 appId 为 undefined 时也会自己去搜
 *  steam_appid.txt，两条路互为兜底。
 * ========================================================================== */

/**
 * @returns {string|null} 读到的 AppID 字符串
 */
function applyDevAppIdConvenience() {
  // 1) 环境变量已经设了就尊重它
  if (typeof process.env.SteamAppId === 'string' && process.env.SteamAppId.trim() !== '') {
    return process.env.SteamAppId.trim()
  }

  // 2) 依次找几个可能的位置
  const candidates = [
    // 打包后：exe 同级目录（Steam 实际要求的位置）
    path.join(path.dirname(app.getPath('exe')), 'steam_appid.txt'),
    // 开发期：仓库内的脚手架文件
    path.join(__dirname, 'steam', 'steam_appid.txt'),
    path.join(process.cwd(), 'steam_appid.txt')
  ]
  for (const candidate of candidates) {
    const appId = steam.readAppIdFile(candidate)
    if (appId !== null) {
      process.env.SteamAppId = appId
      console.log('[main] 从 ' + candidate + ' 读到 SteamAppId=' + appId)
      return appId
    }
  }
  return null
}

/* ==========================================================================
 *  Steam 初始化（必须永远不影响游戏启动）
 * ========================================================================== */

function initialiseSteam() {
  if (steamInitialised) return
  steamInitialised = true
  try {
    applyDevAppIdConvenience()
    const status = steam.initSteam({
      appId: process.env.SteamAppId || null,
      userDataPath: app.getPath('userData')
    })
    console.log('[main] Steam 状态：' + JSON.stringify(status))
    if (status.driver === 'mock') {
      console.log('[main] 使用 MOCK 驱动 —— 游戏功能不受影响，成就只写入本地 mock-steam/ 目录。')
    }
  } catch (err) {
    // 理论上 steam.cjs 不会抛，但这里再兜一层：Steam 绝不允许阻断启动
    console.error('[main] Steam 初始化出现意外异常（已忽略，游戏继续启动）：', err)
  }
}

/* ==========================================================================
 *  安全加固
 * ========================================================================== */

/**
 * 注入 CSP。file:// 响应也会走到 onHeadersReceived，因此打包后同样生效。
 */
function installCsp() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP_DIRECTIVES]
      }
    })
  })
}

/**
 * 判断一个 URL 是否允许用系统浏览器打开。
 * 只放行 http / https，其余（file:、javascript:、自定义协议等）一律拒绝。
 * @param {string} url
 * @returns {boolean}
 */
function isSafeExternalUrl(url) {
  if (typeof url !== 'string' || url === '') return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * 把内部页面路径与外部链接区分开。
 * @param {string} url
 * @returns {boolean} 是否属于应用自身页面
 */
function isInternalUrl(url) {
  if (typeof url !== 'string' || url === '') return false
  return url.startsWith('file://') || url.startsWith('devtools://') || url.startsWith('about:')
}

/**
 * 导航封锁 + window.open 封锁。
 * 任何试图离开应用的导航都被取消；http(s) 交给系统浏览器，其余直接丢弃。
 * @param {Electron.WebContents} webContents
 */
function applyNavigationHardening(webContents) {
  // 1) 拦截页面内导航
  webContents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) return
    event.preventDefault()
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url).catch((err) => {
        console.error('[main] openExternal 失败：', err)
      })
    } else {
      console.warn('[main] 已阻止一次非 http(s) 导航：' + url)
    }
  })

  // 2) 拦截 window.open / target=_blank
  webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url).catch((err) => {
        console.error('[main] openExternal 失败：', err)
      })
    } else {
      console.warn('[main] 已阻止一次非 http(s) 弹窗：' + url)
    }
    return { action: 'deny' }
  })

  // 3) 拦截 webview 附加（本应用不需要 webview）
  webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })

  // 4) 拒绝所有权限请求（摄像头 / 麦克风 / 地理位置 / 通知等本应用都不需要）
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false)
  })
}

/* ==========================================================================
 *  崩溃防护
 * ==========================================================================
 *  为什么必须加：
 *
 *  Electron 的**主进程**里任何未捕获的异常或未处理的 Promise 拒绝，
 *  都会让整个应用立即退出 —— 没有栈、没有提示、窗口直接消失。
 *  玩家看到的就��"闪退"，而且往往复现不了、也报不了错。
 * 这在一款要商业发行的游戏里是不可接受的。
 *
 * 高发的几个来源（本项目都真实存在）：
 *   · steamworks.js 是**原生模块**。Steam 客户端没启动 / 中途退出 /
 *     depot 更新时，它的调用可能同步抛；
 *   · 30Hz 的回调泵（runCallbacks）由定时器驱动，抛了就是 uncaughtException；
 *   · IPC handler 里任何一处漏了 try/catch；
 *   · 存档读写（磁盘满、权限、文件被占用）。
 *
 * 渲染进程崩溃（最常见原因是内存耗尽，其次是 GPU 进程异常）则是另一回事：
 * 主进程不会死，但窗口会变白/空白。原先没有 render-process-gone 监听，
 * 玩家只看到一个死窗口，既不能自动恢复也不知道发生了什么。
 * ========================================================================== */

/** 主进程崩溃日志：同时写文件，避免玩家报问题时日志已经随窗口一起没了 */
function logFatal(scope, err) {
  const detail = err && err.stack ? err.stack : String(err)
  console.error(`[main][${scope}] 未捕获异常：`, detail)
  try {
    const dir = app.getPath('logs')
    fs.mkdirSync(dir, { recursive: true })
    fs.appendFileSync(
      path.join(dir, 'main.log'),
      `\n===== ${new Date().toISOString()} [${scope}] =====\n${detail}\n`
    )
  } catch {
    // 日志写不了就算了，不能因为写日志再抛一次
  }
}

// 注意：uncaughtException 处理器必须自己保证不再抛，
// 否则会变成"处理异常时又异常"的无限循环。
process.on('uncaughtException', (err) => {
  logFatal('uncaughtException', err)
  // 不退出。对游戏来说，丢一次功能远好过整个应用消失。
  // 若确实已经无法恢复（例如窗口都没了），下面的 before-quit 会收尾。
})

process.on('unhandledRejection', (reason) => {
  logFatal('unhandledRejection', reason)
})

/**
 * 渲染进程崩溃 / 卡死的兜底。
 * @param {Electron.BrowserWindow} win
 */
function applyCrashGuards(win) {
  const wc = win.webContents

  wc.on('render-process-gone', (_event, details) => {
    // reason: 'clean-exit' | 'abnormal-exit' | 'killed' | 'crashed' | 'oom' | 'launch-failed' | 'integrity-failure'
    if (details.reason === 'clean-exit') return
    console.error(
      `[main] 渲染进程异常退出：reason=${details.reason} exitCode=${details.exitCode}`
    )
    logFatal('render-process-gone', new Error(`reason=${details.reason} exitCode=${details.exitCode}`))

    if (mainWindow === null || mainWindow.isDestroyed()) return
    const message =
      details.reason === 'oom'
        ? '游戏内存占用过高，页面已停止响应。建议关闭其他程序后重试。'
        : '游戏页面意外停止响应。'
    // 不用 dialog 阻塞（此时渲染进程已死，模态框可能也显示不出来），
    // 改为加载一个纯 HTML 的错误页 —— 它只依赖主进程，不依赖渲染进程。
    wc.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(
          `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">` +
            `<title>游戏已停止响应</title><style>` +
            `body{background:#0A0807;color:#F5E6C8;font-family:'Songti SC','SimSun',serif;` +
            `display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}` +
            `h1{color:#C5A55A;font-size:28px;font-weight:600;margin:0 0 16px}` +
            `p{opacity:.75;line-height:1.9;margin:0 0 28px}` +
            `button{font:inherit;font-size:16px;padding:10px 28px;cursor:pointer;` +
            `color:#1a1410;background:#C5A55A;border:0;border-radius:4px}</style></head><body>` +
            `<div><h1>${message}</h1>` +
            `<p>进度已保存在本地，重新载入即可继续。<br>若反复出现，可在日志目录查看 main.log。</p>` +
            `<button onclick="location.reload()">重新载入</button></div></body></html>`
        )
    )
  })

  wc.on('unresponsive', () => {
    console.warn('[main] 渲染进程无响应（超过阈值未响应）')
  })
  wc.on('responsive', () => {
    console.warn('[main] 渲染进程已恢复响应')
  })

  // 渲染进程自身的未捕获异常不会冒泡到主进程，但可以在这里留痕
  wc.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 3) {
      // level 3 = error
      try {
        const dir = app.getPath('logs')
        fs.mkdirSync(dir, { recursive: true })
        fs.appendFileSync(
          path.join(dir, 'renderer.log'),
          `[${new Date().toISOString()}] ${message} (${sourceId}:${line})\n`
        )
      } catch {
        // ignore
      }
    }
  })
}

/* ==========================================================================
 *  开发期快捷键
 * ========================================================================== */

/**
 * 注册 F11 全屏切换，以及开发模式下的 DevTools / 重载加速键。
 * 生产构建里不注册 DevTools 快捷键。
 */
function registerShortcuts() {
  // F11 全屏：所有模式都需要
  globalShortcut.register('F11', () => {
    if (mainWindow === null || mainWindow.isDestroyed()) return
    mainWindow.setFullScreen(!mainWindow.isFullScreen())
  })

  if (!IS_DEV) return

  // 开发期：Ctrl+Shift+I / F12 打开 DevTools，Ctrl+R 重载
  const devAccelerators = [
    ['CommandOrControl+Shift+I', () => mainWindow && mainWindow.webContents.openDevTools({ mode: 'detach' })],
    ['F12', () => mainWindow && mainWindow.webContents.openDevTools({ mode: 'detach' })],
    ['CommandOrControl+R', () => mainWindow && mainWindow.webContents.reload()]
  ]
  for (const [accelerator, handler] of devAccelerators) {
    globalShortcut.register(accelerator, handler)
  }
}

/* ==========================================================================
 *  窗口创建
 * ========================================================================== */

function createWindow() {
  const entry = resolveAppEntry()
  assertWebBuildExists(entry)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: WINDOW_BACKGROUND,
    // 先不显示，等 ready-to-show 再显示，避免启动白闪
    show: false,
    autoHideMenuBar: true,
    title: APP_NAME,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  })

  // 生产环境彻底移除默认菜单（File/Edit/View/... 那一套对游戏毫无意义）
  if (!IS_DEV) {
    Menu.setApplicationMenu(null)
  }

  mainWindow.once('ready-to-show', () => {
    if (mainWindow === null || mainWindow.isDestroyed()) return
    mainWindow.show()
  })

  applyNavigationHardening(mainWindow.webContents)
  applyCrashGuards(mainWindow)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 加载失败时打日志（例如 dev 下忘了 build）
  mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    console.error(`[main] 页面加载失败 (${errorCode} ${errorDescription})：${validatedURL}`)
  })

  mainWindow.loadFile(entry).catch((err) => {
    console.error('[main] loadFile 失败：', err)
  })

  return mainWindow
}

/* ==========================================================================
 *  IPC —— 供 preload.cjs 的 contextBridge 调用
 *  约定：全部通过 ipcRenderer.invoke，全部返回结构化结果，永远不抛到渲染进程。
 * ========================================================================== */

/** IPC 通道名集中定义，避免主进程 / preload 两边写错字符串 */
const CHANNELS = {
  steamStatus: 'chongzhen:steam:status',
  steamUnlock: 'chongzhen:steam:achievement:unlock',
  steamIsUnlocked: 'chongzhen:steam:achievement:is-unlocked',
  steamSetCloud: 'chongzhen:steam:cloud:set',
  steamGetCloud: 'chongzhen:steam:cloud:get',
  steamListCloud: 'chongzhen:steam:cloud:list',
  saveToDisk: 'chongzhen:save:write',
  loadFromDisk: 'chongzhen:save:read',
  quit: 'chongzhen:app:quit',
  toggleFullscreen: 'chongzhen:window:toggle-fullscreen'
}

/** 存档文件名白名单校验（防路径穿越） */
function sanitizeSaveFileName(name) {
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  if (trimmed === '' || trimmed.length > 128) return null
  if (/[\\/]/.test(trimmed)) return null
  if (trimmed === '.' || trimmed === '..') return null
  if (/[\u0000-\u001f]/.test(trimmed)) return null
  // 只允许字母数字、点、下划线、短横线
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return null
  return trimmed
}

/** @returns {string} 存档目录 <userData>/saves */
function saveDir() {
  return path.join(app.getPath('userData'), 'saves')
}

/**
 * 注册所有 IPC handler。必须在 createWindow 之前调用。
 */
function registerIpcHandlers() {
  // ---- Steam ----
  ipcMain.handle(CHANNELS.steamStatus, () => steam.getStatus())

  ipcMain.handle(CHANNELS.steamUnlock, (_event, apiName) => {
    if (typeof apiName !== 'string' || apiName === '') return false
    try {
      return steam.unlockAchievement(apiName) === true
    } catch (err) {
      console.error('[main] 成就解锁异常：', err)
      return false
    }
  })

  ipcMain.handle(CHANNELS.steamIsUnlocked, (_event, apiName) => {
    if (typeof apiName !== 'string' || apiName === '') return false
    try {
      return steam.isAchievementUnlocked(apiName) === true
    } catch (err) {
      console.error('[main] 成就查询异常：', err)
      return false
    }
  })

  ipcMain.handle(CHANNELS.steamSetCloud, (_event, name, contents) => {
    if (typeof name !== 'string' || typeof contents !== 'string') return false
    try {
      return steam.setCloudFile(name, contents) === true
    } catch (err) {
      console.error('[main] 云存档写入异常：', err)
      return false
    }
  })

  ipcMain.handle(CHANNELS.steamGetCloud, (_event, name) => {
    if (typeof name !== 'string' || name === '') return null
    try {
      return steam.getCloudFile(name)
    } catch (err) {
      console.error('[main] 云存档读取异常：', err)
      return null
    }
  })

  ipcMain.handle(CHANNELS.steamListCloud, () => {
    try {
      return steam.listCloudFiles()
    } catch (err) {
      console.error('[main] 云存档列表异常：', err)
      return []
    }
  })

  // ---- 本地磁盘存档（userData/saves）----
  ipcMain.handle(CHANNELS.saveToDisk, (_event, filename, contents) => {
    const safe = sanitizeSaveFileName(filename)
    if (safe === null) return false
    if (typeof contents !== 'string') return false
    try {
      fs.mkdirSync(saveDir(), { recursive: true })
      // 先写临时文件再 rename，避免写一半被强杀导致存档损坏
      const target = path.join(saveDir(), safe)
      const temp = target + '.tmp'
      fs.writeFileSync(temp, contents, 'utf8')
      fs.renameSync(temp, target)
      return true
    } catch (err) {
      console.error('[main] 存档写入失败：', err)
      return false
    }
  })

  ipcMain.handle(CHANNELS.loadFromDisk, (_event, filename) => {
    const safe = sanitizeSaveFileName(filename)
    if (safe === null) return null
    try {
      const target = path.join(saveDir(), safe)
      if (!fs.existsSync(target)) return null
      return fs.readFileSync(target, 'utf8')
    } catch (err) {
      console.error('[main] 存档读取失败：', err)
      return null
    }
  })

  // ---- 应用 / 窗口 ----
  ipcMain.handle(CHANNELS.quit, () => {
    app.quit()
    return true
  })

  ipcMain.handle(CHANNELS.toggleFullscreen, () => {
    if (mainWindow === null || mainWindow.isDestroyed()) return false
    mainWindow.setFullScreen(!mainWindow.isFullScreen())
    return mainWindow.isFullScreen()
  })
}

/* ==========================================================================
 *  应用生命周期
 * ========================================================================== */

// 单实例锁：避免玩家双击两次开出两个游戏（两个进程抢同一份存档会互相覆盖）
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow === null || mainWindow.isDestroyed()) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    installCsp()
    initialiseSteam()
    registerIpcHandlers()
    registerShortcuts()
    createWindow()

    // macOS：点 Dock 图标时若无窗口则重建
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  }).catch((err) => {
    // 之前这里只 console.error 一下就结束 —— 结果是"进程活着但一个窗口都没有"，
    // 玩家看到的就是应用闪了一下就没了，而且没有任何可读的错误信息。
    // 这在商业发行里是最糟的失败形态：既复现不了也报不了错。
    console.error('[main] 启动流程异常：', err)
    try {
      dialog.showErrorBox(
        '游戏启动失败',
        '初始化时发生错误，无法创建窗口。\n\n' +
          (err && err.stack ? err.stack : String(err)) +
          '\n\n请把以上信息反馈给开发者。'
      )
    } catch {
      // 连 dialog 都失败就只能靠日志了
    }
    app.exit(1)
  })
}

app.on('window-all-closed', () => {
  // macOS 的习惯是关掉窗口仍留在 Dock 里；其他平台直接退出
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('before-quit', () => {
  try {
    steam.shutdown()
  } catch (err) {
    console.error('[main] Steam 关闭异常（已忽略）：', err)
  }
})
