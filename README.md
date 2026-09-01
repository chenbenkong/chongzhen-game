# 崇祯 · 宦海浮沉模拟器（chongzhen-game）

> 以明末崇祯朝（1628–1644）为舞台的文字向宦海人生模拟器：从科举童生一路摸爬到朝堂大员，在党争、边患、天灾与流寇之间做出你的抉择，最后由《青史》为你写下一卷。

## 项目简介

本项目是一款纯前端的历史题材角色扮演 / 人生模拟游戏（设计文档中的原名为「崇祯直聘」，成品定名「崇祯·宦海浮沉模拟器」）。

游戏以真实的明末时间轴推进：从崇祯元年（1628）到崇祯十七年（1644），逐年逐月触发历史事件与个人事件。玩家选定出身后取名、定字、择籍贯，先在科举体系里一级级考（县试 → 府试 → 院试 → 乡试 → 会试 → 殿试），拿到功名后进入官场，在**东林党 / 阉党 / 中间派**的党争夹缝中经营人际、处理政务、应对边关与灾荒，同时被五种能力属性、三种隐藏心性、五方态度共同评判。

角色可能升迁、贬官、致仕、下狱乃至身死；国势也会随大势衰减。游戏结束时会生成一份**生平回顾**与结局判定，收入八卷《结局图鉴》。

美术与排版走明式风格：深墨底（`#0A0807`）、羊皮纸色文字、金线点缀，标题使用毛笔字体「马善政」，正文使用「Noto Serif SC」。

## 功能特性

### 角色与成长

- **四种出身**：寒门、缙绅、没落世家、诗文清望，各带不同初始属性、特色标签、玩法倾向与科举加成
- **取名系统**：姓名 + 表字（自动按姓名生成，可改）+ 籍贯（可填可随机）
- **科举系统**：六级考试 → 五等功名（童生 / 秀才 / 举人 / 贡士 / 进士）
- **官阶与政绩**：政绩分驱动升迁，记录升迁次数与贬官次数

### 属性系统（全部 0–100）

| 分组 | 属性 |
| --- | --- |
| 个人能力 | 财帛、文韬、理政、武略、体质 |
| 隐藏心性 | 道德值、欲望值、野心值（四档评价，如 >75 君子 / >50 正直 / >25 常人 / ≤25 小人） |
| 五方态度 | 圣眷、中官、清议、士绅、民望（另有国势） |

- 党争状态独立建模：东林好感、阉党好感、公开立场、党争烈度
- 属性临界值会触发专门的「临界事件」（`boundaryEvents.ts` + `BoundaryEventManager`），详见 `docs/属性临界值与游戏结束机制.md`

### 事件系统

事件按类型分目录组织，规模较大（`src/data/events/`）：

| 目录 | 内容 |
| --- | --- |
| `historical/` | 1628–1644 逐年历史事件 + 历史人物事件 |
| `transition/` | 逐年过渡事件、序章、路线引导、1644 关键节点 |
| `gray/` | 灰色抉择事件（道德灰区的两难选择） |
| `emotion/` | 情感线事件（妻妾、红颜） |
| `origin/` | 出身专属事件 |
| `faction/` | 派系事件 |
| `ending/` | 结局事件 |

- 事件带条件判定（`eventConditions.ts`）、骰点动画（`DiceAnimation`）与多分支后果
- 15 条故事线可推进：东林风云、边关狼烟、忠烈千秋、贪墨风云、林泉隐逸、商海浮沉、家业绵延、悬壶济世、中兴之梦、异闻怪谭、红颜相伴、灰色地带、权谋之术、天崩地坼、烟火人间

### 结局与档案

- **结局图鉴**（`EndingCodex`）按八卷分类收藏：仕林卷、忠烈卷、隐逸卷、贰臣卷、浮沉卷、朝局卷、个志卷、异闻卷
- **生平回顾**（`LifeReview`）汇总出生、科举、升迁、贬官、婚姻、抉择、死亡等 `LifeRecord`
- **成就系统**（`AchievementPanel` + `AchievementUnlock`）内置 100+ 条成就定义
- **死亡结局**独立呈现（`DeathEnding`）

