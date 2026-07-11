export type OriginType = '寒门' | '缙绅' | '没落世家' | '诗文清望'

export type ExamStage = 
  | '县试'
  | '府试'
  | '院试'
  | '乡试'
  | '会试'
  | '殿试'

export type DegreeType = '童生' | '秀才' | '举人' | '贡士' | '进士'

export type FactionType = '东林党' | '齐楚浙党' | '中间派' | '复社' | '阉党' | '农民军' | '清朝'

export type PlayerFaction = '东林' | '阉党' | '中间' | '未定'

export interface FactionState {
  东林好感: number   // 0-100, 东林党对你的评价
  阉党好感: number    // 0-100, 阉党/权贵集团对你的评价
  立场: PlayerFaction // 当前公开立场
  党争烈度: number    // 0-100, 当前朝堂党争激烈程度
}

// ============================================
// 核心属性系统 - 全部 0-100 范围
// ============================================

// 【个人能力】五大能力
export interface Attributes {
  财帛: number  // 财富资源（抽象值，不等同银两）
  文韬: number  // 文学才华、谋略
  理政: number  // 政务处理能力
  武略: number  // 军事指挥能力
  体质: number  // 身体健康
}

// 【隐藏属性】三大心性 - 四档制评价
export interface HiddenAttributes {
  道德值: number  // 品德操守（>75君子 >50正直 >25常人 ≤25小人）
  欲望值: number  // 欲望程度（>75强烈 >50一般 >25淡泊 ≤25清心）
  野心值: number  // 权力野心（>75勃勃 >50有 >25微 ≤25无）
}

// 【五方态度】四档制评价
export interface GameStateValues {
  currentYear: number
  currentMonth: number
  turn: number
  // 五方态度（全部 0-100）
  圣眷: number  // 皇帝态度（>75圣宠 >50受宠 >25平常 ≤25失宠）
  中官: number  // 宦官态度（>75心腹 >50亲近 >25中立 ≤25敌视）
  清议: number  // 清流评价（>75东林 >50清流 >25孤立 ≤25孤立）
  士绅: number  // 士绅态度（>75拥戴 >50支持 >25中立 ≤25反对）
  民望: number  // 百姓评价（>75爱戴 >50称颂 >25平淡 ≤25怨声）
  国势: number
}



// ============================================
// 角色数据
// ============================================

export interface OriginData {
  type: OriginType
  name: string
  tags: string[]
  background: string
  initialAttributes: Attributes
  initialHidden: HiddenAttributes
  initialGameState?: Partial<Omit<GameStateValues, 'currentYear' | 'currentMonth' | 'turn'>>
  features: string[]
  playStyle: string
  examBonus: Partial<Attributes>
  initialRank?: string
  initialDegree?: string
}

export interface Character {
  name: string
  /** 字（表字）。开局取名时由系统按姓名自动生成，玩家可改 */
  courtesyName: string
  /** 籍贯。开局取名时玩家可自填或随机抽取 */
  hometown: string
  age: number
  origin: OriginType
  rank: string
  degree: DegreeType
  attributes: Attributes
  hidden: HiddenAttributes
  flags: string[]
  history: string[]
  wives: Wife[]
  lovers: Lover[]
  examHistory: ExamRecord[]
  promotionCount: number  // 升迁次数
  demotionCount: number   // 贬官次数
  faction: FactionState   // 派系状态
}

// ============================================
// 生平记录系统
// ============================================

export interface LifeRecord {
  id: string
  year: number
  month: number
  type: 'birth' | 'exam' | 'promotion' | 'demotion' | 'event' | 'choice' | 'death' | 'marriage' | 'relation'
  title: string
  description: string
  impact?: string
  attributesChange?: Partial<Attributes>
  gameStateChange?: Partial<GameStateValues>
  hiddenChange?: Partial<HiddenAttributes>
  relatedCharacters?: string[]
  relatedEvent?: string
}

export interface LifeSummary {
  totalRecords: number
  keyEvents: LifeRecord[]
  finalTitle: string
  finalRank: string
  reputation: string
  legacy: string
  lifespan: { start: number; end: number }
  achievements: string[]
  controversies: string[]
}

export interface ExamRecord {
  stage: ExamStage
  year: number
  passed: boolean
  score?: number
  ranking?: number
}

export interface Wife {
  name: string
  type: '正妻' | '妾室'
  relationship: number
}

export interface Lover {
  name: string
  type: string
  relationship: number
}

export const STATE_MAP = {
  圣眷: '圣眷',
  清议: '清议',
  中官: '中官',
  民望: '民望',
  国势: '国势'
} as const;
