/**
 * ============================================================================
 *  preload.cjs —— contextBridge 白名单（崇祯 · 宦海浮沉模拟器 桌面版）
 * ============================================================================
 *
 *  【安全契约】
 *  渲染进程拿到的**只有** window.chongzhenDesktop 这一个对象。这里不暴露：
 *    - ipcRenderer（否则等于把任意通道交给页面脚本）
 *    - require / process / Buffer 等任何 Node 原语
 *    - 任何可以读取任意路径的文件 API
 *
 *  所有参数都在本文件里先做类型与格式校验，再转发给主进程；主进程侧还有
 *  第二道校验（见 main.cjs 的 sanitizeSaveFileName）。两层校验是有意为之的
 *  冗余 —— preload 可能被绕过，主进程才是真正的信任边界。
 *
 *  另外：webPreferences.sandbox = true 时，preload 运行在沙箱化的上下文里，
 *  只能用 electron 提供的 ipcRenderer / contextBridge 等有限 API，不能用
 *  fs / path 等 Node 模块 —— 这正是我们需要的。
 * ============================================================================
 */

'use strict'

const { contextBridge, ipcRenderer } = require('electron')

/* ==========================================================================
 *  IPC 通道名（必须与 main.cjs 里的 CHANNELS 完全一致）
 * ========================================================================== */
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

/* ==========================================================================
 *  参数校验小工具
 *  原则：校验不过就**直接返回一个安全的默认值**，不发 IPC。
 * ========================================================================== */

/**
 * 成就 API Name：允许游戏内部 id（小写蛇形）或 Steam API Name（大写蛇形）。
 * @param {unknown} value
 * @returns {string|null}
 */
function asAchievementKey(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.length > 128) return null
  return /^[A-Za-z0-9_]+$/.test(trimmed) ? trimmed : null
}

/**
 * 文件名：只允许字母数字、点、下划线、短横线，且不允许路径分隔符。
 * @param {unknown} value
 * @returns {string|null}
 */
function asFileName(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.length > 128) return null
  if (trimmed === '.' || trimmed === '..') return null
  return /^[A-Za-z0-9._-]+$/.test(trimmed) ? trimmed : null
}

/**
 * 文件内容：必须是字符串。限制 32MB，避免一次性塞爆 IPC（存档远小于此）。
 * @param {unknown} value
 * @returns {string|null}
 */
function asFileContents(value) {
  if (typeof value !== 'string') return null
  // 32 * 1024 * 1024
  if (value.length > 33554432) return null
  return value
}

/**
 * 统一的 IPC 调用包装：把任何异常转成安全的默认值。
 * 渲染进程永远不该看到 rejected promise —— 那会污染游戏逻辑。
 * @template T
 * @param {string} channel
 * @param {unknown[]} args
 * @param {T} fallback
 * @returns {Promise<T>}
 */
async function safeInvoke(channel, args, fallback) {
  try {
    const result = await ipcRenderer.invoke(channel, ...args)
    return result === undefined || result === null ? fallback : result
  } catch (err) {
    // 只打日志，不向渲染进程抛出
    console.error('[preload] IPC 调用失败 (' + channel + ')：', err)
    return fallback
  }
}

/* ==========================================================================
 *  Steam 子对象
 * ========================================================================== */

