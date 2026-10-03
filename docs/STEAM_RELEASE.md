# 发布级质量评估（以 Steam 上架标准为基准）

> 本文档回答一个问题：**这个项目的工程质量，是否达到了可以直接发行商业作品的水准？**
>
> 需要说明的是：项目所有者明确表示**目前并不打算真的上架 Steam**，
> 引用 Steam 的标准只是为了确立一个**可对照的质量量级**——不靠"感觉差不多了"，
> 而是拿一套真实存在的、最严格的商业发行要求来逐项对齐。
>
> 因此本文档分两部分：
> - **§1–§2**：质量基准的达成情况（这是本文的重点）
> - **§3–§6**：假如将来真的要发行，还差什么（附录性质，供未来参考，不构成本次工作的欠账）
>
> 凡是我**没有实际验证过**的，都会明确标注。

---

## 一、结论摘要

| 维度 | 状态 | 说明 |
| --- | --- | --- |
| 工程可交付性 | ✅ 就绪 | 可构建、可测试、可打包桌面版；仓库已瘦身 |
| 代码正确性 | ✅ 已清理 | 修掉 3 个严重缺陷 + 7 个高危缺陷，均有据可查 |
| 健壮性 | ✅ 就绪 | 存档带版本与迁移、写入失败不再静默、错误边界兜底 |
| 离线可运行 | ✅ 就绪 | 零外部 CDN 依赖，相对路径，`file://` 可用 |
| 可访问性 | ✅ 就绪 | 键盘可完整通关，对话框语义统一，动效偏好完整支持 |
| 响应式 | ✅ 就绪 | 360px–1920px 九档视口有自动化回归 |
| 自动化验证 | ✅ 就绪 | 真实 Chromium 冒烟 + 布局回归 + 内容审计脚本 |
| 桌面打包 | 🟡 就绪待实机 | 配置与接入层完整，**安装包未在真实机器上产出验收** |
| 内容合规 / 素材版权 | ⚪ 不适用 | 因不发行，这些不构成欠账；仅记录供未来参考 |

**一句话结论：**

> 工程层面已经达到发布级水准。剩下的两项待办都是**验收动作**而不是**开发欠账**：
> 在真实 Windows 机器上产出一次安装包，以及实际玩通几遍确认数值手感。
>
> 如果将来改变主意真要发行，§3 会告诉你需要先处理什么。

---

## 二、本次已完成的技术改造（可直接验收）

### 2.1 进入门槛已移除（你的明确诉求）

- `index.html` 里的口令门（`#cz-gate` / `czCheck()` / 明文口令 `chongzhen` / `cz_ok` 标记）**已彻底删除**。
- 同时修掉了它的连带问题：旧代码把 `#root` 设为 `display:none`，由门口脚本负责显示；门一删就会白屏。现在 `#root` 常态可见。
- **旧构建产物里仍然带着口令门**（`dist/index.html` 里能直接 view-source 看到密码），已删除该产物并加入 `.gitignore` 与发布前检查项，避免误打包。
- 自动化断言已覆盖：冒烟测试会抓取线上 HTML 文本，确认 `cz-gate`/`czCheck`/`cz_ok`/明文口令全部不存在。

### 2.2 离线可用（Steam 版的硬性前提）

| 项 | 改造前 | 改造后 |
| --- | --- | --- |
| 字体 | `fonts.loli.net` / Google Fonts CDN | 自托管 `@fontsource/ma-shan-zheng`，构建期打包，零外部依赖 |
| 正文字体 | 依赖 Noto Serif SC 网络字体 | 系统 CJK 衬线栈（Windows 宋体 / macOS Songti SC / Linux Noto Serif CJK） |
| 资源路径 | `base: '/chongzhen-game/'` + CI 里 `--base=./` 覆盖（两处易漂移） | `base: './'` 单一声明，Pages 子路径与 `file://` 同时可用 |
| 已知失效路径 | `theme.css` 用 `/cover-landscape.webp` 绝对路径 → Pages 子路径与 Electron 下必然 404 | 改为随包资源 `./assets/cover-landscape.webp`，由构建器重写并加 hash |

> 为什么正文不打包 Noto Serif SC：单字重子集就有 4.47 MB（102 个 woff2 分片），
> 四个字重接近 18 MB。各桌面系统的自带中文衬线体质量已足够，离线首屏也更快。
> 如果将来确实要统一字形，见 `README.md` 的说明，一行即可切回。

### 2.3 桌面打包与 Steamworks 接入层

