# 已知问题与后续工作

> 本文件记录**已确认、但尚未修复**的问题，以及需要人工验收的项。
> 目的是让继任者不必重新审计一遍，也避免把"已知缺陷"误当成"已解决"。
>
> 前三轮修复之后，2026-10-04 又做了第四轮（面向交付的整改），
> 摘要见 [STEAM_RELEASE.md](STEAM_RELEASE.md) §2。
> 本轮新增的未修复项见下方 §1.1。

---

## 一、尚未修复的问题

### 1.1 · 本轮新增 · 首屏 46 个 JS 分片全部预取（性能，未修）

**位置**：`src/data/events/index.ts`、`vite.config.js` 的 `manualChunks`。

**现状**：Vite 把 17 个历史年份 + 18 个过渡年份各自分包，
而 `events/index.ts` 静态 import 全部，于是首屏一次性预取 **1.36MB / 46 个 JS 请求**。
实测线上 FCP 1.34s（本地 112ms，差异来自网络往返）。

**为什么没修**：改成按年份懒加载需要把同步的事件挑选改成异步，
会大幅改动 `useGameEngine` 核心，风险明显高于收益；
而且桌面版（Steam 的实际发行形态）跑在本地磁盘上，这个成本根本不存在。

**触发条件**：如果将来要继续优化首屏，更划算的方向是**先合并年份分片数量**
（例如把 17 个历史年份合成 4~5 个），而不是改引擎的异步模型。

### 1.2 · 本轮新增 · 长周目性能只做了推理、未做实测

本轮把引擎热路径从 O(n×m) 改成 O(n+m)（见 STEAM_RELEASE §2.6），
所以**理论上**不再随存档变老而劣化。但实测只覆盖了"单次推进月份"
（P99 16.8ms），**没有**跑一个长存档（200+ 条 `eventHistory`）来对比帧率。
这是推理，不是实测。

**建议验收方式**：用幽灵模式跳到 1644 年，积累大量事件历史后，
连续推进 12 个月并记录帧间隔。

### 1.3 · 遗留 · 成就数据仍是模块级共享状态（结构性重构未做）

**位置**：`src/types/achievement.ts` 的 `currentAchievementData`。

**现状**：成就数据仍保存在一个模块级变量里，而不是随 `SaveData` 传递。

**已解决的部分 —— 引用别名与退役 id 清理**：
原来 `setAchievementData` 直接按引用保存调用方的对象、`loadAchievements` 也按引用返回
内部对象，于是任何调用方的一次就地修改都会污染全局成就状态，而且完全不会报错。
现在读写边界上都做防御性拷贝；本轮又在同一个函数里加上了
`RETIRED_ACHIEVEMENT_IDS` 的剔除（已删除的成就不能留在旧存档里）。
行为由 `tests/unit/achievement.store.test.ts`（6 例）与
`achievement.steamLimit.test.ts`（8 例）钉住。

**仍未解决的部分**：模块级单例本身。它的实际影响只出现在
"同时存在多个成就消费者"的场景（多周目并行、回放、成就对比面板），
而当前游戏在任何时刻都只有一个引擎实例，因此这不构成现实缺陷。

**为什么不做完整重构**：把成就数据并入 `SaveData` 意味着
`unlockAchievement` / `checkAndUnlockAchievements` 都要改成由调用方传入并回传数据，
而它们目前被 `endingSystem`（不持有引擎状态）与多个组件直接调用。
这是一次横跨 4 个模块的改动，风险明显高于它现在能带来的收益。
**触发条件**：一旦真的要做多周目并行或回放，再动它。

---

## 二、需要人工验收的项

| 项 | 为什么无法自动验收 | 建议验收方式 |
| --- | --- | --- |
| Electron 安装包 | 需要真实 Windows 桌面环境与 GUI | 在 Windows 上跑 `npm run desktop:dist`，双击安装包完整玩一局 |
| Steamworks 真实驱动 | 需要原生模块 + 真实 Steam 客户端 + AppID | 用测试 AppID `480`（Spacewar）先验证成就与云存档通路 |
| 数值平衡 | 属于主观体验 | 各难度各通关 2–3 遍，观察升迁曲线与结局分布 |
| 事件覆盖率 | 需要大量游玩 | 跑 `npx tsx scripts/audit-events.ts` 与 `validate-events.ts` 做内容侧体检 |
| 成人内容角色年龄 | 无法从文本可靠推断 | **人工通读** `src/data/events/gray/debauchery/` 全部文本 |
| BGM / 美术授权 | 不在代码里 | 追溯素材来源，保留授权凭证 |

