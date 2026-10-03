/**
 * desktopBridge —— 桌面（Electron / Steam）能力接入点
 * ============================================================================
 *
 * 【这个文件为什么必须"什么错都不抛"】
 * 同一份前端代码要同时跑在三种环境里：
 *   1. 浏览器（GitHub Pages / vite preview）—— 根本没有 desktopBridge
 *   2. Electron 桌面版，Steam 正常
 *   3. Electron 桌面版，Steam 挂了 / 是 mock 驱动
 * 所以这里所有的函数在"没有桌面环境"时都必须安静地降级成 no-op，
 * 绝不能因为桌面 API 不存在而让网页版也一起崩。
 *
 * 【本文件不 import 任何 electron 相关包】
 * 渲染进程只知道 window.chongzhenDesktop 这个由 preload 注入的对象；
 * 类型是本地声明的（见下方 declare global），不依赖 electron 的类型包。
 *
 * ⚠️ 重要说明：本文件目前是一个**未被游戏调用的接入点**。
 *    现有的存档与成就逻辑仍然完全走 localStorage / 内存态。
 *    把 useGameEngine 等模块真正接到这里，是**尚未开始的后续任务**，
 *    目的仅仅是把"桌面能力"这一层准备好且可被类型检查覆盖。
 */

/* ==========================================================================
 *  全局类型声明
 * ========================================================================== */

/** 云存档 / 本地磁盘存档的通用返回值约定 [是否成功, 错误信息] —— 见下方实现 */
export interface DesktopSteamApi {
  /** 是否真的连上了 Steam 客户端。mock 驱动或未连接时为 false */
  available: boolean
  /** Steam 昵称；未连接时为 null */
  playerName: string | null
  /**
   * 解锁成就。参数可以是游戏内部成就 id（如 'from_ninth'）
   * 或 Steam 后台的 API Name（如 'FROM_NINTH'）。
   * @returns 是否成功下发（永不 reject）
   */
  unlockAchievement(apiName: string): Promise<boolean>
  /** 查询成就是否已解锁（永不 reject） */
  isAchievementUnlocked(apiName: string): Promise<boolean>
  /**
   * 写入 Steam Cloud 文件。
   * ⚠️ 需要先在 Steamworks 后台为该 App 启用 Steam Cloud 并设置配额，
   *    否则会稳定返回 false（这不是错误，只是没进云）。
   */
  setCloudFile(name: string, contents: string): Promise<boolean>
  /** 读取 Steam Cloud 文件；不存在或不可用时返回 null */
  getCloudFile(name: string): Promise<string | null>
  /** 列出云端文件名；不可用时返回空数组 */
  listCloudFiles(): Promise<string[]>
}

/** preload.cjs 通过 contextBridge 暴露的全部能力 */
export interface ChongzhenDesktopBridge {
  /** 桌面端标记 —— 这是判断"是否运行在桌面壳里"的唯一权威依据 */
  isDesktop: true
  /** process.platform 的值：'win32' | 'darwin' | 'linux' ... */
  platform: string
  steam: DesktopSteamApi
  /**
   * 把存档写到 `<userData>/saves/<filename>`。
   * 这是把游戏存档从 localStorage 迁出去的第一步。
   * @returns 是否写入成功
   */
  saveToDisk(filename: string, contents: string): Promise<boolean>
  /** 从磁盘读存档；不存在或失败返回 null */
  loadFromDisk(filename: string): Promise<string | null>
  /** 退出应用 */
  quit(): Promise<boolean>
  /** 切换全屏，返回切换后的全屏状态 */
  toggleFullscreen(): Promise<boolean>
}

declare global {
  interface Window {
    /**
     * 由 desktop/preload.cjs 注入。**只存在于 Electron 桌面版**，
     * 网页版访问它只会得到 undefined。
     */
    readonly chongzhenDesktop?: ChongzhenDesktopBridge
  }
}

/* ==========================================================================
 *  环境探测
 * ========================================================================== */

/**
 * 当前是否运行在桌面壳（Electron）里。
 *
 * 实现说明：用 typeof window 兜底是为了让本模块在 SSR / 测试环境（node）里
 * 被 import 时也不炸。判断依据只看有没有注入对象，不看 userAgent。
 *
 * @returns {boolean}
 */