### 系统与体验

- **三档难度**：简单 / 普通 / 困难，分别调整属性倍率、政绩倍率、升迁门槛、事件难度与国势衰减速度
- **存档**：多存档槽（`SaveSlotsModal`，`localStorage` key `chongzhen_save_slot_N`）+ 自动存档（`chongzhen_autosave`）+ 存档提示（`SaveNotification`）
- **BGM**：内置背景音乐（`public/bgm.mp3`），带音乐上下文与开关组件
- **新手教程**：`TutorialModal`
- **调试 / 秘籍模式**：`CheatMode`（体量较大的开发者面板）
- **错误边界**：`ErrorBoundary` 兜底崩溃
- **移动端适配**：iOS 全屏 Web App meta、`viewport-fit=cover`、禁用点击高亮
- **首屏防白屏**：内联关键 CSS + 加载动画占位，主应用挂载后通过 `app-ready` 事件移除

### AI 增强（可选，需自备 API Key）

- **谋士对谈**（`AIAdvisor` + `services/aiService.ts`）：把当前年月、身份、属性、局势摘要作为上下文交给大模型，扮演谋士与你商议
- **场景插图生成**（`ImageGenerator` + `services/imageService.ts` + `eventPromptGenerator.ts`）：为事件自动生成配图提示词并调用文生图接口，支持 1K–4K 与 8 种宽高比，结果通过 `imageStorage.ts` 本地留存
- Key 读取优先级：`localStorage.chongzhen_ai_apikey` → 构建期环境变量 `VITE_AI_API_KEY`；未配置时相关入口不可用，主线游戏不受影响

### 质量保障脚本

- `scripts/` 下有事件审计（`audit-events.ts`）、叙事质量审计（`audit-narrative-quality.ts`）、事件校验（`validate-events.ts`）、事件拆分与标签修复等 TS 工具
- 根目录 `e2e-*.cjs` / `verify-*.cjs` 为一系列基于浏览器自动化的端到端脚本，覆盖存档、自动存档、布局、主题、性能、标题页等场景

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | React 18 |
| 语言 | TypeScript 5 |
| 构建 | Vite 5 + `@vitejs/plugin-react` |
| 样式 | 原生 CSS（CSS 变量主题，按组件拆分 `.css`） |
| 压缩优化 | terser + lightningcss |
| 代码分析 | ts-morph（脚本侧） |
| AI 接口 | OpenAI 兼容的对话 / 文生图接口（Agnes） |
| 持久化 | `localStorage` |
| 部署 | GitHub Actions → GitHub Pages |

## 目录结构

