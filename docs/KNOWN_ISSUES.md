# 已知问题与后续工作

> 本文件记录**已确认、但尚未修复**的问题，以及需要人工验收的项。
> 目的是让继任者不必重新审计一遍，也避免把"已知缺陷"误当成"已解决"。
>
> 每一项都标注了严重度、证据位置、影响范围，以及**为什么没有修**。
>
> 第二轮（测试驱动）已把 K-2 / K-3 / K-4 修掉，并顺带发现并修复了一个此前未知的
> 贬官级联缺陷。修复过程与回归测试见 §三。

---

## 一、尚未修复的问题

### K-1 · 中 · `setState` 更新函数里带副作用（仅开发期可见）

**位置**：`src/hooks/useGameEngine.ts`，`handleNextMonth` 内部的 `setGameState(prev => ...)` 更新函数
（约 1100–1180 行区间，含 `setCharacter` 增龄、`setTimeout` 调度、`checkBoundaryEvent` 调用、
`setCurrentEvent` / `setPendingEvents` / `setEventHistory`）。

**问题**：React 18 的 `StrictMode` 在**开发构建**下会重复调用更新函数以暴露不纯的代码。
这里更新函数里既改了别的 state，又起了 300ms 定时器随机挑选事件，于是开发时会看到：
事件 id 重复入历史、年龄加两次、两个并发的定时器挑出不同事件互相覆盖。

> 同一类问题也存在于 `src/components/EventDisplay.tsx` 的投骰链路：
> 一级 `setTimeout` 的回调里调 `setDiceModal(updater)`，而**那个 updater 内部**又排了第二级
> `setTimeout` 去结算。它正是 `tests/unit/eventDisplay.dice.test.tsx` 里必须
> 「跑定时器 → 让 React flush → 再跑定时器」交替多轮的原因（详见该文件的说明注释）。

**为什么没有修**：**这只在开发构建下发生。** `vite build` 会把
`process.env.NODE_ENV` 定为 `production`，StrictMode 的双调用被禁用，因此**不影响玩家**。
而修它需要把这几处副作用整体重构成"先同步算出下一状态，再一次性 set，副作用移到外面"。
现在已经有 `tests/unit/` 这层保护，重构的可行性比之前高了不少。

**建议做法**：先补一个针对 `handleNextMonth` 的完整行为测试（断言推进 N 个月后事件历史
无重复 id、年龄只增一次），再动手重构。

---

### K-6 · 低 · 成就数据是模块级单例

**位置**：`src/types/achievement.ts` 的 `currentAchievementData`。

**问题**：成就数据以模块级变量保存，读写都作用于同一个对象。这是一处共享可变状态，
将来若引入多周目并行或回放功能会出问题。

**已缓解**：新游戏时会调用 `setAchievementData({ unlocked: [], unlockTimes: {} })` 清空
（此前不清，导致上一局成就被写进新存档）；读档路径也统一恢复成就数据。

**建议做法**：把成就数据并入 `SaveData` 并只通过引擎读写，去掉模块级单例。

---

### K-7 · 低 · 若干文案/统计口径问题

- `endingSystem.ts` 的传记取 `lifeRecords.slice(0, 8)`（最早 8 条），
  而总结取 `slice(-10)`（最近 10 条），两者口径不一致。
- 若干成就按"结局出现次数"计数而非"不同结局数"，因此重复达成同一结局也会累加。
- `playTime` 只有初值，没有递增逻辑，所以存档预览里的游玩时长恒为 0。
- `random_player` 成就**在游戏中没有任何达成路径**：全仓库找不到"随机选择选项"的
  UI 入口（`EventDisplay` 只有普通选择与投骰成功率判定，没有随机选项）。
  已在 `achievement.ts` 标记 `deadByDesign: true`，避免日后被误当成 Bug 排查。
  若要让它可达，需要新增一个"听天由命"按钮并接到 `randomChoiceCount`。
- `ending_collection_5/15/30` 同样标记为 `deadByDesign`：它们统计
  `eventHistory` 里 `ending_` 前缀的条目数，但该历史是**每局独立**的，
  而 `handleGameOver` 是在把结局 id 压入历史**之前**调用 `checkAchievements()`，
  且一局只会走到第一个结局，因此计数永远 ≤1。它们的原始解锁条件保留不变，
  标记只是把这三个从 `legendary_master` 的全收集门槛里排除掉。

**为什么本次没有修**：前三条是展示层的小问题，改动需要顺带确认 UI 上的呈现方式；
后两条需要一个新交互（随机选项）或一次事件系统的语义调整，都属于"要不要做"的产品决定，
不是缺陷修复。

---

### K-8 · 低 · 少量标题层级仍有跳级

已修复：`EndingCodex` 的对话框标题由 `div` 改为 `h2`（现在该对话框有真正的标题元素
供 `aria-labelledby` 引用）；`NameInput` 的 `h2 → h4` 跳级改为 `h2 → h3`。

**仍未处理**（都是 `h2`/`h1` 直接跳到 `h4`）：

- `OriginSelect.tsx:53` `<h4>出身特性</h4>`、`:67` `<h4>初始属性</h4>`（前面是 `h2`）
- `GameScreen.tsx:266` `<h4>{identityTitle}</h4>`、`:298` `<h4>政 绩 评 定</h4>`

