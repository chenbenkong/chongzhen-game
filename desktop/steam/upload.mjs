#!/usr/bin/env node
/**
 * ============================================================================
 *  steam/upload.mjs —— 用 steamcmd 把桌面构建上传到 Steam depot
 * ============================================================================
 *
 *  用法：
 *    1. 复制配置模板并填写真实 AppID / DepotID / 账号名：
 *         cp desktop/steam/steamconfig.example.json desktop/steam/steamconfig.json
 *    2. 先在仓库根 `npm run build`，再 `cd desktop && npm run dist`，
 *       得到 desktop/release/win-unpacked/（这就是要上传的 depot 内容）
 *    3. 运行：
 *         node desktop/steam/upload.mjs
 *       或从仓库根：npm run steam:upload
 *
 *  【关于密码 —— 请认真读这一段】
 *  本脚本**从不接收也从不打印密码**。它执行的是：
 *      steamcmd +login <username> +run_app_build <vdf> +quit
 *  即只传用户名、不传密码，由 steamcmd 自己提示输入，或使用它已经缓存的
 *  登录会话（首次 `steamcmd +login <user>` 成功后会缓存在 steamcmd 目录）。
 *  这样做的好处是密码不会出现在命令行历史、进程列表、CI 日志里。
 *  在无人值守的 CI 里，请改用 Steam 的 **Web API 上传**（ISteamRemoteStorage
 *  / ISteamUGC 的 build API），或者用 Steam Guard 的机器令牌 + Steam 的
 *  专用上传账号 —— 不要把密码写进任何脚本或环境变量。
 *
 *  【退出码】
 *  任何一步失败都以非零码退出，方便接 CI。
 * ============================================================================
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** 支持的常见 steamcmd 安装位置（按平台） */
const STEAMCMD_CANDIDATES = {
  win32: [
    'C:\\steamcmd\\steamcmd.exe',
    'C:\\Program Files (x86)\\Steam\\steamcmd.exe',
    'C:\\Program Files\\Steam\\steamcmd.exe',
    join(process.env.LOCALAPPDATA || '', 'steamcmd', 'steamcmd.exe'),
    join(process.env.USERPROFILE || '', 'steamcmd', 'steamcmd.exe')
  ],
  linux: [
    '/usr/bin/steamcmd',
    '/usr/games/steamcmd',
    '/usr/local/bin/steamcmd',
    join(process.env.HOME || '', 'steamcmd', 'steamcmd.sh')
  ],
  darwin: [
    '/usr/local/bin/steamcmd',
    '/opt/homebrew/bin/steamcmd',
    join(process.env.HOME || '', 'steamcmd', 'steamcmd.sh')
  ]
}

/* --------------------------------------------------------------------------
 *  小工具
 * ------------------------------------------------------------------------ */

function log(message) {
  console.log('[steam-upload] ' + message)
}

function fail(message) {
  console.error('[steam-upload] ✗ ' + message)
  process.exit(1)
}

/**
 * 从环境变量或 steamconfig.json 读配置。环境变量优先级更高。
 * @returns {{appId:number, depotId:number, username:string, contentRoot:string, buildDescription:string, branch:string, preview:boolean}}
 */
function loadConfig() {
  const configPath = process.env.STEAM_CONFIG_PATH
    ? resolve(process.cwd(), process.env.STEAM_CONFIG_PATH)
    : join(__dirname, 'steamconfig.json')

  let fileConfig = {}
  if (existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(readFileSync(configPath, 'utf8'))
      log('已读取配置：' + configPath)
    } catch (err) {
      fail('steamconfig.json 解析失败（不是合法 JSON）：' + err.message)
    }
  } else {
    log('未找到 ' + configPath + '，将只使用环境变量。')
    log('提示：可复制 steamconfig.example.json 为 steamconfig.json 并填写。')
  }

  const appId = Number(process.env.STEAM_APP_ID || fileConfig.appId || 0)
  const depotId = Number(process.env.STEAM_DEPOT_ID || fileConfig.depotId || 0)
  const username = String(process.env.STEAM_USERNAME || fileConfig.username || '')
  const rawContentRoot = String(process.env.STEAM_CONTENT_ROOT || fileConfig.contentRoot || '')
  const buildDescription = String(
    process.env.STEAM_BUILD_DESCRIPTION ||
    fileConfig.buildDescription ||
    'chongzhen desktop build'
  )
  // 默认空字符串 = 不自动上线（安全默认）。想上传即上线就设为 "default"。
  const branch = String(process.env.STEAM_BRANCH || fileConfig.branch || '')
  const preview = String(process.env.STEAM_PREVIEW || fileConfig.preview || '') === 'true'

  if (!Number.isInteger(appId) || appId <= 0) {
    fail('缺少有效的 AppID。请设置 STEAM_APP_ID 环境变量，或在 steamconfig.json 里填 appId。')
  }
  if (!Number.isInteger(depotId) || depotId <= 0) {
    fail('缺少有效的 DepotID。请设置 STEAM_DEPOT_ID 环境变量，或在 steamconfig.json 里填 depotId。')
  }
  if (username === '') {
    fail('缺少 Steam 账号名。请设置 STEAM_USERNAME 环境变量，或在 steamconfig.json 里填 username。\n' +
         '（只填账号名，不要填密码 —— 脚本不会使用也绝不会打印密码）')
  }
  if (rawContentRoot === '') {
    fail('缺少 contentRoot。请设置 STEAM_CONTENT_ROOT 环境变量，或在 steamconfig.json 里填 contentRoot。\n' +
         '典型值：../release/win-unpacked（相对于 desktop/steam/ 目录，也就是 electron-builder --dir 的输出）')
  }

  // contentRoot 相对路径按 steam/ 目录解析（与配置文件同目录），绝对路径原样使用
  const contentRoot = isAbsolute(rawContentRoot) ? rawContentRoot : resolve(__dirname, rawContentRoot)

  if (!existsSync(contentRoot)) {
    fail('contentRoot 不存在：' + contentRoot + '\n' +
         '请先执行：cd desktop && npm run pack   （产出 release/win-unpacked/）\n' +
         '或在仓库根先执行 npm run build 再打包。')
  }

  return { appId, depotId, username, contentRoot, buildDescription, branch, preview }
}

