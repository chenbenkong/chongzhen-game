# 已知问题与后续工作

> 本文件记录**本次优化中已确认、但未修复**的问题，以及需要人工验收的项。
> 目的是让继任者不必重新审计一遍，也避免把"已知缺陷"误当成"已解决"。
>
> 每一项都标注了严重度、证据位置、影响范围，以及**为什么本次没有修**。

---

## 一、尚未修复的问题

### K-1 · 中 · `setState` 更新函数里带副作用（仅开发期可见）

**位置**：`src/hooks/useGameEngine.ts`，`handleNextMonth` 内部的 `setGameState(prev => ...)` 更新函数
（约 1100–1180 行区间，含 `setCharacter` 增龄、`setTimeout` 调度、`checkBoundaryEvent` 调用、
`setCurrentEvent` / `setPendingEvents` / `setEventHistory`）。

**问题**：React 18 的 `StrictMode` 在**开发构建**下会重复调用更新函数以暴露不纯的代码。
这里更新函数里既改了别的 state，又起了 300ms 定时器随机挑选事件，于是开发时会看到：
事件 id 重复入历史、年龄加两次、两个并发的定时器挑出不同事件互相覆盖。

**为什么本次没有修**：**这只在开发构建下发生。** `vite build` 会把
`process.env.NODE_ENV` 定为 `production`，StrictMode 的双调用被禁用，因此**不影响玩家**。
而修它需要把这几处副作用整体重构成"先同步算出下一状态，再一次性 set，副作用移到外面"，
对一个 1800 行、缺乏测试覆盖的核心引擎来说，这一步的风险明显高于收益。

**建议做法**：先补一个针对 `handleNextMonth` 的单元测试（把事件选择与随机数注入为可替换的依赖），
再动手重构。

---

### K-2 · 中 · 临界事件只在挂载时检查一次

**位置**：`src/hooks/useGameEngine.ts` 挂载 effect（约 1468–1520 行）里的危机临界事件检查。

**问题**：`boundary_serious_illness` 一类「危机」事件只在组件挂载时以 30% 概率判定，
游戏中途属性掉到危险区不会触发。

**为什么本次没有修**：这属于**数值设计决策**而不只是缺陷——多久检查一次、概率多少、
是否会打断当前事件流，都会改变游戏体验。需要设计者先定规则。

---

### K-3 · 中 · 读档未恢复 `lifeRecords` / `playTime` 的部分路径

**位置**：`src/hooks/useGameEngine.ts` 的 `loadSaveData` 初始化 effect。

**问题**：部分读档路径没有恢复 `lifeRecords` 与 `playTime`，会出现"上一局的生平记录混进来"。
当前被 `GameScreen` 的重新挂载掩盖了大部分情况，所以不易复现。

**为什么本次没有修**：需要先能稳定复现，否则改了无法验证。建议先写一个"存档→读档→比对全字段"
的自动化测试（`tests/` 里已有真实浏览器环境，扩展成本低）。

---

### K-4 · 中 · 升迁/贬官判定的依赖数组不完整

**位置**：`src/hooks/useGameEngine.ts` 约 1754 行的 `useEffect` 依赖数组。

**问题**：判定的 effect 依赖里缺了 `体质`、`hidden.野心值`、`gameState.国势`、`degree`，
而判定逻辑内部读取了它们，因此这些字段变化时可能漏判一次升迁/贬官。

**为什么本次没有修**：与 K-1 同属核心引擎的敏感改动。补齐依赖会让判定触发得更频繁，
需要先确认这不会导致数值失衡。

---

### K-5 · 中 · 骰子动画的定时器未清理

**位置**：`src/components/EventDisplay.tsx` 骰点相关逻辑（约 573–649 行）。
`src/components/DiceAnimation.tsx` 的 80ms `setInterval`。

**问题**：定时器未在卸载时清理，也没有"投掷中"的并发保护。理论上双击或事件切换时
可能把 `onChoice` 应用到下一个事件上。本次已让动画时长在 `prefers-reduced-motion` 下归零
（见 `src/utils/motion.ts`），但**未加并发保护**。

**为什么本次没有修**：改骰子时序会牵动"投骰成功/失败 → 应用哪套 effects"的分支，
需要在真实浏览器里反复验证。建议下一步单独处理，并在 `tests/` 里加一个双击场景的回归。

---

### K-6 · 低 · 成就数据是模块级单例

**位置**：`src/types/achievement.ts` 的 `currentAchievementData`。

**问题**：成就数据以模块级变量保存，读写都作用于同一个对象。这是一处共享可变状态，
将来若引入多周目并行或回放功能会出问题。

**本次已缓解**：新游戏时现在会调用 `setAchievementData({ unlocked: [], unlockTimes: {} })`
清空（此前不清，导致上一局成就被写进新存档）；读档路径也统一恢复成就数据。

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

## 三、本次已修复的主要问题（索引）

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
- 存档格式无版本号、无迁移 —— 已引入 `SAVE_SCHEMA_VERSION = 2`
- 仓库内 30 MB 开发过程产物 —— 已清理