见 `desktop/README.md`。要点：

- Electron 主进程 + preload（`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`）
- 通过 `onHeadersReceived` 注入 CSP（`file://` 页面无法用 meta 携带完整策略）
- 拦截导航与 `window.open`，仅允许 http(s) 走外部浏览器
- `desktop/steam.cjs`：Steamworks 驱动 + **完整可用的 mock 驱动**
- **没有 AppID 时游戏照常运行**，这正是你现在的状态；拿到 AppID 后只需改一处配置

### 2.4 本次修复的真实缺陷（择要）

这些都是审计确认、且我已验证过的**玩家可感知**问题：

| 严重度 | 问题 | 影响 |
| --- | --- | --- |
| 严重 | `checkDemotion` 里 `RANKS.findIndex()` 少了 `.reverse()`，恒返回 0 | **整个「贬官」机制是死代码**，游戏名里的"浮沉"没了一半 |
| 严重 | 手动存档不写 `currentEvent` / `pendingEvents`，但事件 id 已进 `eventHistory` | 中途存档再读档，**该事件永久消失** |
| 严重 | `handleRestart` 只重置了一半状态 | 死后重开，用死人的官阶打一个已被抽空的事件池 |
| 高 | `机敏值` / `忠诚值` 被 54 处引用却未定义 | `undefined + n = NaN` → 存档里变 `null`；条件判定在内存中"永远通过"、读档后"永远不通过" |
| 高 | `flags.any` 被 30 处引用，`checkEventConditions` 只实现了 `has`/`notHas` | 事件触发前提被静默忽略 |
| 高 | 12 个成就读取从未提供的上下文字段；`legendary_master` 数学上不可能解锁 | 成就永远无法达成 |
| 高 | 调试面板「幽灵模式」对所有玩家常驻可见 | 可浏览**全部事件与未解锁结局**，严重剧透（**发布阻断项**） |
| 高 | `localStorage` 配额耗尽时自动存档静默失败 | 玩家毫无提示地丢掉整局进度 |
| 中 | 48 处 CSS 硬编码 `'Ma Shan Zheng', serif`，绕过 fallback 链 | 字体加载失败时退到纯拉丁 serif |
| 中 | `prefers-reduced-motion` 没有重置 `animation-delay` | 减少动效用户仍要看 2.7 秒的死亡演出 |
| 中 | `LifeReview` 用了 380px 的 `minmax()` 轨道 | 在 360px 手机上横向溢出（影响 100% 手机用户） |
| — | `App.css` 整段复制了 `TitleScreen.css`，含两处互相冲突的 `.title-quote` | ~290 行死 CSS |
| — | 仓库里 30 MB 开发过程产物（`tmp/` 4MB×6、构建日志、截图、一次性脚本） | 已清理，工作区从 ~35MB 降到 ~10MB |

**第二轮（测试驱动）追加修复的：**

| 严重度 | 问题 | 影响 |
| --- | --- | --- |
| 高 | `crisis` 类临界事件只在引擎挂载时检查过一次，而 `checkBoundary` 只查 `'ending'` | 「重病缠身」等危机事件是**死内容**，游戏中途永远触发不了 |
| 中 | 读档未恢复 `lifeRecords`；`playTime` 没有 setter、恒为 0 | 生平回顾会混进上一局的记录；存档预览里的游玩时长是常量 0 |
| 中 | 升迁/贬官判定的依赖数组缺 `体质` / `野心值` / `degree` / `国势` | 这几个字段单独变化时判定不重跑，「体弱多病」「结党营私」等理由形同虚设 |
| 中 | **（本轮新发现）** 降级理由持续存在时，判定会重复累加贬官次数与生平记录 | 体质长期未恢复时，官阶没有再降却不断"被贬"，生平里堆满重复记录 |
| 低 | 投骰链路的二级定时器排布在 `setState` 更新函数内部，卸载时未清理 | 留下悬挂定时器（可观察行为本身是正确的，详见 KNOWN_ISSUES） |

---

## 三、附录：假如将来真要发行，需要先处理什么

> **以下不构成本次工作的欠账。** 你已经明确表示不打算真的上架，
> 所以这些是"未来某天改主意时的清单"，现在读一读了解即可，无需现在动手。
> 我把它们写清楚，是因为其中有两项涉及**不可逆**的操作（成就 API Name、素材授权），
> 提前知道能避免将来返工。

### 3.1 内容合规：非自愿性内容（发行时的硬性阻断项）

**假设要发行，这一条会是第一位的问题，且不是"概率问题"。**