/**
 * 定位 steamcmd。优先 STEAMCMD_PATH，其次常见安装位置，最后 PATH。
 * @returns {string}
 */
function locateSteamCmd() {
  const fromEnv = process.env.STEAMCMD_PATH
  if (fromEnv && fromEnv.trim() !== '') {
    const resolved = resolve(fromEnv.trim())
    if (!existsSync(resolved)) {
      fail('STEAMCMD_PATH 指向的文件不存在：' + resolved)
    }
    return resolved
  }

  const candidates = STEAMCMD_CANDIDATES[process.platform] || []
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate
  }

  log('未在常见位置找到 steamcmd，将尝试直接调用 PATH 里的 steamcmd。')
  log('如果失败，请下载 steamcmd 并设置 STEAMCMD_PATH 环境变量：')
  log('  https://developer.valvesoftware.com/wiki/SteamCMD#Downloading_SteamCMD')
  return process.platform === 'win32' ? 'steamcmd.exe' : 'steamcmd'
}

/**
 * 规范化路径为 VDF 需要的正斜杠形式。
 * @param {string} p
 * @returns {string}
 */
function toVdfPath(p) {
  return p.replace(/\\/g, '/')
}

/**
 * 生成 app build VDF 脚本。
 * 参考：https://developer.valvesoftware.com/wiki/SteamCMD#Automating_SteamCMD
 * @param {ReturnType<typeof loadConfig>} config
 * @param {string} outputPath
 */
function writeVdf(config, outputPath) {
  // SetLive 为空字符串 = 上传后**不自动上线**，需要到后台手动点 Set Build Live。
  // 这对首次上传非常重要：可以避免一个没验证过的包直接进入 default 分支。
  const setLive = config.preview ? '' : config.branch
  const vdf = `"AppBuild"
{
  "AppID" "${config.appId}"
  "Desc" "${config.buildDescription}"
  "BuildOutput" "${toVdfPath(join(__dirname, 'build-output'))}"
  "ContentRoot" "${toVdfPath(config.contentRoot)}"
  "SetLive" "${setLive}"
  "Preview" "${config.preview ? 1 : 0}"

  "Depots"
  {
    "${config.depotId}" "depot_build_${config.depotId}.vdf"
  }
}
`
  writeFileSync(outputPath, vdf, 'utf8')
  log('已生成 app build 脚本：' + outputPath)
  if (setLive === '') {
    log('SetLive 为空 —— 上传后不会自动上线，需到 Steamworks 后台手动 Set Build Live。')
  } else {
    log('SetLive=' + setLive + ' —— 上传成功后会直接切到该分支。')
  }
  return vdf
}

/**
 * 生成 depot build VDF 脚本。
 * FileMapping 把内容根目录整体映射进 depot，并排除掉不该上传的开发文件。
 * @param {ReturnType<typeof loadConfig>} config
 * @param {string} outputPath
 */
function writeDepotVdf(config, outputPath) {
  const vdf = `"DepotBuildConfig"
{
  "DepotID" "${config.depotId}"
  "ContentRoot" "${toVdfPath(config.contentRoot)}"
  "FileMapping"
  {
    "LocalPath" "*"
    "DepotPath" "."
    "recursive" "1"
  }
  "FileExclusion" "*.pdb"
  "FileExclusion" "**/*.pdb"
  "FileExclusion" "steam_appid.txt"
  "FileExclusion" "**/steam_appid.txt"
  "FileExclusion" "*.log"
  "FileExclusion" "**/*.log"
}
`
  writeFileSync(outputPath, vdf, 'utf8')
  log('已生成 depot build 脚本：' + outputPath)
  return vdf
}

