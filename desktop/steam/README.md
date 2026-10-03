# `desktop/steam/` —— Steam 集成相关文件

这个目录放的是「让桌面版接上 Steam」所需要的全部脚手架文件。**请注意：目前只是脚手架，Steam 集成尚未真正打通。**

---

## 目录内容

| 文件 | 用途 |
| --- | --- |
| `steam_appid.txt` | 开发期用的 AppID 文件，内容为 `480` |
| `steamconfig.example.json` | 上传配置模板（复制为 `steamconfig.json` 后填写） |
| `steamconfig.json` | 你的真实配置，**已被 .gitignore 忽略，不要提交** |
| `upload.mjs` | 驱动 `steamcmd` 上传 depot 的脚本 |
| `DEPOT_CHECKLIST.md` | 上架前必须在 Steamworks 后台完成的事项清单 |
| `build-scripts/` | `upload.mjs` 运行时生成的 VDF 脚本（已 gitignore） |
| `build-output/` | steamcmd 的 build 日志输出目录（已 gitignore） |

---

## 关于 `steam_appid.txt` 里的 `480`

`480` 是 Valve 的公开测试 AppID，对应一个叫 **Spacewar** 的示例程序。它的作用是让开发者**在不拥有正式 AppID 的情况下**验证 Steamworks 集成是否正确：只要本机装有 Steam 客户端、登录了任意账号，用它就能成功初始化 Steam API、测试成就和 Steam Cloud。

> **🚨 正式发行前，必须把 `480` 替换成你自己的真实 AppID。**
>
> 带着 `480` 发行意味着你的游戏会被 Steam 当成 Spacewar：成就解锁会写到错误的 App 上，Steam Cloud 会和其他所有用 480 做测试的游戏共用同一个云存储空间，而且拿不到你自己的统计数据。这是必须改的。

---

## `steam_appid.txt` 到底该不该打进发行包？—— 讲清楚这两件事

这里有两个**不同**的机制，很容易混淆：

### 机制一：Steam 客户端自动注入 AppID（正式发行的正确做法）

当游戏从 Steam 库启动时，Steam 客户端会把 AppID 通过环境变量传给游戏进程。此时 `steam_api` 会直接使用这个 AppID，**根本不需要 `steam_appid.txt`**。

所以正式的 depot **不应该**包含 `steam_appid.txt`。这也是本项目的 `electron-builder.yml` 明确把它排除在外的原因（见该文件 `files` 段的注释），`upload.mjs` 生成的 depot VDF 里也加了 `FileExclusion`。让 Steam 注入 ID，才能保证换 AppID、换分支、进 beta 时行为永远正确。

### 机制二：`steam_appid.txt` 放在可执行文件旁边（开发/调试用）

当游戏**不是**通过 Steam 启动的（比如你直接双击 `崇祯 · 宦海浮沉.exe`，或者跑 `npm run dev`），没有任何东西注入 AppID，`steam_api` 就会去可执行文件所在目录找 `steam_appid.txt`。

所以调试时的做法是：把 `desktop/steam/steam_appid.txt` 手工拷到 exe 同级目录，例如：

```
desktop/release/win-unpacked/steam_appid.txt   ← 与 .exe 同级
```

这样直接双击 exe 也能连上 Steam。

### 本项目的第三重便利

`desktop/main.cjs` 的 `applyDevAppIdConvenience()` 会在启动时**额外**读一次 `desktop/steam/steam_appid.txt`，把数字塞进 `process.env.SteamAppId`。这只是为了让 `cd desktop && npm run dev` 开箱可测，不改变上面两个机制的结论。

---

## 一句话总结

| 场景 | AppID 从哪来 | depot 里要不要 `steam_appid.txt` |
| --- | --- | --- |
| 玩家从 Steam 启动 | Steam 客户端注入 | **不要**（本项目已排除） |
| 开发时 `npm run dev` | `desktop/steam/steam_appid.txt`（480） | —— |
| 直接双击 exe 测试 | 手工拷到 exe 同级目录 | 仅本地测试时临时放 |
| 正式发行 | 真实 AppID，由 Steam 注入 | **不要** |

---

## 上传流程速览

```powershell
# 1. 在仓库根构建 web 产物
npm run build

# 2. 打包桌面版（产出 desktop/release/win-unpacked/）
cd desktop
npm run pack          # 只打包不生成安装器，产出目录适合直接上传 depot

# 3. 配置上传参数
copy steam\steamconfig.example.json steam\steamconfig.json
#    然后编辑 steamconfig.json，填真实 appId / depotId / username

# 4. 上传
node steam\upload.mjs
```

上传细节、密码处理方式、失败排查见 `upload.mjs` 顶部的注释块。
后台需要完成的事项见 `DEPOT_CHECKLIST.md`。
