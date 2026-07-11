import { Attributes, HiddenAttributes, GameStateValues } from './game'

export type LegacyAttributes = {
  文辩?: number
  朝政?: number
  名望?: number
  权势?: number
  机敏?: number
  道德?: number
  道德值?: number
  民望?: number
  理政?: number
  圣眷?: number
} & Partial<Record<keyof Attributes, number>>

export type LegacyGameState = {
  帝心?: number
  国势?: number
  派系立场?: number
  百姓口碑?: number
  地方治安?: number
  地方经济?: number
  地方教化?: number
  商贾?: number
  安全?: number
  军事?: number
  道德?: number
  文化?: number
  军心?: number
  权势?: number
  财帛?: number
  理政?: number
} & Partial<Record<keyof GameStateValues, number>>

export type LegacyAttributeConditions = {
  文辩?: { min?: number; max?: number }
  朝政?: { min?: number; max?: number }
  名望?: { min?: number; max?: number }
  权势?: { min?: number; max?: number }
  机敏?: { min?: number; max?: number }
  军事?: { min?: number; max?: number }
  政绩?: { min?: number; max?: number }
  圣眷?: { min?: number; max?: number }
  民望?: { min?: number; max?: number }
  道德值?: { min?: number; max?: number }
} & Partial<Record<keyof Attributes, { min?: number; max?: number }>>

export type LegacyGameStateConditions = {
  帝心?: { min?: number; max?: number }
  国势?: { min?: number; max?: number }
  派系立场?: { min?: number; max?: number }
  百姓口碑?: { min?: number; max?: number }
  地方治安?: { min?: number; max?: number }
  地方经济?: { min?: number; max?: number }
  地方教化?: { min?: number; max?: number }
  商贾?: { min?: number; max?: number }
  安全?: { min?: number; max?: number }
  军事?: { min?: number; max?: number }
  道德?: { min?: number; max?: number }
  文化?: { min?: number; max?: number }
  军心?: { min?: number; max?: number }
  权势?: { min?: number; max?: number }
  理政?: { min?: number; max?: number }
} & Partial<Record<keyof GameStateValues, { min?: number; max?: number }>>

export interface EventConditions {
  year?: { min?: number; max?: number }
  month?: { min?: number; max?: number }
  rank?: string | string[]
  origin?: string | string[]
  attributes?: LegacyAttributeConditions
  hidden?: Partial<Record<keyof HiddenAttributes | '机敏值' | '忠诚值', { min?: number; max?: number }>>
  gameState?: LegacyGameStateConditions
  flags?: { has?: string[]; notHas?: string[]; any?: string[]; none?: string[]; all?: string[]; some?: string[] }
  charactersAlive?: string[]
  charactersDead?: string[]
  historicalFlags?: Record<string, string>
  random?: number
  relationships?: Record<string, { min?: number; max?: number }>
  custom?: (ctx: any) => boolean
}

export interface EventEffects {
  attributes?: LegacyAttributes
  hidden?: Partial<Record<keyof HiddenAttributes | '机敏值' | '忠诚值', number>>
  gameState?: LegacyGameState
  flags?: { add?: string[]; remove?: string[] }
  relationships?: Record<string, number>
  family?: Record<string, number>
  nextEvents?: string[]
  special?: { type: 'death' | 'promotion' | 'imprisonment' | 'exile' | 'ending'; value?: string }
  meritScore?: number
}

export interface NarrativeSpeaker {
  name: string
  title: string
  avatar?: string
}

export interface EventNarrative {
  speaker?: NarrativeSpeaker
  quote?: string
  background: string
  situation: string
}

export interface ChoiceResult {
  title?: string
  tags?: string[]
  echo: string
}

export interface DiceCheck {
  attribute: string
  difficulty: number
  reason: string
  penaltyEffect?: EventEffects
}

export interface EventChoice {
  id: string
  text: string
  quote?: string
  description?: string
  showConditions?: EventConditions
  effects: EventEffects
  resultDescription?: string
  result?: ChoiceResult
  // 投骰失败的副作用和结果（可选，若未提供则默认生成）
  failEffects?: EventEffects
  failResultDescription?: string
  failResult?: ChoiceResult
  check?: DiceCheck
  staminaCost?: number
  staminaRequired?: number
  staminaBonus?: number
  condition?: ((ctx: any) => boolean) | EventConditions
}

export type EventType = 'normal' | 'historical' | 'random' | 'chain' | 'ending' | 'transition' | 'gray' | 'emotion' | 'character' | 'national' | 'faction'

export interface EndingConfig {
  /** 结局大类：personal_fate=个人命运 / ming_fate=大明国运 / official=官员系 / martyr=殉国系 / villain=反派系 / hermit=隐世系 / gray=灰色线 / special=特殊 */
  category: 'personal_fate' | 'ming_fate' | 'official' | 'martyr' | 'villain' | 'hermit' | 'gray' | 'special'
  /** 结局品级：legendary=传奇 / saintly=圣贤 / bittersweet=苦乐参半 / tragic=悲剧 / dark=黑暗 / controversial=争议 / mysterious=神秘 / redemptive=救赎 */
  tier: 'legendary' | 'saintly' | 'bittersweet' | 'tragic' | 'dark' | 'controversial' | 'mysterious' | 'redemptive'
  /** 联动成就 ID（结局达成时自动解锁） */
  unlocksAchievement?: string
  /** 结局前奏事件 ID（提前一个月播放的过渡事件） */
  preludeEventId?: string
}

export interface GameEvent {
  id: string
  title: string
  description: string
  narrative?: EventNarrative
  conditions: EventConditions
  choices: EventChoice[]
  type: EventType
  endingConfig?: EndingConfig
  /** 结局前奏事件标记：true=这是某结局的 preludes（强制优先播放） */
  isPreEnding?: boolean
  /** 关联的结局 ID（prelude 用，标识此 prelude 指向哪个结局） */
  linksToEndingId?: string
  /** 所属剧情线 ID（用于事件管理器加权推荐，见 src/data/storylines.ts） */
  storyline?: string
  /** 本事件完成后，下一次/几次事件管理器应优先触发的事件 ID 列表 */
  nextEvents?: string[]
}