/**
 * 运行 steamcmd，实时把输出转发到本进程 stdout/stderr。
 *
 * 关于 shell：
 *   Windows 上的 steamcmd 有时是 steamcmd.exe，有时是包装用的 steamcmd.cmd。
 *   Node 20 之后出于安全考虑（CVE-2024-27980）不再允许直接 spawn .cmd/.bat，
 *   会抛 EINVAL。因此当目标扩展名是 .cmd/.bat 时改用 shell 执行。
 *   用 shell 时 Node 会把参数拼成一条命令行，所以路径参数必须自己加引号，
 *   否则带空格的路径（例如 "C:\Program Files\steamcmd\..."）会被拆开。
 *
 * @param {string} steamCmd
 * @param {string[]} args
 * @returns {Promise<number>} 退出码
 */
function runSteamCmd(steamCmd, args) {
  return new Promise((resolvePromise) => {
    const needsShell = /\.(cmd|bat)$/i.test(steamCmd)
    const finalArgs = needsShell
      ? args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))
      : args

    log('执行：' + steamCmd + ' ' + finalArgs.join(' '))
    if (needsShell) {
      log('（目标为 .cmd/.bat，已启用 shell 并转义含空格的参数）')
    }

    const child = spawn(steamCmd, finalArgs, {
      stdio: 'inherit', // 直接继承 stdio —— 密码提示才能正常交互
      windowsHide: false,
      shell: needsShell
    })

    child.on('error', (err) => {
      console.error('[steam-upload] ✗ 无法启动 steamcmd：' + err.message)
      console.error('[steam-upload] 请确认已安装 steamcmd，或设置 STEAMCMD_PATH。')
      resolvePromise(1)
    })

    child.on('close', (code) => {
      resolvePromise(typeof code === 'number' ? code : 1)
    })
  })
}

/* --------------------------------------------------------------------------
 *  主流程
 * ------------------------------------------------------------------------ */

async function main() {
  console.log('=' .repeat(70))
  log('Steam depot 上传工具')
  console.log('='.repeat(70))

  const config = loadConfig()
  log('AppID      : ' + config.appId)
  log('DepotID    : ' + config.depotId)
  log('账号       : ' + config.username + '   （密码不会由本脚本传递或显示）')
  log('内容根目录 : ' + config.contentRoot)
  log('分支       : ' + config.branch + (config.preview ? '  [PREVIEW 模式，不会真正上线]' : ''))
  console.log('-'.repeat(70))

  const steamCmd = locateSteamCmd()
  log('steamcmd   : ' + steamCmd)

  // 生成 VDF 脚本
  const scriptsDir = join(__dirname, 'build-scripts')
  mkdirSync(scriptsDir, { recursive: true })
  mkdirSync(join(__dirname, 'build-output'), { recursive: true })

  const appBuildVdf = join(scriptsDir, 'app_build.vdf')
  const depotBuildVdf = join(scriptsDir, `depot_build_${config.depotId}.vdf`)

  writeDepotVdf(config, depotBuildVdf)
  writeVdf(config, appBuildVdf)

  console.log('-'.repeat(70))
  log('提示：steamcmd 可能会提示输入密码和 Steam Guard 验证码。')
  log('      密码只输入给 steamcmd 自己，不会经过本脚本。')
  log('      首次登录成功后 steamcmd 会缓存会话，后续可无人值守。')
  console.log('-'.repeat(70))

  const args = [
    '+login', config.username,
    '+run_app_build', appBuildVdf,
    '+quit'
  ]

  const exitCode = await runSteamCmd(steamCmd, args)

  console.log('-'.repeat(70))
  if (exitCode === 0) {
    // 注意：steamcmd 的退出码并不总是可靠地反映 build 失败，
    // 所以这里只报告事实，不做"上传成功"的断言。
    log('steamcmd 正常退出（exit 0）。')
    log('请到 Steamworks 后台 → 该 App → Builds 页面确认 build 是否真的成功入库。')
    log('如需先试跑不上线，把 steamconfig.json 的 "preview" 设为 true。')
  } else {
    console.error('[steam-upload] ✗ steamcmd 退出码 ' + exitCode)
    console.error('[steam-upload] 排查清单：')
    console.error('  - AppID / DepotID 是否与后台一致')
    console.error('  - 账号是否有该 App 的「发布」权限（需要 Publisher 或以上）')
    console.error('  - depot 是否已经在后台创建并关联到该 App')
    console.error('  - Steam Guard 是否要求重新验证')
    process.exit(exitCode === 0 ? 1 : exitCode)
  }
}

main().catch((err) => {
  console.error('[steam-upload] ✗ 未预期的异常：' + (err && err.stack ? err.stack : String(err)))
  process.exit(1)
})