Valve 的 Steam 内容规则明确禁止**非自愿的性内容**（non-consensual sexual content）。
我在 `src/data/events/gray/debauchery/powersex.ts` 等文件中确认存在这类描写，例如：

> 「大人...您这是...」紫菱有些惊慌，**但不敢反抗**。

以及多个文件中的露骨器官描写与非自愿情节。

**Steam 允许成人内容，但有三条不同的线：**

| 内容类型 | Steam 处理 |
| --- | --- |
| 暗示/淡出的成人情节 | 可在内容调查中申报，正常上架 |
| 露骨性内容（双方自愿） | 允许，但需申报为成人内容、年龄门、部分区域限制 |
| **非自愿性内容** | **禁止。会拒绝审核 / 下架** |
| 涉及未成年人的性内容 | 绝对禁止，账号封禁 |

**可选处置（按工作量排序）：**

1. **改写为合规版本**（推荐）：保留「权色交易」的剧情张力与道德抉择，删除器官描写，
   把"不敢反抗"改成明确的权力交易（双方各有所图）。改动集中在 10 个文件、约 2500 行。
2. **加内容开关，双版本共存**：默认合规文本，另存完整版由玩家在设置中解锁。工作量最大，
   且 Steam 版本仍须保证默认版合规。
3. **完全移除该内容线**：过审最稳，但灰色抉择线会明显变薄。

> 你本次明确选择了「保持原样，只做其他优化」，因此我**没有改动这些文本**——
> 在不发行的前提下这是完全合理的决定。我只是把"将来若要发行就得改"这件事记录下来，
> 免得日后忘了。相关文本全部集中在 `src/data/events/gray/debauchery/`（10 个文件）。

**额外需要人工复核的一点**：请确认全部性内容描写中不存在任何看起来未成年的角色。
这是唯一会导致"封号"而非"退审"的红线。我无法从文本可靠推断角色年龄，需要你自查。

### 3.2 ❓ 素材版权：BGM 与美术

商用发行要求你**拥有或已获授权**使用仓库里的每一份素材。以下我无法从仓库判定：

| 素材 | 现状 | 你需要做的 |
| --- | --- | --- |
| `public/bgm.mp3`（5.9 MB） | 无任何来源/授权信息 | **确认来源**。若无商用授权，必须替换或购买 |
| `src/assets/cover-landscape.webp` | 无来源信息 | 确认是原创或已授权 |
| `public/icons/*`、`public/og-image.png` | 本次用脚本生成 | ✅ 无版权问题，脚本在 `scripts/generate-icons.py` |
| 字体 `Ma Shan Zheng` | `@fontsource/ma-shan-zheng`，SIL OFL 1.1 | ✅ 可商用；发布时需随包附带 OFL 许可文本 |
| 正文系统字体 | 不随包分发 | ✅ 无授权问题 |

> 顺便说明：字体使用 SIL OFL 授权，**可以**商用与再分发，但要求在发行物中保留版权声明与
> 许可全文。`node_modules/@fontsource/ma-shan-zheng/LICENSE` 就是该文本，打包前请把它
> 一起放进 `desktop/` 的发行目录（可作为 `LICENSES/` 子目录）。

### 3.3 ❌ Steamworks 账号与 AppID

- 需要注册 Steamworks 合作伙伴账号，一次性费用 **100 美元**（游戏达到 1000 美元营收后可返还）。
- 需要创建应用、拿到 AppID，然后：
  - 把 `desktop/steam/steam_appid.txt` 里的测试 ID `480` 换成你的真实 AppID
  - 在 App Admin 后台逐个创建成就，API Name 必须与 `desktop/steam.cjs` 里 `ACHIEVEMENTS` 映射完全一致
  - 开启 Steam Cloud 并设置字节配额
  - 配置 depot 与启动项
- 完整步骤见 `desktop/steam/DEPOT_CHECKLIST.md`。

> 我无法替你完成这一步：它需要实名与付费，且需要你本人接受 Valve 的协议。

### 3.4 ❌ 商店页物料

Steam 商店页需要一组尺寸严格规定的图片，仓库里**没有**：

| 物料 | 尺寸 | 状态 |
| --- | --- | --- |
| Header capsule | 460×215 | 缺 |
| Small capsule | 231×87 | 缺 |
| Main capsule | 616×353 | 缺 |
| Vertical capsule | 374×448 | 缺 |
| Page background | 1438×810 | 缺 |
| Library capsule | 600×900 | 缺 |
| Library hero | 3840×1240 | 缺 |
| Library logo | 1280×720（透明 PNG） | 缺 |
| 截图 | ≥5 张，1920×1080 | 缺（本次清理时删掉了根目录十几张开发截图，它们分辨率与构图都不达标） |
| 宣传片 | 可选但强烈建议 | 缺 |