```
chongzhen-game/
├── index.html                    # 入口（含内联首屏样式与访问口令门）
├── src/
│   ├── main.tsx / App.tsx        # 应用入口
│   ├── App.css / index.css / theme.css
│   ├── components/               # 约 30 个组件（各配同名 CSS）
│   │   ├── TitleScreen / NameInput / OriginSelect      # 开局流程
│   │   ├── GameScreen / EventDisplay / ActionBar       # 主玩法
│   │   ├── AttributePanel / StatusBar / StatusPanel / StorylineBar
│   │   ├── SaveSlotsModal / SaveNotification           # 存档
│   │   ├── AchievementPanel / AchievementUnlock        # 成就
│   │   ├── EndingCodex / GameOverScreen / DeathEnding / LifeReview
│   │   ├── AIAdvisor / ImageGenerator / EventImages     # AI 功能
│   │   ├── BGM / BGMContext / DiceAnimation / Icon
│   │   └── TutorialModal / CheatMode / ErrorBoundary / ConfirmDialog ...
│   ├── data/
│   │   ├── events/               # 事件库：historical/transition/gray/emotion/origin/faction/ending
│   │   ├── origins.ts            # 四种出身
│   │   ├── storylines.ts         # 15 条故事线
│   │   ├── boundaryEvents.ts     # 属性临界事件
│   │   └── boundaryEventCompiler.ts
│   ├── hooks/
│   │   ├── useGameEngine.ts      # 核心游戏引擎（回合推进、事件调度、结算）
│   │   └── useConfirm.tsx
│   ├── services/
│   │   ├── aiService.ts          # 谋士对谈
│   │   ├── imageService.ts       # 场景插图生成
│   │   ├── imageStorage.ts       # 插图本地存储
│   │   ├── eventPromptGenerator.ts
│   │   └── BoundaryEventManager.ts
│   ├── types/                    # game / event / save / achievement / difficulty / boundaryEvent
│   └── utils/                    # endingSystem / eventConditions / naming / constants / performance
├── public/
│   ├── bgm.mp3                   # 背景音乐
│   ├── title-bg.webp             # 标题背景
│   ├── cover-landscape.webp      # 封面
│   └── token-stats.html / token-usage.json / file-tree.html
├── docs/
│   ├── 事件设计指南.md
│   └── 属性临界值与游戏结束机制.md
├── CODE_WIKI.md                  # 代码结构说明
├── 崇祯直聘_完整游戏设计文档_V3_属性系统统一版.md   # 完整设计文档
├── 灰色事件完整回音文档.txt / events_with_echo.md   # 事件回音设计稿
├── scripts/                      # 事件审计 / 校验 / 拆分等工具脚本
├── e2e-*.cjs, verify-*.cjs       # 端到端与回归验证脚本
├── vite.config.js
└── .github/workflows/deploy.yml  # Pages 自动部署
```

## 本地运行

**前置要求：** Node.js 18+（CI 使用 Node 20）

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 生产构建（先 tsc 类型检查，再 vite build）
npm run build

# 本地预览构建产物
npm run preview
```

### 配置 AI 功能（可选）

两种方式任选其一：

1. **运行时配置**：在游戏内「谋士对谈」面板填入 API Key，会存到 `localStorage.chongzhen_ai_apikey`
2. **构建期注入**：根目录新建 `.env.local`

```bash
echo "VITE_AI_API_KEY=你的_API_KEY" > .env.local
```

> 不配置也能完整通关，仅「谋士对谈」与「场景插图生成」不可用。

## 在线演示

https://chenbenkong.github.io/chongzhen-game/

**注意：线上版本设有一道访问口令门**，进入后需先输入访问密码（口令逻辑写在 `index.html` 中，校验通过会把 `cz_ok` 记入 `localStorage`，之后免输）。

推送到 `main` 分支后，`.github/workflows/deploy.yml` 会执行 `npx vite build --base=./` 并发布到 Pages；AI Key 通过仓库 Secret `VITE_AI_API_KEY` 注入（未设置则线上 AI 功能不可用）。

## 说明 / 备注

- **纯前端单机游戏**：没有服务端与账号系统，进度全部存在浏览器 `localStorage`。清理浏览器数据或换设备会丢失存档。
- **访问口令仅为前端遮挡**：`index.html` 里的口令校验是客户端逻辑，只用于给线上演示加一层轻量门槛，**不具备任何安全性**，请勿当作真实鉴权。
- **AI 功能会消耗第三方额度**：谋士对谈与插图生成依赖外部 OpenAI 兼容接口。插图生成单次通常需要 30–120 秒（客户端超时设为 120s）。
- **仓库含大量开发过程产物**：根目录留有截图（`*.png`）、构建日志（`build_out.txt`、`tsc*_out*.txt`、`vite-*.txt`）、`tmp/` 下的 bundle 分析文件等，体积较大但与运行无关，克隆时注意仓库尺寸。
- **历史内容以叙事为主**：事件基于明末史实改编，但为了游戏性做了简化与虚构，不应作为史料参考。
- **字体依赖外部 CDN**：标题与正文字体从 `fonts.loli.net` / Google Fonts 加载，离线或网络受限时会回退到系统宋体 / 楷体。