export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false
  const bridge = window.chongzhenDesktop
  return bridge !== undefined && bridge !== null && bridge.isDesktop === true
}

/**
 * 取桌面桥对象；不在桌面环境时返回 null。
 *
 * 调用方必须自己处理 null —— 这是有意设计的，因为桌面能力永远是"可选增强"，
 * 而不是必需依赖。如果你不需要区分 null 的情况，用下面的包装函数更省事。
 *
 * @returns {ChongzhenDesktopBridge | null}
 */
export function getBridge(): ChongzhenDesktopBridge | null {
  if (typeof window === 'undefined') return null
  const bridge = window.chongzhenDesktop
  if (bridge === undefined || bridge === null) return null
  // 再确认一次标记，防止别的东西往 window 上塞了同名对象
  if (bridge.isDesktop !== true) return null
  return bridge
}

/* ==========================================================================
 *  成就同步
 * ========================================================================== */

/**
 * 把一次成就解锁同步到桌面端（进而到 Steam）。
 *
 * 设计要点：
 *  - **fire-and-forget**：不同步等待，不返回 Promise，调用方不需要 await。
 *    成就解锁是"锦上添花"，绝不能阻塞游戏主循环或事件结算。
 *  - **吞掉所有错误**：包括桥不存在、IPC 失败、Steam 后端没有这个 API Name。
 *    网页版调用它是完全安全的 no-op。
 *  - 参数是**游戏内部成就 id**（`src/types/achievement.ts` 里的 `Achievement.id`），
 *    映射到 Steam API Name 的工作由 desktop/steam.cjs 负责。
 *
 * @param id 游戏内部成就 id，例如 'from_ninth'
 */
export function syncAchievementToDesktop(id: string): void {
  try {
    if (typeof id !== 'string' || id === '') return
    const bridge = getBridge()
    if (bridge === null) return
    // 不 await：故意让它在后台跑完。catch 是为了避免 unhandledrejection。
    void bridge.steam.unlockAchievement(id).catch(() => {
      /* 桌面端说没成功就算了，游戏内成就状态不受影响 */
    })
  } catch {
    // 连 getBridge 都抛异常（例如 window 被冻结）也必须静默
  }
}

/* ==========================================================================
 *  存档导入 / 导出
 *  返回值约定：统一 [ok, errorMessage] 元组，避免 throw 满天飞。
 * ========================================================================== */

/** 操作结果：[是否成功, 失败原因（成功时为 null）] */
export type DesktopIoResult = [ok: boolean, error: string | null]

/**
 * 把一段 JSON 存档文本导出到本地磁盘（`<userData>/saves/<name>`）。
 *
 * 注意：Steam Cloud 与本地磁盘是**两条独立通道**。
 *  - 只想要"换机器不丢档" → 走 `steam.setCloudFile()`
 *  - 只想要"本地备份 / 手工导入导出" → 走 `saveToDisk()`
 *  - 两者都要 → 分别调用，互不影响
 *
 * @param name 文件名，只允许字母数字与 `. _ -`，不含路径分隔符
 * @param json 存档 JSON 文本
 * @returns [是否成功, 失败原因]
 */
export async function exportSaveToDisk(name: string, json: string): Promise<DesktopIoResult> {
  if (typeof name !== 'string' || name === '') {
    return [false, '文件名不能为空']
  }
  if (typeof json !== 'string' || json === '') {
    return [false, '存档内容不能为空']
  }
  const bridge = getBridge()
  if (bridge === null) {
    return [false, '当前不在桌面环境中，无法写入磁盘']
  }
  try {
    const ok = await bridge.saveToDisk(name, json)
    return ok ? [true, null] : [false, '桌面端拒绝写入（文件名非法或磁盘错误）']
  } catch (err) {
    return [false, describeError(err)]
  }
}

/**
 * 从本地磁盘读回一段 JSON 存档文本。
 *
 * 调用方拿到字符串后需要**自己 JSON.parse 并校验结构** ——
 * 本函数不做 schema 校验，因为"什么算合法存档"是游戏侧的知识，
 * 而且不同版本的存档结构可能不同（存档兼容由游戏自己处理）。
 *
 * @param name 文件名
 * @returns [是否成功, 内容或失败原因]
 */