我可以基于现有 UI 生成一组**符合尺寸规范的占位物料**（用真实游戏画面截图 + 排版），
但正式发行前建议请美术重做。

---

### 3.5 ❌ 成就数量超过 Steam 上限

游戏内实际定义了 **105 个成就**（`src/types/achievement.ts`，已去重核对）。
`desktop/steam.cjs` 里的 `ACHIEVEMENTS` 映射表**完整覆盖了全部 105 个内部 id**，
API Name 全部是合法的 `SCREAMING_SNAKE_CASE`、无重复 —— 映射本身没有问题。

问题在于：**Steam 对单个 app 的成就数量有上限（公开规则为 100 个）**，
105 个无法全部上线。（这个数字建议你在 Steamworks 后台文档里再确认一次；
本文档基于 Valve 的公开政策与其 2018 年为打击"假游戏"而引入的成就限制。）

**为什么必须现在就决定：** Steamworks 后台里成就的 **API Name 一旦创建就无法修改、
只能删除重建**。所以"先随便建 105 个再说"这条路是走不通的。

**三种可选处置**（`desktop/steam.cjs` 文件头也写了同样的说明）：

1. **合并同组阶梯成就**（推荐）：成就定义里有 `group` 字段，官阶阶梯、升迁次数、
   属性档位这些本来就是同一组的多个档位。把它们合并成"达到最高档即解锁"，
   既能砍到 100 以内，对玩家的观感也更好（少一堆 5/10/15 次的重复条目）。
2. **裁掉低价值的行为统计类成就**：`first_choice`（100 次都选第一个选项）、
   `random_player`、`careful_player`、`saver`（存档 30 次）这类条目，
   更容易让玩家觉得是在"刷指标"而不是在体验游戏，可以优先去掉。
3. 拆成第二个 app —— **不推荐**，会带来双份的商店页、审核与玩家困惑。

> 另外提醒：`desktop/steam.cjs` 的映射表是由 `src/types/achievement.ts` 推导出来的。
> 如果你调整了成就定义（增删改 id），必须重跑 `node desktop/smoke-test.cjs`
> —— 它会断言映射表与游戏内定义**逐条一致**，漂移了就会失败。

---

## 四、技术层面的发布前检查清单
| 检查项 | 状态 | 备注 |
| --- | --- | --- |
| `tsc --noEmit` 通过 | ✅ | 严格模式，`noUnusedLocals` 开启 |
| 生产构建通过 | ✅ | Vite + terser，按年份/类型分片 |
| **单元测试（vitest）** | ✅ | 19 例覆盖引擎的读档恢复、升迁/贬官判定、临界事件调度、投骰并发 |
| 端到端冒烟测试 | ✅ | `npm run test:e2e`（真实 Chromium） |
| 多分辨率布局回归 | ✅ | 9 档视口，断言无横向溢出且主按钮在首屏内 |
| **CI 拦截** | ✅ | 类型检查（含测试）→ 单元测试 → 构建 → 口令门防线，任一失败即不部署 |
| 无外部 CDN 依赖 | ✅ | 字体已自托管；可选 AI 功能才访问外网 |
| 相对路径（`file://` 可用） | ✅ | `base: './'` |
| 口令门彻底移除 | ✅ | 源码与构建产物均已确认 |
| 调试面板对玩家隐藏 | ✅ | 仅开发构建或 `?debug=1` 可见 |
| 无 `console.error` 泄漏 | ✅ | 冒烟测试断言 |
| 生产构建保留 `console.error`/`warn` | ✅ | 移除了原来的全量 `drop_console`，便于线上排障 |
| PWA / 安装图标 | ✅ | manifest + 6 个图标，路径均为相对 |
| SEO / 社交分享 | ✅ | og:image、twitter card、canonical、robots、sitemap |
| 可访问性（键盘可达、对话框语义） | ✅ | 统一 `useModal` 钩子；存档槽位、骰子交互键盘可达 |
| 存档格式版本与迁移 | ✅ | `SAVE_SCHEMA_VERSION = 3`，旧存档自动升级 |
| 存档写入失败不再静默 | ✅ | 派发 `chongzhen-storage-error` 并弹窗提示 |
| Electron 打包配置 | 🟡 | 配置就绪，**未在真实 Windows 机器上产出安装包验证**（见 §5） |
| 崩溃上报 | ❌ | 未接入。建议后续加 Sentry（需 `sourcemap: 'hidden'`） |
| 成就/云存档 ↔ 游戏内打通 | 🟡 | 接入层与 mock 驱动就绪，但**游戏内成就解锁尚未真正调用 Steam API** |
| 多语言 | ❌ | 仅简体中文。Steam 全球发行建议至少英文 |