const steamApi = {
  /**
   * 是否真的连上了 Steam 客户端。
   * 注意这是**启动时的快照**：初始化为 mock 时为 false 且不会再变。
   * 想拿实时状态请用下面的 getStatus()（如果调用方需要，可自行扩展）。
   */
  available: false,

  /** Steam 昵称；未连接时为 null */
  playerName: null,

  /**
   * 解锁成就。fire-and-forget 友好：永不 reject。
   * @param {string} apiName 游戏内部 id 或 Steam API Name
   * @returns {Promise<boolean>}
   */
  async unlockAchievement(apiName) {
    const key = asAchievementKey(apiName)
    if (key === null) return false
    return safeInvoke(CHANNELS.steamUnlock, [key], false)
  },

  /**
   * @param {string} apiName
   * @returns {Promise<boolean>}
   */
  async isAchievementUnlocked(apiName) {
    const key = asAchievementKey(apiName)
    if (key === null) return false
    return safeInvoke(CHANNELS.steamIsUnlocked, [key], false)
  },

  /**
   * 写入 Steam Cloud 文件。
   * @param {string} name
   * @param {string} contents
   * @returns {Promise<boolean>}
   */
  async setCloudFile(name, contents) {
    const safeName = asFileName(name)
    const safeContents = asFileContents(contents)
    if (safeName === null || safeContents === null) return false
    return safeInvoke(CHANNELS.steamSetCloud, [safeName, safeContents], false)
  },

  /**
   * @param {string} name
   * @returns {Promise<string|null>}
   */
  async getCloudFile(name) {
    const safeName = asFileName(name)
    if (safeName === null) return null
    const result = await safeInvoke(CHANNELS.steamGetCloud, [safeName], null)
    return typeof result === 'string' ? result : null
  },

  /**
   * @returns {Promise<string[]>}
   */
  async listCloudFiles() {
    const result = await safeInvoke(CHANNELS.steamListCloud, [], [])
    return Array.isArray(result) ? result.filter((item) => typeof item === 'string') : []
  }
}

/* ==========================================================================
 *  组装对外的唯一对象
 * ========================================================================== */

const bridge = {
  /** 桌面端标记：网页版拿不到这个对象，所以游戏用 !!window.chongzhenDesktop 判断环境 */
  isDesktop: true,

  /** 'win32' | 'darwin' | 'linux' 等 */
  platform: process.platform,

  steam: steamApi,

  /**
   * 把存档写到 <userData>/saves/<filename>。
   * 这是把游戏存档从 localStorage 迁出来、进而交给 Steam Cloud 的通道。
   * @param {string} filename
   * @param {string} contents
   * @returns {Promise<boolean>}
   */
  async saveToDisk(filename, contents) {
    const safeName = asFileName(filename)
    const safeContents = asFileContents(contents)
    if (safeName === null || safeContents === null) return false
    return safeInvoke(CHANNELS.saveToDisk, [safeName, safeContents], false)
  },

  /**
   * 从磁盘读回存档；不存在或读取失败返回 null。
   * @param {string} filename
   * @returns {Promise<string|null>}
   */
  async loadFromDisk(filename) {
    const safeName = asFileName(filename)
    if (safeName === null) return null
    const result = await safeInvoke(CHANNELS.loadFromDisk, [safeName], null)
    return typeof result === 'string' ? result : null
  },

  /** 退出应用 */
  async quit() {
    return safeInvoke(CHANNELS.quit, [], false)
  },

  /** 切换全屏；返回切换后的全屏状态 */
  async toggleFullscreen() {
    return safeInvoke(CHANNELS.toggleFullscreen, [], false)
  }
}

/* ==========================================================================
 *  初始化：读一次 Steam 状态填进 bridge.steam，然后一次性暴露 bridge。
 *  contextBridge.exposeInMainWorld 只能调用一次同名的 key，所以先 await
 *  再 expose，确保 available / playerName 在页面脚本执行前就已是正确值。
 * ========================================================================== */

async function bootstrap() {
  try {
    const status = await ipcRenderer.invoke(CHANNELS.steamStatus)
    if (status && typeof status === 'object') {
      steamApi.available = status.available === true
      steamApi.playerName = typeof status.playerName === 'string' ? status.playerName : null
    }
  } catch (err) {
    // 拿不到状态就保持 false —— 游戏照常运行
    console.error('[preload] 读取 Steam 状态失败：', err)
  }

  contextBridge.exposeInMainWorld('chongzhenDesktop', bridge)
  console.log(
    '[preload] chongzhenDesktop 已就绪 | platform=' + bridge.platform +
    ' | steam.available=' + steamApi.available +
    ' | playerName=' + String(steamApi.playerName)
  )
}

bootstrap()
