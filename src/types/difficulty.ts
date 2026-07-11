export type DifficultyLevel = 'easy' | 'normal' | 'hard'

export interface DifficultyConfig {
  id: DifficultyLevel
  name: string
  description: string
  // 属性变化系数
  attributeMultiplier: number
  // 政绩分变化系数
  meritScoreMultiplier: number
  // 升官所需政绩分系数
  promotionThresholdMultiplier: number
  // 随机事件难度
  eventDifficulty: number
  // 国势衰减速度
  countryPowerDecay: number
}

export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  easy: {
    id: 'easy',
    name: '简单模式',
    description: '适合新手，属性获得更容易，升官门槛更低',
    attributeMultiplier: 1.5,
    meritScoreMultiplier: 1.3,
    promotionThresholdMultiplier: 0.8,
    eventDifficulty: 0.7,
    countryPowerDecay: 0.5
  },
  normal: {
    id: 'normal',
    name: '普通模式',
    description: '标准难度，平衡的游戏体验',
    attributeMultiplier: 1.0,
    meritScoreMultiplier: 1.0,
    promotionThresholdMultiplier: 1.0,
    eventDifficulty: 1.0,
    countryPowerDecay: 1.0
  },
  hard: {
    id: 'hard',
    name: '困难模式',
    description: '富有挑战性，属性获得更难，升官门槛更高',
    attributeMultiplier: 0.7,
    meritScoreMultiplier: 0.8,
    promotionThresholdMultiplier: 1.3,
    eventDifficulty: 1.5,
    countryPowerDecay: 1.5
  }
}

export const DEFAULT_DIFFICULTY: DifficultyLevel = 'normal'

export function loadDifficulty(): DifficultyLevel {
  try {
    const data = localStorage.getItem('chongzhen_difficulty')
    if (data && ['easy', 'normal', 'hard'].includes(data)) {
      return data as DifficultyLevel
    }
  } catch (e) {
    console.error('Failed to load difficulty:', e)
  }
  return DEFAULT_DIFFICULTY
}

export function saveDifficulty(difficulty: DifficultyLevel): void {
  try {
    localStorage.setItem('chongzhen_difficulty', difficulty)
  } catch (e) {
    console.error('Failed to save difficulty:', e)
  }
}

export function getDifficultyConfig(difficulty: DifficultyLevel): DifficultyConfig {
  return DIFFICULTY_CONFIGS[difficulty]
}