---

## 三、已修复的问题（按轮次索引）

回归测试共 **54 例**，分 12 个文件，全部在 `tests/unit/`。

### 第四轮：面向交付的整改

| 缺陷 | 回归测试 |
| --- | --- |
| **CI 跑 Node 20，`undici@8.11.2` 需要 ≥22.19** → 连续 3 次部署失败、Pages 静默停在 4 个提交之前 | `scripts/check-node-engine.cjs`（CI 第一步）+ 已验证部署恢复 |
| 5 个结局成就只补进游戏内、漏登记 Steam 映射表 | `desktop/smoke-test.cjs` §6b（直接解析源码逐条对拍） |
| 成就数 110 > Steam 上限 100 | `achievement.steamLimit.test.ts`（3 例） |
| 已删除的成就 id 残留在旧存档里，会让 collector / legendary_master 提前达成 | `achievement.steamLimit.test.ts`（5 例） |
| `ending_collection_15` 已删但测试仍在断言它解锁 | `achievement.endingCollection.test.ts`（改为断言"不再出现"） |
| 首次进入强制弹出 8 页教程 | `tests/smoke.mjs` 进游戏链路 + 人工确认 |
| `pickEvent` 里"最近 5 条"被误改为"全部已见"，会永久耗尽支线事件 | `noUnusedLocals` 报错时人工发现（已改回原语义） |
| `vitest.config.js` 无法 merge 回调形式的 `vite.config.js` | `npm run test:unit` 直接失败 |

### 第三轮：测试驱动修复 K-1 / K-7 / K-8

| 原编号 | 缺陷 | 回归测试 |
| --- | --- | --- |
| K-1a | 投骰链路把第二级定时器排在 `setState` 更新函数**内部** | `eventDisplay.dice.test.tsx`（StrictMode 用例） |
| **新发现** | 事件切换后，旧事件的投骰结算仍会落地 | 同上（切事件用例） |
| K-1b | `handleNextMonth` 的更新函数里带 4 处副作用 | `engine.strictMode.test.ts`（2 例） |
| K-7 | 人物志取"最早 8 条"关键事件，把后半生整段丢掉 | `endingSystem.keyRecords.test.ts`（3 例） |
| K-7 | 结局收藏成就统计单局 `eventHistory`，恒为 0；且 5 个结局没有对应成就 | `achievement.endingCollection.test.ts`（7 例） |
| K-7 | `random_player` 无达成入口，只能靠 `deadByDesign` 排除 | `eventDisplay.randomChoice.test.tsx`（4 例） |
| K-8 | 标题层级跳级（`h2→h4`）、两屏缺 `h1`、两条死 CSS 规则 | 构建 + 冒烟 + 人工看图 |

几个值得记录的细节：

- **K-1a / K-1b 为什么算真缺陷，而不只是"开发期噪音"**：
  React 的更新函数必须是纯的。StrictMode 在开发构建下会重复调用它，并发渲染下也可能重放。
  投骰那条路径的后果是 **`onChoice` 被调用两次** —— 它是永久生效的（属性扣减、人生记录
  写进存档），重复调用等于把同一个选择的后果应用两遍。`handleNextMonth` 那条则是
  事件 id 重复写进历史、年龄加两次、两个定时器互相抢事件。
  两个缺陷都用 StrictMode 稳定复现了出来（投骰：`expected 1, got 2`；
  推进月份：`eventHistory` 出现重复 id）。
- **K-1a 的重构顺带暴露了第二个缺陷**：把"排定时器"移出更新函数后，
  "切到下一个事件后旧结算仍会落地"这条用例立刻失败。此前它是**空过**的 ——
  因为二级定时器排在更新函数里，切事件把 `choice` 重置为 null 后更新函数提前返回，
  定时器根本没被排上。这属于"靠巧合掩盖"，不是有意设计的守卫。
  现在改为在事件切换时显式取消所有在飞的投骰定时器。
