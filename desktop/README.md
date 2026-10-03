# 桌面 / Steam 打包层

> 这是「崇祯 · 宦海浮沉模拟器」的 **Electron 桌面壳 + Steam 集成脚手架**。
> 它把仓库根的纯前端 web 构建（`dist/`）包成一个 Windows/Linux/macOS 桌面应用，
> 并预留了 Steam 成就、Steam Cloud、本地磁盘存档三条通道。
>
> **⚠️ 请先读「[尚未完成的部分](#尚未完成的部分)」一节** —— 这个目录目前是脚手架，
> 不是可以直接上架的成品。

---

## 1. 前置要求

| 项 | 要求 | 说明 |
| --- | --- | --- |
| Node.js | **20 或更高** | 仓库根 `package.json` 的 `engines` 也是 `>=20` |
| npm | 随 Node 附带即可 | |
| Windows | **打 NSIS 安装包必须用 Windows** | electron-builder 不做交叉编译 |
| macOS | 打 dmg 必须在 macOS 上 | 公证还需要 Apple Developer 账号 |
| Linux | 打 AppImage 必须在 Linux 上 | |
| Steam 客户端 | 可选 | 没有也能开发，会走 mock 驱动 |
| steamcmd | 仅上传 depot 时需要 | 见 `steam/README.md` |

> **关于跨平台构建的重要提醒**
> `steamworks.js` 是原生模块，它的 `.node` 绑定在 `dist/win64`、`dist/linux64`、`dist/osx`
> 三个目录里分开放置。**在 Windows 上打出来的包只会包含 Windows 的绑定**。
> 要出 Linux / macOS 版本，必须在对应操作系统上（或对应 runner 的 CI 里）重新 `npm install` + 打包。
> 在 Windows 上写 `npm run dist:linux` 得到的 AppImage **不会**带正确的原生绑定。

---

## 2. 正确的构建顺序（照抄即可）

```powershell
# ── 第 1 步：在仓库根构建 web 产物 ──────────────────────────────
cd C:\Users\moli\Documents\deepseek-harness\default-workspace\repo
npm run build          # = tsc --noEmit && vite build，产出 repo\dist\

# ── 第 2 步：安装桌面层依赖 ────────────────────────────────────
cd desktop
npm install            # 安装 electron / electron-builder / steamworks.js

# ── 第 3 步：打包 ─────────────────────────────────────────────
npm run pack           # 只打包成目录（release\win-unpacked\），适合本地测试与上传 depot
npm run dist           # 生成安装器（默认当前平台全部 target）
npm run dist:win       # 明确指定 Windows：NSIS 安装包 + zip 免安装包
```

**顺序不能颠倒。** `electron-builder.yml` 里的 `extraResources` 会把 `../dist` 复制进包；
如果第 1 步没做或做得太早，打进包里的是**旧产物甚至空目录**。

`repo\package.json` 里也提供了快捷命令，等价于上面的第 2、3 步：

```powershell
npm run desktop:install
npm run desktop:pack
npm run desktop:dist
```

### 输出在哪里

```
desktop\release\
├── 崇祯 · 宦海浮沉-Setup-0.4.0-x64.exe     ← NSIS 安装包
├── 崇祯 · 宦海浮沉-0.4.0-x64.zip           ← 免安装 zip
└── win-unpacked\                            ← 未压缩的应用目录（**上传 depot 用这个**）
    ├── 崇祯 · 宦海浮沉.exe
    └── resources\
        ├── app.asar                         ← main/preload/steam.cjs
        ├── app.asar.unpacked\               ← steamworks.js 的原生绑定与 steam_api64.dll
        └── web\                             ← 就是 repo\dist\ 的内容
```

---

## 3. 应用如何定位 web 产物（dev vs 打包后）

只有一处逻辑：`main.cjs` 的 `resolveAppEntry()`。

| 场景 | 加载路径 | 判定依据 |
| --- | --- | --- |
| 开发（`npm run dev`） | `<repo>\desktop\..\dist\index.html` | `app.isPackaged === false` |
| 打包后 | `<resources>\web\index.html`，即 `process.resourcesPath\web\index.html` | `app.isPackaged === true` |

打包路径能成立，靠的是 `electron-builder.yml` 里这一段：

```yaml
extraResources:
  - from: ../dist
    to: web
```

**这三处必须始终一致**：`electron-builder.yml` 的 `from`/`to`、`main.cjs` 的 `resolveAppEntry()`、
以及本文档上面的目录树。改任何一处都要同时改另两处。

如果 `index.html` 找不到，`main.cjs` 不会白屏，而是在控制台打印一条带修复指令的错误
（见 `assertWebBuildExists()`）。

### 开发模式

```powershell
cd repo && npm run build   # 先构建一次，之后改前端代码需要重新构建
cd desktop && npm run dev  # = electron . --dev
```

`--dev` 会打开 DevTools 快捷键（`Ctrl+Shift+I` / `F12`）和 `Ctrl+R` 重载，并且**保留**应用菜单。
生产构建里 `Menu.setApplicationMenu(null)` 会把默认菜单彻底去掉。

> 本目录**没有**配置 HMR：`npm run dev` 加载的是磁盘上的 `dist/`，不是 Vite dev server。
> 这是有意的 —— 让桌面构建只依赖一种"已构建产物"的形态，减少一套容易漂移的配置。
> 改前端代码后请重新 `npm run build`（或把 `main.cjs` 的 `resolveAppEntry()` 改成读
> `http://localhost:5173`，但那属于后续增强）。

---

## 4. `steamworks.js`：为什么是可选依赖

`steamworks.js` 是原生 Node 模块（Rust + `steam_api64.dll`）。它会在以下**任意一种**情况下不可用：

- 没装（`--ignore-scripts` 安装、`optionalDependencies` 被跳过）
- 原生绑定没编译 / 架构不匹配（32 位、arm64 Windows 等）
- Steam 客户端没运行
- `steam_appid.txt` 里的 AppID 无效，或当前账号不拥有该 App

`desktop/package.json` 把它放在 **`optionalDependencies`**，`steam.cjs` 用
「运行时 `try/catch` + `require` 变量名」的方式加载，因此上面每一种情况都只会导致
**降级到 mock 驱动**，而不会让应用起不来。

> **关于 `npx electron-builder install-app-deps`**
> 如果你换了 Node 版本或 Electron 版本后遇到原生模块 ABI 报错
> （典型信息：`was compiled against a different Node.js version`），
> 在 `desktop/` 目录下执行一次即可：
> ```powershell
> npx electron-builder install-app-deps
> ```
> 它会按 Electron 的 ABI 重新编译 / 重新下载原生依赖。
> 本项目的 `steamworks.js` 0.3.x **自带预编译好的 `.node`**，所以大多数情况下不需要这一步。
> 注意 `npm install --ignore-scripts` 不会触发它，也不会触发 Electron 二进制下载 ——
> 正常安装请**不要**加这个参数。

### 怎么确认当前用的是哪个驱动

三种办法，从简到繁：

```powershell
# 1) 最快：跑自检脚本（会打印 mock 驱动的完整行为）
cd desktop && npm run verify:steam-driver

# 2) 更完整：跑 24 项断言的冒烟测试
cd desktop && node smoke-test.cjs

# 3) 最真实：直接启动应用，看主进程控制台的第一行 Steam 日志
cd desktop && npm run dev
#    [main] Steam 状态：{"available":true,"driver":"steam",...}   ← 真连上了
#    [main] Steam 状态：{"available":false,"driver":"mock",...}   ← 降级了
#    [main] 使用 MOCK 驱动 —— 游戏功能不受影响，成就只写入本地 mock-steam/ 目录。
```

`getStatus()` 返回的 `error` 字段会写明降级的具体原因（缺模块 / Steam 未运行 / AppID 无效等），
不需要猜。

### mock 驱动落在哪里

```
%APPDATA%\<产品名>\mock-steam\mock-state.json
```

里面是 `{ "achievements": {...}, "cloudFiles": {...} }`。删掉这个目录 = 重置 mock 状态。
Linux/macOS 对应 `app.getPath('userData')` 的位置。

强制使用 mock（例如 Steam 客户端状态异常时自救）：

```powershell
$env:CHONGZHEN_FORCE_MOCK_STEAM = "1"
npm run dev
```

---

## 5. ⚠️ Steam Cloud 与游戏存档：目前**还没打通**

这一段请务必读完，否则容易误以为"开了成就和云存档就完事了"。

### 现状

游戏**现在的存档完全写在 `localStorage` 里**，键前缀 `chongzhen_`。
在 Electron 里，`localStorage` 落在 Chromium 的 profile 目录下：

```
%APPDATA%\<产品名>\Local Storage\leveldb\
```

这带来两个事实：

1. **Steam Cloud 管不到它。** Steam Cloud 只同步你显式通过 `ISteamRemoteStorage`
   写入的文件，不会去同步 Chromium 的 `leveldb`。所以即使你在 Steamworks 后台
   打开了 Cloud 开关并设了配额，**玩家换一台电脑，存档依然会丢**。
2. **存档在卸载时不会丢**（因为它在 `%APPDATA%` 而不是安装目录），
   但这只是"同一台机器上不丢"，不是云同步。

### 脚手架已经准备了两条通道

`desktop/preload.cjs` 通过 `window.chongzhenDesktop` 暴露了两套 API：

| API | 落点 | 用途 |
| --- | --- | --- |
| `saveToDisk(name, contents)` / `loadFromDisk(name)` | `%APPDATA%\<产品名>\saves\<name>` | 本地磁盘存档，可做备份 / 导入导出 |
| `steam.setCloudFile(name, contents)` / `getCloudFile(name)` / `listCloudFiles()` | Steam 远程存储 | 真正的跨机器云同步 |

两者都做了文件名白名单校验（只允许字母数字与 `. _ -`，禁止路径分隔符），
preload 与主进程各校验一次。

`src/services/desktopBridge.ts` 是游戏侧的接入点，已经提供了
`syncAchievementToDesktop()`、`exportSaveToDisk()`、`importSaveFromDisk()`、
`syncSaveToCloud()`、`loadSaveFromCloud()` 等包装函数，并且
**在网页版调用时全部安全降级为 no-op**。

### 还缺的是什么

**把游戏真正接到这些 API 上**，具体包括：

- 让 `useGameEngine.ts` 的存档读写同时走 localStorage 和磁盘 / 云
- 处理冲突：本地存档比云端新怎么办？（需要存档时间戳比对 + 让玩家选）
- 首次启动时把已有的 `localStorage` 存档迁移到磁盘
- 成就解锁时调用 `syncAchievementToDesktop()`
- 设置界面加"是否启用云存档"开关

**这些都是尚未开始的后续任务，不在本脚手架的范围内。**
在此之前，`desktopBridge.ts` 是一个**没有被任何游戏逻辑 import 的文件**——
它存在只是为了让类型检查和后续接入有个明确的落点。

### 另外：Steam Cloud 必须在后台单独开启

即使上面都做完了，Steamworks 后台还得做两件事（见 `steam/DEPOT_CHECKLIST.md` 阶段 3）：

1. 在该 App 的「Steam Cloud」页面**启用**云同步
2. 设置**字节配额**（建议 10 MB 起步，JSON 存档绰绰有余）

后台没开的话，`setCloudFile()` 会稳定返回 `false`（`steam.cjs` 里会先调
`cloud.isEnabledForApp()` 检查并把原因写进 `getStatus().error`）。

---

## 6. 已实现的安全加固

打包后的应用不是"套了个壳的浏览器"，以下措施都已落地（见 `main.cjs`）：

| 措施 | 实现位置 |
| --- | --- |
| `contextIsolation: true` | `webPreferences` |
| `nodeIntegration: false` | `webPreferences` |
| `sandbox: true` | `webPreferences` |
| 渲染进程只能看到 `window.chongzhenDesktop` 一个对象，**没有** `ipcRenderer` / `require` | `preload.cjs` |
| 真实 CSP（file:// 页面靠 `onHeadersReceived` 注入） | `installCsp()` |
| 禁止导航离开应用；`window.open` 一律拦截 | `applyNavigationHardening()` |
| 外部链接只放行 `http:` / `https:`，交给系统浏览器 | `isSafeExternalUrl()` |
| 拒绝所有权限请求（摄像头 / 麦克风 / 定位 / 通知） | `setPermissionRequestHandler` |
| 禁止 `webview` 标签 | `webviewTag: false` + `will-attach-webview` |
| 单实例锁（防止两个进程抢同一份存档） | `requestSingleInstanceLock()` |
| 存档写入用「临时文件 + rename」避免写一半损坏 | `saveToDisk` handler |
| 生产环境移除默认应用菜单 | `Menu.setApplicationMenu(null)` |

CSP 里唯一宽松的一项是 `style-src` 的 `'unsafe-inline'`，**这是必需的**：
应用在 `index.html` 内联了首屏关键 CSS，且 React 大量使用 `style={{...}}` 内联样式属性，
按 CSP 规范这属于 inline style，去掉会导致界面错版。
真正关键的 `script-src` 保持严格的 `'self'`，没有 `unsafe-inline` / `unsafe-eval`。

`connect-src` 允许 `https:` 是因为可选的 AI 顾问 / 配图功能需要直连外部
OpenAI 兼容端点（见 `src/services/aiService.ts`）——纯前端应用没有后端代理，
只能这样放行。

---

## 7. 图标：需要你自己提供

`electron-builder.yml` 里引用了三个图标文件，**它们目前都不存在**，
本脚手架不会伪造二进制文件：

| 文件 | 格式要求 | 用在哪 |
| --- | --- | --- |
| `build/icon.ico` | **256×256** 的多尺寸 ICO | Windows 安装包与 exe |
| `build/icon.png` | **512×512** 或 1024×1024 PNG | Linux AppImage |
| `build/icon.icns` | macOS ICNS | mac dmg |

缺失时 electron-builder 会退回默认 Electron 图标并**打印警告**，构建不会失败 ——
但正式发行前必须补齐，否则玩家在 Steam 库里看到的是 Electron 的图标。

生成 `.ico` / `.icns` 可以用 `electron-icon-builder` 或任何在线转换工具，
源图建议至少 1024×1024。

---

## 8. 尚未完成的部分

按重要性排序，诚实列出：

### 阻塞上架的

- [ ] **Steamworks 合作伙伴账号 + $100 上架费** —— 目前没有账号，也没有 AppID
- [ ] **真实 AppID 替换 `480`** —— `desktop/steam/steam_appid.txt` 现在是 Valve 的测试 ID
- [ ] **成就数量超限** —— 游戏内有 **105** 个成就，Steam 单 App 上限 **100** 个，
      必须先裁剪或合并（方案见 `desktop/steam.cjs` 顶部注释）
- [ ] **在后台逐个创建 100 个以内的成就 API Name** —— 必须与 `steam.cjs` 的
      `ACHIEVEMENTS` 的 KEY 逐字符一致
- [ ] **图标文件** —— 见上一节，三个平台各一个
- [ ] **Steamworks 后台全部配置** —— 见 `steam/DEPOT_CHECKLIST.md`
- [ ] **商店页面素材** —— 至少 5 张截图 + 封面图，本脚手架不提供
- [ ] **Steam 的 2 周冷却期 + 审核** —— 流程性等待，无法绕过

### 功能上还没接的

- [ ] **游戏存档接入 `desktopBridge`** —— 见第 5 节，这是最大的一块
- [ ] **成就解锁接入 `syncAchievementToDesktop()`** —— 目前没有任何调用点
- [ ] **Steam 覆盖层（Overlay）** —— `steamworks.js` 提供
      `electronEnableSteamOverlay()`，需要在 `app.whenReady()` 里调用；
      未启用时玩家按 `Shift+Tab` 打不开 Steam 覆盖层，成就弹窗也不会出现
- [ ] **`restartAppIfNecessary()`** —— 正式发行时应当调用，让 Steam 启动器
      接管并保证 AppID 正确；开发期调用会反复重启，所以脚手架里没有启用
- [ ] **存档冲突解决策略** —— 本地 vs 云端谁更新，需要时间戳比对与玩家选择
- [ ] **多语言 / Steam 语言探测** —— 目前不读 Steam 的语言设置
- [ ] **崩溃上报** —— 没有接入任何 crash reporter
- [ ] **自动更新** —— 有意没做：Steam 自己负责更新，加了反而冲突

### 已验证 / 未验证的边界

本脚手架在开发机上**实际验证过**的：

- ✅ 四个 JS 文件全部通过 `node --check`
- ✅ `steam.cjs` 在 `steamworks.js` **完全不存在**时能正常 `require`，降级到 mock 且不抛异常
- ✅ mock 驱动的成就读写、云存档读写、路径穿越防护、跨进程持久化（24 项断言全过）
- ✅ `upload.mjs` 的配置校验、VDF 生成、steamcmd 调用与「不传密码」行为
- ✅ `src/services/desktopBridge.ts` 在仓库根 `tsc --noEmit`（`strict` 模式）下通过

**没有**验证过（受环境限制，需在有图形界面 + Steam 客户端的机器上做）：

- ❌ **应用从未真正启动过** —— 沙箱里 Electron 二进制下载被拒（EPERM），
  `electron.exe` 不存在，所以没有跑过 `npm run dev` / `npm run pack`
- ❌ **从未与真实 Steam 客户端通信过** —— 开发机没装 Steam，
  `steamworks.js` 的 `init(480)` 直接抛 `Could not determine Steam client install directory.`，
  因此「真实驱动」这条分支**只经过了代码审查，没有经过运行时验证**
- ❌ **没有打过任何安装包** —— 依赖上面的 Electron 二进制缺失
- ❌ **CSP 是否真的生效没有在运行时确认过** —— 需启动应用后在 DevTools 里看
  是否有 CSP 违规报错