export async function importSaveFromDisk(name: string): Promise<[boolean, string | null]> {
  if (typeof name !== 'string' || name === '') {
    return [false, '文件名不能为空']
  }
  const bridge = getBridge()
  if (bridge === null) {
    return [false, '当前不在桌面环境中，无法从磁盘读取']
  }
  try {
    const contents = await bridge.loadFromDisk(name)
    if (contents === null) {
      return [false, '存档不存在或读取失败']
    }
    return [true, contents]
  } catch (err) {
    return [false, describeError(err)]
  }
}

/* ==========================================================================
 *  Steam Cloud 存档（与本地磁盘并行的另一条通道）
 * ========================================================================== */

/**
 * 把存档同步到 Steam Cloud。
 * @param name 云端文件名，例如 `autosave.json`
 * @param json 存档 JSON 文本
 * @returns [是否成功, 失败原因]
 */
export async function syncSaveToCloud(name: string, json: string): Promise<DesktopIoResult> {
  if (typeof name !== 'string' || name === '') {
    return [false, '文件名不能为空']
  }
  if (typeof json !== 'string' || json === '') {
    return [false, '存档内容不能为空']
  }
  const bridge = getBridge()
  if (bridge === null) {
    return [false, '当前不在桌面环境中']
  }
  if (!bridge.steam.available) {
    return [false, 'Steam 不可用（未连接或使用 mock 驱动）']
  }
  try {
    const ok = await bridge.steam.setCloudFile(name, json)
    return ok ? [true, null] : [false, 'Steam Cloud 写入被拒绝（后台可能未启用云存档或配额不足）']
  } catch (err) {
    return [false, describeError(err)]
  }
}

/**
 * 从 Steam Cloud 读回存档。
 * @param name 云端文件名
 * @returns [是否成功, 内容或失败原因]
 */
export async function loadSaveFromCloud(name: string): Promise<[boolean, string | null]> {
  if (typeof name !== 'string' || name === '') {
    return [false, '文件名不能为空']
  }
  const bridge = getBridge()
  if (bridge === null) {
    return [false, '当前不在桌面环境中']
  }
  if (!bridge.steam.available) {
    return [false, 'Steam 不可用（未连接或使用 mock 驱动）']
  }
  try {
    const contents = await bridge.steam.getCloudFile(name)
    if (contents === null) {
      return [false, '云端没有这个文件']
    }
    return [true, contents]
  } catch (err) {
    return [false, describeError(err)]
  }
}

/* ==========================================================================
 *  环境信息（UI 上显示"已连接 Steam：xxx"之类的地方可以用）
 * ========================================================================== */

/**
 * 取一份当前桌面环境的只读快照。网页版返回桌面相关字段全为 null 的对象。
 * 这是同步函数（bridge.steam 的字段在 preload 阶段就已经填好了）。
 */
export function getDesktopInfo(): {
  isDesktop: boolean
  platform: string | null
  steamAvailable: boolean
  steamPlayerName: string | null
} {
  const bridge = getBridge()
  if (bridge === null) {
    return { isDesktop: false, platform: null, steamAvailable: false, steamPlayerName: null }
  }
  return {
    isDesktop: true,
    platform: bridge.platform,
    steamAvailable: bridge.steam.available === true,
    steamPlayerName: bridge.steam.playerName
  }
}

/* ==========================================================================
 *  其它桌面能力
 * ========================================================================== */

/** 退出桌面应用；网页版为 no-op。 */
export async function quitDesktop(): Promise<boolean> {
  const bridge = getBridge()
  if (bridge === null) return false
  try {
    return await bridge.quit()
  } catch {
    return false
  }
}

/** 切换全屏；网页版为 no-op。@returns 切换后的全屏状态 */
export async function toggleFullscreen(): Promise<boolean> {
  const bridge = getBridge()
  if (bridge === null) return false
  try {
    return await bridge.toggleFullscreen()
  } catch {
    return false
  }
}

/* ==========================================================================
 *  内部小工具
 * ========================================================================== */

/**
 * 把 unknown 类型的异常转成一句人话。
 * @param err
 */
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return '未知错误'
}