- **K-7 的第二个子项是本轮最有价值的发现**：把 `src/data` 与引擎里所有 `ending_*`
  事件 id 拉出来与成就对照，发现 **34 个结局里有 5 个没有对应成就**
  （`ending_debauchery_001` / `ending_scholar_martyr` / `ending_fugitive` /
  `ending_bankrupt` / `ending_demotion`）。后果是这 5 个结局**永远无法写进结局图鉴**，
  图鉴进度也就永远到不了 100%；而且「百味人生」要求 30 个，可收集的只有 29 个 ——
  数学上不可达。已补齐 5 个成就，并加了两条防回归断言：
  "每个结局事件都要有对应成就"与"可收集结局数 ≥ 最高档门槛"。
- **K-7 的第三个子项是补功能而非改判据**：`random_player`（随机选择 50 次）原本
  没有任何达成入口，只能标记 `deadByDesign` 排除在全收集判定之外。这轮在选项列表下方
  加了「听 天 由 命」按钮（只从**可选**的选项里随机挑，锁定项不会被选中），
  它同时是 `randomChoiceCount` 的唯一自增点。动机是让成就可达而不是删掉内容 ——
  计数、统计字段与成就定义本来就都在，缺的就是那个入口。
- **K-8 的边界**：`OriginSelect` 的 `h4` 一度被我误列入清单（基于 grep），
  实际它的结构是 `h2 → h3 → h4`，本来就连贯。真正的问题只有两处：
  取名/铨选两屏以 `h2` 作顶层标题（缺 `h1`），以及游戏界面的面板标题用 `h4`
  而同级面板用 `h3`。现在整棵树是连续的：
  取名 `h1→h2`、铨选 `h1→h2→h3`、游戏界面 `h1(事件)→h2(各面板)`。
  顺带删掉两条指向不存在元素的死 CSS 规则（`.desc-section h4` / `.history-panel h4`）。

### 第二轮：测试驱动修复 K-2 / K-3 / K-4

| 原编号 | 缺陷 | 回归测试 |
| --- | --- | --- |
| K-3 | 读档未恢复 `lifeRecords`；`playTime` 没有 setter、恒为 0 | `loadSaveRestore.test.ts`（2 例） |
| K-4 | 升迁/贬官判定依赖数组缺 4 个字段 | `engine.promotionDeps.test.ts`（2 例） |
| **新发现** | 降级理由持续存在时会重复累加贬官次数与生平记录 | `engine.promotionDeps.test.ts`（1 例） |
| K-2 | `crisis` 类临界事件只在挂载时检查一次 → 死内容 | `engine.boundary.test.ts`（2 例） |
| K-5 | 投骰定时器未清理（可观察行为本身是对的，见下） | `eventDisplay.dice.test.tsx`（7 例） |

- **K-3**：`playTimeRef` 原本是**从 state 反向同步**的，若把累计值写进 ref，
  下一次 state 变化就会把它冲掉。修复的关键是反转方向 —— ref 为准、state 只作 UI 镜像，
  并用 `getTotalPlayTime()`（累计值 + 未折算的当前区间）写存档，避免每次都丢几秒。
- **K-4**：刻意**没有**把 `character.rank` 加进依赖数组。rank 会被贬官/升官本身改写，
  加进去会形成「贬官 → rank 变 → 重新判定 → 再贬」的自激循环。
- **K-5 的结论需要更正**：原审计称"没有飞行中的并发保护"。实测下来
  `isRolling` 状态本身就是守卫（骰子区与底部按钮都会据此禁用/短路），
  React 也会丢弃已卸载组件的状态更新，所以**可观察行为本来就是正确的** ——
  7 个回归测试在修复前后都通过。真正剩下的是定时器卫生，已改为统一登记、卸载时清空。

### 第一轮：审计驱动修复

完整清单见 [STEAM_RELEASE.md](STEAM_RELEASE.md) 的 §2.4。摘要：

- 贬官机制因 `RANKS.findIndex` 缺少 `.reverse()` 而完全失效 —— 已修复
- 手动存档丢失正在进行的事件 —— 已修复
- 重开一局未重置角色与事件历史 —— 已修复
- `机敏值` / `忠诚值` 未定义导致 NaN 污染存档、条件判定前后矛盾 —— 已补为正式属性并加迁移
- `flags.any` / `none` / `all` 与 `conditions.rank` / `conditions.random` 未实现 —— 已实现
- 12 个成就读取未提供的上下文字段、1 个成就数学上不可达 —— 已修复
- 调试面板「幽灵模式」对全部玩家可见（剧透全部事件与结局）—— 一度按开关隐藏，
  **后经所有者决定改回默认常驻可见**（详见第五节「刻意保留的设定」）