**为什么本次没有修**：改成 `h3` 会改变 UA 默认的 `margin` 与 `font-size`，
需要同时给对应 CSS 补重置才能保证像素不变；而这几处的实际无障碍影响很小
（屏幕阅读器只是报出的层级数字不连续，不影响导航）。收益低于回归风险，
因此记录下来而不是顺手改掉。若要做，请连同各组件 CSS 里的 `h4` 选择器一起调整为 `h3`
并补 `margin-top: 0`。

> 另注：`GameOverScreen` 渲染时与仍在挂载的 `EventDisplay` 存在的"两个 h1"
> 问题**已经解决**——游戏主体被 `aria-hidden="true"` + `inert` 包裹后
> 已从无障碍树中移除。

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

## 三、已修复的主要问题（索引）

### 第二轮：测试驱动修复（先写失败测试，再改代码）

这一轮先在 `tests/unit/` 搭起 vitest + jsdom 的引擎测试基座，然后对每个缺陷
**先写一个会失败的测试、确认它因正确的原因失败、再动代码**。四个都验证过
"修复前失败 / 修复后通过"。

| 原编号 | 缺陷 | 回归测试 |
| --- | --- | --- |
| K-3 | 读档未恢复 `lifeRecords`；`playTime` 没有 setter、恒为 0 | `loadSaveRestore.test.ts`（2 例） |
| K-4 | 升迁/贬官判定依赖数组缺 4 个字段 | `engine.promotionDeps.test.ts`（2 例） |
| **新发现** | 降级理由持续存在时会重复累加贬官次数与生平记录 | `engine.promotionDeps.test.ts`（1 例） |
| K-2 | `crisis` 类临界事件只在挂载时检查一次 → 死内容 | `engine.boundary.test.ts`（2 例，含反向守卫） |
| K-5 | 投骰定时器未清理（可观察行为本身是正确的，见下） | `eventDisplay.dice.test.tsx`（7 例） |

几个值得记录的细节：

- **K-3**：`playTimeRef` 原本是**从 state 反向同步**的，若把累计值写进 ref，
  下一次 state 变化就会把它冲掉。修复的关键是反转方向——ref 为准、state 只作 UI 镜像，
  并用 `getTotalPlayTime()`（累计值 + 未折算的当前区间）写存档，避免每次都丢几秒。
- **K-4**：刻意**没有**把 `character.rank` 加进依赖数组。rank 会被贬官/升官本身改写，
  加进去会形成「贬官 → rank 变 → 重新判定 → 再贬」的自激循环。
- **K-4 顺带发现的新缺陷**：`checkDemotion` 用「政绩分推导出的档位」当基准算目标官阶，
  而目标官阶只取决于分数。于是某条理由持续成立时（例如体质长期低于 15），
  每次判定都算出同一个目标官阶——官阶并没有再降，但贬官次数一次次 +1、
  「贬官一级」的生平记录一条条堆积。现实里依赖项几乎每月都在变，所以这是会真的发生的。
  改为与角色**当前实际官阶**比较后修复。
- **K-5 的结论需要更正**：原审计称"没有飞行中的并发保护"。实测下来
  `isRolling` 状态本身就是守卫（骰子区与底部按钮都会据此禁用/短路），
  React 也会丢弃已卸载组件的状态更新，所以**可观察行为本来就是正确的**——
  7 个回归测试在修复前后都通过。真正剩下的是**定时器卫生**：
  投骰的二级定时器是在 `setState` 更新函数内部排下的，卸载时不会被清理。
  已改为统一登记、卸载时一并清空。这一项没有可观察行为差异，因此没有"失败测试"可写，
  如实记录以免被误认为经过了测试驱动验证。
- **测试基座本身踩到的坑**：Node 26 内置的实验性 `localStorage` 会覆盖 jsdom 的实现
  （jsdom 明明加载成功，但 `localStorage` 是 `undefined`）。处理方式与理由见
  `tests/unit/README.md`。

### 第一轮：审计驱动修复

完整清单见 [STEAM_RELEASE.md](STEAM_RELEASE.md) 的 §2.4。摘要：

- 贬官机制因 `RANKS.findIndex` 缺少 `.reverse()` 而完全失效 —— 已修复
- 手动存档丢失正在进行的事件 —— 已修复
- 重开一局未重置角色与事件历史 —— 已修复
- `机敏值` / `忠诚值` 未定义导致 NaN 污染存档、条件判定前后矛盾 —— 已补为正式属性并加迁移
- `flags.any` / `none` / `all` 与 `conditions.rank` / `conditions.random` 未实现 —— 已实现
- 12 个成就读取未提供的上下文字段、1 个成就数学上不可达 —— 已修复
- 调试面板「幽灵模式」对全部玩家可见（剧透全部事件与结局）—— 已按开关隐藏
- `localStorage` 配额耗尽时自动存档静默失败 —— 已改为明确提示
- 48 处 CSS 硬编码字体族绕过 fallback 链 —— 已统一为 CSS 变量
- `prefers-reduced-motion` 未重置 `animation-delay` —— 已修复
- `LifeReview` 380px 网格轨道导致所有手机横向溢出 —— 已修复
- `App.css` 整段重复 `TitleScreen.css`（含两处冲突的 `.title-quote`）—— 已删除
- 存档格式无版本号、无迁移 —— 已引入 `SAVE_SCHEMA_VERSION = 3`
- 仓库内 30 MB 开发过程产物 —— 已清理