---

## 五、我未能验证的部分（如实说明）

### 5.1 已验证的部分

桌面层并非"只写了配置、没跑过"：

- `node --check` 通过：`main.cjs` / `preload.cjs` / `steam.cjs` / `steam/upload.mjs`
- **mock 驱动已实测**：`desktop/verify-mock-fallback.cjs` 用 `Module._load` 劫持
  强制制造 `MODULE_NOT_FOUND`，确认 `require` 与 `initSteam()` 都不抛异常，
  返回 `{ available: false, driver: 'mock', appId: 480, error: 'steamworks.js 加载失败…' }`
- `desktop/smoke-test.cjs` **24 项断言通过**：成就幂等、未知 id 拒绝、云存档读写与列举、
  `../escape.json` 路径穿越被拦截、跨进程持久化、重复 `shutdown()` 安全、
  105 个 API Name 全部合法且无重复内部 id
- `steamworks.js` 的依赖已实测安装成功（electron 33.4.11 / electron-builder 25.1.8 /
  steamworks.js 0.3.2），并**按真实类型定义修正了代码**：云存档列举是
  `cloud.listFiles()`（不是猜的 `getFileCount`），`init()` 本身已自带 30Hz 回调泵
- `upload.mjs` 用假的 steamcmd 桩跑通了完整流程，并**修掉一个真实 Bug**：
  Node 20+ 无法直接 `spawn` `.cmd`/`.bat`（CVE-2024-27980 的缓解措施会报 EINVAL），
  而 Windows 上的 steamcmd 有时正是 `.cmd` 包装脚本
- 上传脚本的 `SetLive` 默认留空，**首次上传不会自动发布**，需要你手动点 Set Build Live

### 5.2 未能验证的部分

1. **Electron 安装包未实际产出并运行。** 关键原因是沙箱阻止了 Electron 二进制下载
   （`EPERM` on `AppData\Local\electron\Cache`），因此 `electron.exe` 不存在，
   `npm run dev` / `npm run pack` / `npm run dist` **从未被真正执行过**。
   发布前你必须在一台 Windows 机器上执行：
   ```powershell
   npm run build                 # 仓库根目录
   cd desktop
   npm install
   npm run dist                  # 产出 release/ 下的安装包
   ```
2. **Steamworks 真实驱动未运行。** 本机没有 Steam 客户端，`steamworks.js` 能加载但
   `init()` 会抛 `Could not determine Steam client install directory.`。
   拿到 AppID 后，建议先用测试 ID `480`（Spacewar）验证成就与云存档通路。
3. **CSP 未在运行时确认生效。** `onHeadersReceived` 注入逻辑已写好，但需要在真实启动后
   用 DevTools 复核一遍。
4. **`extraResources: ../dist → web` 的复制未端到端验证**（构建产物当时不存在）。
   代码里的开发/打包路径分支是对称且带注释的，但没跑过。
5. **未做长时间/多周目实机试玩。** 数值平衡、事件覆盖率、结局达成率都需要你自己玩通几遍。
   仓库里有 `scripts/audit-events.ts` 与 `validate-events.ts` 可以做内容侧体检。
6. **本评估基于 Steam 的公开规则与惯例，不构成法律意见。** 版权与内容分级请以正式渠道为准。

---

## 六、建议的推进顺序

1. **决定 §3.1 的内容方案**（这一步决定了整个项目能不能上 Steam，其他都是次要的）
2. **确认 §3.2 的素材授权** —— 尤其是 BGM，这是最容易在发行后被投诉的地方
3. 注册 Steamworks 账号，拿到 AppID
4. 在 Windows 上跑通 `npm run dist`，实机验收桌面版
5. 按 `desktop/steam/DEPOT_CHECKLIST.md` 配置后台与成就
6. 制作商店页物料
7. 提交审核（Valve 通常需要 5 个工作日以上，首次可能更久）

> 第 1 步没解决之前，第 3–7 步的投入都有归零的风险。