- `localStorage` 配额耗尽时自动存档静默失败 —— 已改为明确提示
- 48 处 CSS 硬编码字体族绕过 fallback 链 —— 已统一为 CSS 变量
- `prefers-reduced-motion` 未重置 `animation-delay` —— 已修复
- `LifeReview` 380px 网格轨道导致所有手机横向溢出 —— 已修复
- `App.css` 整段重复 `TitleScreen.css`（含两处冲突的 `.title-quote`）—— 已删除
- 存档格式无版本号、无迁移 —— 已引入 `SAVE_SCHEMA_VERSION = 3`
- 仓库内 30 MB 开发过程产物 —— 已清理

---

## 四、测试基座本身踩到的坑

记录在 `tests/unit/README.md`，这里只列要点：

1. **Node 26 内置的实验性 `localStorage` 会覆盖 jsdom 的实现**。现象极具迷惑性：
   jsdom 明明加载成功（`window` / `document` / navigator 都正常，UA 也是 `jsdom/30.x`），
   但 `localStorage` 是 `undefined`，引擎一读存档就抛
   `Cannot read properties of undefined (reading 'getItem')`。
   已在 `setup.ts` 装符合 Storage 规范的内存实现（含 `length` 与 `key(i)`）。
2. **`Math.random` 必须固定**，否则事件挑选、掷骰、临界事件判定都会让用例随机失败。
3. **等待时间要覆盖引擎的调度定时器**。`handleNextMonth` 只在 300ms 的 `setTimeout`
   里才挑事件、写历史；`advanceMonths` 早先只等 30ms，导致针对"事件历史是否重复"
   的断言其实什么都没测到。
4. **`vi.runAllTimers()` 只跑一轮是不够的**。投骰的第二级定时器是在 `setState`
   更新函数里排的，而 React 要等 act 这一轮结束才执行更新函数 ——
   只跑一轮时第二级定时器还没排上，用例会**空过**。必须
   「跑定时器 → 让 React flush → 再跑」交替若干轮。

---

## 五、刻意保留的设定（不是遗漏，请勿"顺手修掉"）

### 1. 调试面板「幽灵模式」的默认值由构建模式决定

**现状**：`src/utils/debug.ts` 的兜底返回值不再是硬编码 `true`，
而是构建期注入的常量 `__DEBUG_PANEL_DEFAULT__`（`vite.config.js` 里 define）：

| 构建命令 | 用在哪 | 默认 |
| --- | --- | --- |
| `npm run build` | GitHub Pages 演示站、本地 preview | **开启** |
| `npm run build:steam` | Electron / Steam 发行物（`desktop:dist` 会自动先跑它） | **关闭** |

**为什么这么设计**：这个面板能改属性、跳年份，并直接浏览**全部事件与全部结局**
（含未解锁结局），对玩家是彻底剧透 —— 商业发行不允许默认暴露。
但它同时是项目所有者本人的开发/试玩工具，演示站上确实需要。

如果只用"改源码里那行 `return true`"的做法，会有两个真实风险：
忘了改回来就发行了剧透面板；或者反复切换时改错了方向。
**按构建模式区分**让两边都不需要改代码 —— 一条命令决定，且可被 CI 验证。

**逃生口**：`?debug=0` 隐藏（会记住），`?debug=1` 恢复，任何构建都有效。

**回归保护**：CI 会实跑一次 `npm run build:steam`；
`tests/unit/debugSwitch.test.ts` 钉住 `?debug=` 与 localStorage 的优先级。

### 2. `pickEvent` 里"最近 5 条"不能用 `seen` 集合替代

**现状**：判定支线事件"最近是否出现过"时用的是 `eventHistory.slice(-5)`，
而不是全部已触发历史。

**原因**：支线事件（情感线 / 权色线）**设计上就是可重复的** —— 玩家会反复遇到
同一段关系或同一桩买卖。若改成"排除全部已见"，支线会被永久耗尽。
本轮改造 `pickEvent` 性能时踩过这个坑，是 `noUnusedLocals` 报错
（`recent` 变量不再被使用）才暴露出来的。

**不要"顺手优化"掉那两处 `new Set(eventHistory.slice(-5))`。**
