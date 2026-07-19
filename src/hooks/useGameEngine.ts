import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Character, GameStateValues, OriginType, DegreeType, Attributes, LifeRecord, LifeSummary, PlayerFaction } from '../types/game'
import { GameEvent, EventChoice } from '../types/event'
import { SaveData, saveSaveSlot, loadSaveSlot, saveAutosave } from '../types/save'
import { checkAndUnlockAchievements, loadAchievements, Achievement, AchievementContext } from '../types/achievement'
import { DifficultyLevel, getDifficultyConfig } from '../types/difficulty'
import { initialEvents, allGrayChoiceEvents } from '../data/events/index'
import { origins } from '../data/origins'
import { boundaryEventManager } from '../services/BoundaryEventManager'
import '../data/boundaryEvents'
import { triggerEndingAchievements, generateBiography } from '../utils/endingSystem'
import { ATTR_MAP, STATE_MAP, ATTR_BOUNDS } from '../utils/constants'
import { checkEventConditions, pickEvent } from '../utils/eventConditions'

// 身份类型
type IdentityType = 'official' | 'civilian' | 'rebel' | 'exiled' | 'retired'

// 官职体系 - 按明朝官制，每级差100分
// 主角从正七品知县开始，初始分530分
export const RANKS = [
  { level: 1, name: '从九品·司狱', minScore: 0, type: 'official' as IdentityType },
  { level: 2, name: '正九品·主簿', minScore: 50, type: 'official' as IdentityType },
  { level: 3, name: '从八品·县丞', minScore: 100, type: 'official' as IdentityType },
  { level: 4, name: '正八品·照磨', minScore: 150, type: 'official' as IdentityType },
  { level: 5, name: '从七品·判官', minScore: 200, type: 'official' as IdentityType },
  { level: 6, name: '正七品·知县', minScore: 250, type: 'official' as IdentityType },
  { level: 7, name: '从六品·通判', minScore: 320, type: 'official' as IdentityType },
  { level: 8, name: '正六品·同知', minScore: 390, type: 'official' as IdentityType },
  { level: 9, name: '从五品·知州', minScore: 460, type: 'official' as IdentityType },
  { level: 10, name: '正五品·郎中', minScore: 530, type: 'official' as IdentityType },
  { level: 11, name: '从四品·少卿', minScore: 600, type: 'official' as IdentityType },
  { level: 12, name: '正四品·知府', minScore: 670, type: 'official' as IdentityType },
  { level: 13, name: '从三品·侍郎', minScore: 740, type: 'official' as IdentityType },
  { level: 14, name: '正三品·大理寺卿', minScore: 810, type: 'official' as IdentityType },
  { level: 15, name: '从二品·布政使', minScore: 880, type: 'official' as IdentityType },
  { level: 16, name: '正二品·尚书', minScore: 950, type: 'official' as IdentityType },
  { level: 17, name: '从一品·少师', minScore: 1020, type: 'official' as IdentityType },
  { level: 18, name: '正一品·太师', minScore: 1100, type: 'official' as IdentityType }
]

// 升官缓冲分：每升一级额外加20分，防止刚升官就贬官
const PROMOTION_SCORE_BONUS = 20

// 计算政绩分 - 基于基础分加上属性变化的影响
// 主角从正七品知县开始，基础分280分（250基准 + 30缓冲）
const BASE_MERIT_SCORE = 280

// 重要事件类型，会有额外政绩分加成
const IMPORTANT_EVENT_TYPES = ['historical', 'ending']

export interface UseGameEngineProps {
  origin: OriginType
  degree: DegreeType
  bonusAttributes: Attributes
  playerName?: string
  playerCourtesyName?: string
  playerHometown?: string
  playerCustomAge?: number | null
  loadSaveData?: SaveData
  difficulty: DifficultyLevel
  onReturnToMenu?: () => void
}

// 出身特性修正：属性效果
function applyOriginModifier(origin: OriginType, attrKey: string, value: number): number {
  if (origin === '寒门') {
    if (attrKey === '文韬' && value > 0) return Math.round(value * 1.15)
  }
  if (origin === '缙绅') {
    if (attrKey === '财帛' && value > 0) return Math.round(value * 1.1)
    if (attrKey === '理政' && value > 0) return Math.round(value * 1.1)
  }
  if (origin === '没落世家') {
    if (attrKey === '武略' && value > 0) return Math.round(value * 1.2)
    if (attrKey === '文韬' && value > 0) return Math.round(value * 0.8)
  }
  if (origin === '诗文清望') {
    if (attrKey === '文韬' && value > 0) return Math.round(value * 1.25)
    if (attrKey === '武略' && value > 0) return Math.round(value * 0.7)
  }
  return value
}

// 出身特性修正：五方态度效果
function applyOriginStateModifier(origin: OriginType, stateKey: string, value: number): number {
  if (origin === '寒门') {
    if (stateKey === '清议') return Math.round(value * 1.5)
    if (stateKey === '士绅' && value > 0) return Math.round(value * 0.7)
  }
  if (origin === '缙绅') {
    if (stateKey === '士绅' && value > 0) return Math.round(value * 1.2)
    if (stateKey === '圣眷' && value > 0) return Math.round(value * 0.9)
  }
  if (origin === '没落世家') {
    if (stateKey === '中官' && value > 0) return Math.round(value * 1.15)
    if (stateKey === '清议' && value > 0) return Math.round(value * 0.8)
  }
  if (origin === '诗文清望') {
    if (stateKey === '清议' && value > 0) return Math.round(value * 1.25)
    if (stateKey === '中官' && value > 0) return Math.round(value * 0.7)
  }
  return value
}

function calculateMeritScore(
  character: Character,
  gameState: GameStateValues,
  baseScore: number = BASE_MERIT_SCORE,
  eventType?: string,
  isImportant: boolean = false
): number {
  const attrs = character.attributes
  let score = baseScore

  if (character.degree === '进士') {
    score += 60
  } else if (character.degree === '举人') {
    score += 30
  }

  score += (attrs.理政 - 50) * 1.2
  score += (attrs.文韬 - 50) * 0.9
  score += (attrs.武略 - 50) * 0.7
  score += (gameState.圣眷 - 50) * 0.9
  score += (gameState.民望 - 50) * 0.8

  if (isImportant || (eventType && IMPORTANT_EVENT_TYPES.includes(eventType))) {
    score += 80
  }

  return Math.floor(score)
}

function checkPromotion(currentScore: number, previousScore: number): { promoted: boolean; newRank?: string; message?: string; scoreBonus?: number } {
  const currentRankIndex = RANKS.slice().reverse().findIndex(r => currentScore >= r.minScore)
  const previousRankIndex = RANKS.slice().reverse().findIndex(r => previousScore >= r.minScore)
  const actualCurrentIndex = RANKS.length - 1 - currentRankIndex
  const actualPreviousIndex = RANKS.length - 1 - previousRankIndex

  if (actualCurrentIndex > actualPreviousIndex) {
    const newRank = RANKS[actualCurrentIndex]
    return {
      promoted: true,
      newRank: newRank.name,
      message: `恭喜！你因政绩卓著，被擢升为${newRank.name}！`,
      scoreBonus: PROMOTION_SCORE_BONUS
    }
  }
  return { promoted: false }
}

type DemotionReason =
  | '名望过低'
  | '道德败坏'
  | '帝心尽失'
  | '政绩不佳'
  | '党争失败'
  | '贪墨被查'
  | '失职渎职'
  | '民怨沸腾'
  | '才疏学浅'
  | '结党营私'
  | '言辞失当'
  | '体弱多病'
  | '财政亏空'
  | '办事不力'
  | '得罪权贵'
  | '清议不容'
  | '政绩下滑'

function checkDemotion(
  currentScore: number,
  previousScore: number,
  character: Character,
  gameState: GameStateValues
): {
  demoted: boolean;
  newRank?: string;
  message?: string;
  reason?: DemotionReason;
  newIdentity?: IdentityType;
} {
  const currentRankData = RANKS.find(r => r.name === character.rank)
  const currentRankBaseScore = currentRankData?.minScore ?? 500

  const reasons: { condition: boolean; reason: DemotionReason; severity: number; message: string }[] = [
    {
      condition: currentScore < currentRankBaseScore,
      reason: '政绩不佳',
      severity: 1,
      message: `政绩分低于${currentRankBaseScore}分，不足以胜任${character.rank}，考核不合格`
    },
    {
      condition: character.hidden.道德值 <= 0,
      reason: '道德败坏',
      severity: 3,
      message: '道德败坏，丧尽天良，天人共愤'
    },
    {
      condition: gameState.圣眷 < 10,
      reason: '帝心尽失',
      severity: 2,
      message: '圣上震怒，龙颜不悦，失宠于上'
    },
    {
      condition: character.attributes.理政 < 15,
      reason: '政绩不佳',
      severity: 1,
      message: '政绩平庸，碌碌无为，不堪其任'
    },
    {
      condition: character.hidden.欲望值 > 75 && character.attributes.财帛 > 70 && character.hidden.道德值 < 30,
      reason: '贪墨被查',
      severity: 3,
      message: '贪墨受贿，中饱私囊，东窗事发'
    },
    {
      condition: gameState.国势 < 25 && character.attributes.武略 < 30 && character.attributes.理政 < 40,
      reason: '失职渎职',
      severity: 2,
      message: '国势衰微，武备废弛，政务弛懈，失职渎职'
    },
    {
      condition: character.attributes.文韬 < 25,
      reason: '才疏学浅',
      severity: 1,
      message: '才疏学浅，文章不通，难堪大任'
    },
    {
      condition: character.hidden.野心值 > 70 && gameState.圣眷 < 40,
      reason: '结党营私',
      severity: 2,
      message: '结党营私，图谋不轨，圣心猜忌'
    },
    {
      condition: gameState.士绅 > 75 && gameState.圣眷 < 25,
      reason: '得罪权贵',
      severity: 2,
      message: '功高震主，树大招风，遭人构陷'
    },
    {
      condition: character.attributes.体质 < 15,
      reason: '体弱多病',
      severity: 2,
      message: '体弱多病，难以视事，被责令养病'
    },
    {
      condition: character.attributes.财帛 < 15 && character.hidden.欲望值 > 60 && character.hidden.道德值 < 35,
      reason: '财政亏空',
      severity: 1,
      message: '家资匮乏而贪欲不减，行止不检，被御史参劾'
    },
    {
      condition: gameState.圣眷 < 30 && character.attributes.理政 < 40,
      reason: '办事不力',
      severity: 1,
      message: '办事不力，屡出差错，上峰不满'
    },
    {
      condition: character.hidden.道德值 < 0 && gameState.清议 > 50,
      reason: '清议不容',
      severity: 1,
      message: '清议攻讦，士林非议，被迫请辞'
    },
    {
      condition: gameState.民望 < 20 && gameState.圣眷 < 40,
      reason: '言辞失当',
      severity: 1,
      message: '言辞失当，触怒龙颜，被贬外放'
    },
    {
      condition: previousScore - currentScore > 80,
      reason: '政绩下滑',
      severity: 1,
      message: '政绩大幅下滑，考核不合格，降级留用'
    }
  ]

  const triggeredReasons = reasons.filter(r => r.condition)

  if (triggeredReasons.length > 0) {
    const worstReason = triggeredReasons.sort((a, b) => b.severity - a.severity)[0]
    const currentRankIndex = RANKS.findIndex(r => currentScore >= r.minScore)
    const previousRankIndex = RANKS.findIndex(r => previousScore >= r.minScore)
    let demotionLevels = worstReason.severity

    if (worstReason.severity >= 3) {
      return {
        demoted: true,
        newRank: '革职查办',
        message: `【革职】${worstReason.message}，你被革职查办，贬为庶民！`,
        reason: worstReason.reason,
        newIdentity: 'exiled'
      }
    }

    const newRankIndex = Math.max(0, currentRankIndex - demotionLevels)
    const newRank = RANKS[newRankIndex]

    if (newRankIndex < previousRankIndex) {
      return {
        demoted: true,
        newRank: newRank.name,
        message: `【贬官】${worstReason.message}，你被贬为${newRank.name}！`,
        reason: worstReason.reason,
        newIdentity: 'official'
      }
    }
  }

  return { demoted: false }
}

function createInitialCharacter(
  originType: OriginType,
  deg: DegreeType,
  attrs: Attributes,
  playerName?: string,
  playerCourtesyName?: string,
  playerHometown?: string,
  playerCustomAge?: number | null
): Character {
  const originData = origins[originType]
  const hidden = originData.initialHidden
  const defaultAge = deg === '进士' ? 22 : deg === '举人' ? 24 : 16 + Math.floor(Math.random() * 6)
  const initialAge = (playerCustomAge != null && playerCustomAge >= 16) ? playerCustomAge : defaultAge

  const tempCharacter: Character = {
    name: playerName || '',
    courtesyName: playerCourtesyName || '',
    hometown: playerHometown || '',
    age: initialAge,
    origin: originType,
    rank: '',
    degree: deg,
    attributes: { ...attrs },
    hidden: hidden,
    flags: deg === '进士' ? ['地方官任职'] : [],
    history: [],
    wives: [],
    lovers: [],
    examHistory: [],
    promotionCount: 0,
    demotionCount: 0,
    faction: {
      东林好感: 50,
      阉党好感: 50,
      立场: '未定' as PlayerFaction,
      党争烈度: 30
    }
  }

  tempCharacter.rank = '正七品·知县'
  return tempCharacter
}

export function useGameEngine(props: UseGameEngineProps) {
  const {
    origin,
    degree,
    bonusAttributes,
    playerName,
    playerCourtesyName,
    playerHometown,
    playerCustomAge,
    loadSaveData,
    difficulty,
    onReturnToMenu
  } = props

  const difficultyConfig = useMemo(() => getDifficultyConfig(difficulty), [difficulty])

  const [character, setCharacter] = useState<Character>(() => {
    if (loadSaveData) {
      const char = loadSaveData.character
      const flags = char.degree === '进士' && !char.flags.includes('地方官任职')
        ? [...char.flags, '地方官任职']
        : char.flags
      return {
        ...char,
        courtesyName: char.courtesyName || '',
        hometown: char.hometown || '',
        flags,
        faction: char.faction || {
          东林好感: 50,
          阉党好感: 50,
          立场: '未定',
          党争烈度: 30
        }
      }
    }
    return createInitialCharacter(origin, degree, bonusAttributes, playerName, playerCourtesyName, playerHometown, playerCustomAge)
  })

  const [gameState, setGameState] = useState<GameStateValues>(() => {
    if (loadSaveData) {
      const oldState = loadSaveData.gameState
      return {
        currentYear: oldState.currentYear,
        currentMonth: oldState.currentMonth,
        turn: oldState.turn,
        圣眷: (oldState as any).帝心 ?? oldState.圣眷 ?? 50,
        中官: (oldState as any).中官 ?? 50,
        清议: (oldState as any).派系立场 ?? oldState.清议 ?? 50,
        士绅: (oldState as any).百姓口碑 ?? oldState.士绅 ?? 50,
        民望: (oldState as any).百姓口碑 ?? oldState.民望 ?? 50,
        国势: oldState.国势 ?? 75
      }
    }
    const originData = origins[origin]
    const initialGameStateFromOrigin = originData.initialGameState || {}
    return {
      currentYear: 1628,
      currentMonth: 1,
      turn: 0,
      圣眷: initialGameStateFromOrigin.圣眷 ?? 50,
      中官: initialGameStateFromOrigin.中官 ?? 50,
      清议: initialGameStateFromOrigin.清议 ?? 50,
      士绅: initialGameStateFromOrigin.士绅 ?? 50,
      民望: initialGameStateFromOrigin.民望 ?? 50,
      国势: 75
    }
  })

  const [currentEvent, setCurrentEvent] = useState<GameEvent | null>(null)
  const [pendingEvents, setPendingEvents] = useState<GameEvent[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [eventHistory, setEventHistory] = useState<string[]>(() => loadSaveData ? loadSaveData.eventHistory : [])
  const [undoHistory, setUndoHistory] = useState<Array<{ character: Character; gameState: GameStateValues; eventHistory: string[] }>>([])

  const initialScoreForMerit = (() => {
    if (loadSaveData) {
      return calculateMeritScore(loadSaveData.character, loadSaveData.gameState)
    }
    const initialChar = createInitialCharacter(origin, degree, bonusAttributes, playerName, playerCourtesyName, playerHometown, playerCustomAge)
    const originData = origins[origin]
    const initialGameStateFromOrigin = originData.initialGameState || {}
    const initialState = {
      currentYear: 1628,
      currentMonth: 1,
      turn: 0,
      圣眷: initialGameStateFromOrigin.圣眷 ?? 50,
      中官: initialGameStateFromOrigin.中官 ?? 50,
      清议: initialGameStateFromOrigin.清议 ?? 50,
      士绅: initialGameStateFromOrigin.士绅 ?? 50,
      民望: initialGameStateFromOrigin.民望 ?? 50,
      国势: 75
    }
    return calculateMeritScore(initialChar, initialState)
  })()

  const [meritScore, setMeritScore] = useState<number>(() => initialScoreForMerit)

  const [previousMeritScore, setPreviousMeritScore] = useState<number>(() =>
    initialScoreForMerit / difficultyConfig.promotionThresholdMultiplier
  )
  const [promotionMessage, setPromotionMessage] = useState<string | null>(null)

  const [identityType, setIdentityType] = useState<IdentityType>(() => {
    if (loadSaveData) {
      return (loadSaveData as any).identityType || 'official'
    }
    return 'official'
  })

  const [isGameOver, setIsGameOver] = useState(false)

  const [saveNotification, setSaveNotification] = useState<{ isOpen: boolean; message: string; subMessage: string }>({
    isOpen: false,
    message: '',
    subMessage: ''
  })

  const [resignConfirmModal, setResignConfirmModal] = useState<{
    isOpen: boolean;
    choice: EventChoice | null;
    newStateVals: Partial<GameStateValues>;
    newAttrs: Attributes;
  }>({ isOpen: false, choice: null, newStateVals: {}, newAttrs: character.attributes })

  const [isCheatModeOpen, setIsCheatModeOpen] = useState(false)
  const [isSaveSlotsOpen, setIsSaveSlotsOpen] = useState(false)
  const [saveSlotsMode, setSaveSlotsMode] = useState<'save' | 'load'>('save')

  const [isAchievementPanelOpen, setIsAchievementPanelOpen] = useState(false)
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null)

  const [showTutorial, setShowTutorial] = useState(() => {
    const hasSeenTutorial = localStorage.getItem('chongzhen_tutorial_seen')
    return !hasSeenTutorial && !loadSaveData
  })
  const [showHelp, setShowHelp] = useState(false)
  const [showAIAdvisor, setShowAIAdvisor] = useState(false)
  const [showImageGenerator, setShowImageGenerator] = useState(false)

  const [playTime] = useState<number>(() => {
    if (loadSaveData && (loadSaveData as any).playTime) {
      return (loadSaveData as any).playTime
    }
    return 0
  })

  const [lifeRecords, setLifeRecords] = useState<LifeRecord[]>(() => {
    if (loadSaveData) {
      return (loadSaveData as any).lifeRecords || []
    }
    return []
  })

  const [isLifeReviewOpen, setIsLifeReviewOpen] = useState(false)

  const [deathEndingState, setDeathEndingState] = useState<{
    show: boolean
    type: 'martyrdom' | 'suicide' | 'killed' | 'execution'
    title: string
    description: string
    echo: string
    tags: string[]
  }>({
    show: false,
    type: 'martyrdom',
    title: '',
    description: '',
    echo: '',
    tags: []
  })

  const [biography, setBiography] = useState<string>('')
  const [lastAutosaveFingerprint, setLastAutosaveFingerprint] = useState<string>('')

  const [currentStoryline, setCurrentStoryline] = useState<string | undefined>(() => {
    if (loadSaveData && (loadSaveData as any).currentStoryline) {
      return (loadSaveData as any).currentStoryline
    }
    return undefined
  })

  // refs 用于在稳定回调中读取最新状态
  const characterRef = useRef(character)
  const gameStateRef = useRef(gameState)
  const currentEventRef = useRef(currentEvent)
  const pendingEventsRef = useRef(pendingEvents)
  const eventHistoryRef = useRef(eventHistory)
  const undoHistoryRef = useRef(undoHistory)
  const identityTypeRef = useRef(identityType)
  const lifeRecordsRef = useRef(lifeRecords)
  const isProcessingRef = useRef(isProcessing)
  const difficultyConfigRef = useRef(difficultyConfig)
  const playTimeRef = useRef(playTime)
  const onReturnToMenuRef = useRef(onReturnToMenu)
  const currentStorylineRef = useRef(currentStoryline)

  useEffect(() => { characterRef.current = character }, [character])
  useEffect(() => { gameStateRef.current = gameState }, [gameState])
  useEffect(() => { currentEventRef.current = currentEvent }, [currentEvent])
  useEffect(() => { pendingEventsRef.current = pendingEvents }, [pendingEvents])
  useEffect(() => { eventHistoryRef.current = eventHistory }, [eventHistory])
  useEffect(() => { undoHistoryRef.current = undoHistory }, [undoHistory])
  useEffect(() => { identityTypeRef.current = identityType }, [identityType])
  useEffect(() => { lifeRecordsRef.current = lifeRecords }, [lifeRecords])
  useEffect(() => { isProcessingRef.current = isProcessing }, [isProcessing])
  useEffect(() => { difficultyConfigRef.current = difficultyConfig }, [difficultyConfig])
  useEffect(() => { playTimeRef.current = playTime }, [playTime])
  useEffect(() => { onReturnToMenuRef.current = onReturnToMenu }, [onReturnToMenu])
  useEffect(() => { currentStorylineRef.current = currentStoryline }, [currentStoryline])

  // 推断当前剧情线：优先使用玩家选择后持久化的剧情线，否则从历史事件反推
  const getCurrentStoryline = useCallback((): string | undefined => {
    if (currentStorylineRef.current) return currentStorylineRef.current
    const allEvents = [...initialEvents, ...allGrayChoiceEvents]
    const history = eventHistoryRef.current
    for (let i = history.length - 1; i >= Math.max(0, history.length - 8); i--) {
      const id = history[i]
      const ev = allEvents.find(e => e.id === id)
      if (ev?.storyline) return ev.storyline
    }
    return undefined
  }, [])

  const findAvailableEvent = useCallback((): GameEvent | null => {
    const allEvents = [...initialEvents, ...allGrayChoiceEvents]
    const available = allEvents.filter(e => checkEventConditions(e, characterRef.current, gameStateRef.current))
    return pickEvent(available, eventHistoryRef.current, getCurrentStoryline())
  }, [])

  const findAvailableEventWithState = useCallback((state: GameStateValues): GameEvent | null => {
    const allEvents = [...initialEvents, ...allGrayChoiceEvents]
    const available = allEvents.filter(e => checkEventConditions(e, characterRef.current, state))
    return pickEvent(available, eventHistoryRef.current, getCurrentStoryline())
  }, [])

  const weightedPick = useCallback(<T extends { storyline?: string }>(pool: T[], activeStoryline?: string): T | null => {
    if (pool.length === 0) return null
    if (pool.length === 1) return pool[0]
    const currentLine = activeStoryline ?? currentStorylineRef.current
    const weights = pool.map(item => {
      if (!currentLine) return 1
      if (item.storyline === currentLine) return 6
      if (item.storyline && item.storyline.startsWith(currentLine)) return 3
      return 1
    })
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]
      if (r <= 0) return pool[i]
    }
    return pool[pool.length - 1]
  }, [])

  const findAllEventsForState = useCallback((state: GameStateValues): GameEvent[] => {
    const allEvents = [...initialEvents, ...allGrayChoiceEvents]
    const history = eventHistoryRef.current
    const available = allEvents.filter(e => checkEventConditions(e, characterRef.current, state))
    if (available.length === 0) return []

    const activeStoryline = getCurrentStoryline()

    // 计算某个事件 ID 距离上次触发有多远（月数）
    const lastOccurrenceDistance = (eventId: string): number => {
      const lastIndex = history.lastIndexOf(eventId)
      if (lastIndex === -1) return Infinity
      return history.length - lastIndex
    }

    // 可重复事件的冷却期（月），避免同一事件反复出现
    const cooldowns: Record<string, number> = {
      random: 8,
      gray: 6,
      character: 6,
      national: 6,
      faction: 6,
      emotion: 12
    }
    const withCooldown = (pool: GameEvent[], type: string): GameEvent[] => {
      const minGap = cooldowns[type] || 0
      return minGap <= 0 ? pool : pool.filter(e => lastOccurrenceDistance(e.id) > minGap)
    }

    const results: GameEvent[] = []

    // 1. 历史大事件（一次性）
    const historical = available.filter(e => e.type === 'historical' && !history.includes(e.id))
    const pickedHistorical = weightedPick(historical, activeStoryline)
    if (pickedHistorical) {
      results.push(pickedHistorical)
    } else {
      // 2. 过渡事件（一次性），结局前奏优先
      const prelude = available.find(
        e => e.type === 'transition' && e.isPreEnding === true && !history.includes(e.id)
      )
      if (prelude) {
        results.push(prelude)
      } else {
        const transition = available.filter(e => e.type === 'transition' && !history.includes(e.id))
        const pickedTransition = weightedPick(transition, activeStoryline)
        if (pickedTransition) {
          results.push(pickedTransition)
        }
      }
    }

    // 3. 若本月没有大事件/过渡事件，用随机事件填充（可重复，带冷却）
    if (results.length === 0) {
      const random = withCooldown(available.filter(e => e.type === 'random'), 'random')
      const pickedRandom = weightedPick(random, activeStoryline)
      if (pickedRandom) {
        results.push(pickedRandom)
      }
    }

    // 4. 支线事件：emotion 一次性，gray/character/national/faction 可重复但带冷却
    const branchEmotion = available.filter(e => e.type === 'emotion' && !history.includes(e.id))
    const branchRepeatableTypes = ['gray', 'character', 'national', 'faction'] as const
    const branchRepeatable = branchRepeatableTypes.flatMap(type =>
      withCooldown(available.filter(e => e.type === type), type)
    )
    const branchPool = [...branchEmotion, ...branchRepeatable]

    // 按剧情线加权的无放回抽样，最多 2 个
    const branchWeighted = branchPool.map(e => ({
      e,
      w: activeStoryline && e.storyline === activeStoryline ? 4 : 1
    }))
    const branchSelected: GameEvent[] = []
    const remaining = [...branchWeighted]
    while (branchSelected.length < 2 && remaining.length > 0) {
      const total = remaining.reduce((a, b) => a + b.w, 0)
      let r = Math.random() * total
      let selectedIndex = -1
      for (let i = 0; i < remaining.length; i++) {
        r -= remaining[i].w
        if (r <= 0) {
          selectedIndex = i
          break
        }
      }
      if (selectedIndex === -1) selectedIndex = remaining.length - 1
      branchSelected.push(remaining[selectedIndex].e)
      remaining.splice(selectedIndex, 1)
    }
    results.push(...branchSelected)

    // 去重并过滤掉已经在本月结果中的事件
    return results.filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i)
  }, [getCurrentStoryline, weightedPick])

  const addLifeRecord = useCallback((record: Omit<LifeRecord, 'id'>) => {
    const newRecord: LifeRecord = {
      ...record,
      id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    setLifeRecords(prev => [...prev, newRecord])
  }, [])

  const getEndingType = useCallback((event?: GameEvent | null): 'legendary' | 'good' | 'normal' | 'bad' | 'tragic' => {
    const attrs = characterRef.current.attributes
    const hidden = characterRef.current.hidden
    const state = gameStateRef.current

    if (event) {
      const eventId = event.id
      const endingTitle = event.title

      const isLegendary = characterRef.current.rank === '正一品·太师' &&
        state.民望 >= 80 &&
        state.圣眷 >= 70 &&
        hidden.道德值 >= 70 &&
        attrs.理政 >= 70

      if (isLegendary) return 'legendary'

      const isRetire = eventId.includes('retire') || endingTitle.includes('归隐') || endingTitle.includes('辞官')
      if (isRetire && hidden.道德值 >= 70 && state.民望 >= 60) return 'good'

      const isDeath = eventId.includes('death') || endingTitle.includes('病逝') || endingTitle.includes('油尽灯枯')
      if (isDeath && hidden.道德值 >= 60) return 'good'

      if (eventId.includes('demotion') || endingTitle.includes('革职') || endingTitle.includes('庶民')) return 'bad'

      if (eventId.includes('emperor') || eventId.includes('moral') || endingTitle.includes('众叛亲离')) return 'tragic'
    }

    const checkTrigger = (): string | null => {
      if (attrs.财帛 <= 0) return '财帛'
      if (attrs.体质 <= 0) return '体质'
      if (state.圣眷 <= 0) return '圣眷'
      if (state.中官 <= 0) return '中官'
      if (state.清议 <= 0) return '清议'
      if (state.士绅 <= 0) return '士绅'
      if (state.民望 <= 0) return '民望'
      if (attrs.文韬 <= 0) return '文韬'
      if (attrs.理政 <= 0) return '理政'
      if (attrs.武略 <= 0) return '武略'
      if (hidden.道德值 <= 0) return '道德值'
      return null
    }

    const triggerAttr = checkTrigger()

    if (triggerAttr === '道德值') return 'tragic'
    if (triggerAttr === '圣眷') return 'bad'
    if (triggerAttr) return 'normal'

    return 'normal'
  }, [])

  const checkAchievements = useCallback((hasEnded?: boolean, endingType?: string) => {
    const ctx: AchievementContext = {
      attributes: characterRef.current.attributes,
      gameState: gameStateRef.current,
      characterRank: characterRef.current.rank,
      eventHistory: eventHistoryRef.current,
      hasEnded: hasEnded,
      endingType: endingType
    }
    const newlyUnlocked = checkAndUnlockAchievements(ctx)
    if (newlyUnlocked.length > 0) {
      const showNextAchievement = (index: number) => {
        if (index < newlyUnlocked.length) {
          setNewAchievement(newlyUnlocked[index])
          setTimeout(() => {
            setNewAchievement(null)
            setTimeout(() => showNextAchievement(index + 1), 100)
          }, 4000)
        }
      }
      showNextAchievement(0)
    }
  }, [])

  const handleGameOver = useCallback((event?: GameEvent) => {
    const endingType = getEndingType(event)
    checkAchievements(true, endingType)
    if (event) {
      setEventHistory(prev => prev.includes(event.id) ? prev : [...prev, event.id])
      triggerEndingAchievements(event)
      const bio = generateBiography(characterRef.current, gameStateRef.current, event, lifeRecordsRef.current)
      setBiography(bio)
    }
    setIsGameOver(true)
  }, [])

  const handleChoice = useCallback((choice: EventChoice) => {
    const currentCharacter = characterRef.current
    const currentGameState = gameStateRef.current
    const currentEvent = currentEventRef.current
    const currentEventHistory = eventHistoryRef.current

    const snapshotChar = JSON.parse(JSON.stringify(currentCharacter))
    const snapshotState = JSON.parse(JSON.stringify(currentGameState))

    let newAttrs = { ...currentCharacter.attributes }

    if (choice.staminaCost && choice.staminaCost > 0) {
      newAttrs.体质 = Math.max(0, newAttrs.体质 - choice.staminaCost)
    }

    if (choice.staminaBonus && choice.staminaBonus > 0) {
      const bounds = ATTR_BOUNDS.体质
      newAttrs.体质 = Math.max(bounds.min, Math.min(bounds.max, newAttrs.体质 + choice.staminaBonus))
    }

    if (choice.effects.attributes) {
      for (const [key, value] of Object.entries(choice.effects.attributes)) {
        const mappedKey = ATTR_MAP[key] || key
        const attrKey = mappedKey as keyof Attributes
        const bounds = ATTR_BOUNDS[attrKey] || { min: 0, max: 150 }
        let adjustedValue = value * difficultyConfigRef.current.attributeMultiplier
        adjustedValue = applyOriginModifier(currentCharacter.origin, mappedKey, adjustedValue)
        newAttrs[attrKey] = Math.max(bounds.min, Math.min(bounds.max, (newAttrs[attrKey] || 0) + adjustedValue))
      }
    }

    let newStateVals = { ...currentGameState }
    if (choice.effects.gameState) {
      for (const [key, value] of Object.entries(choice.effects.gameState)) {
        const mappedKey = STATE_MAP[key] || key
        const stateKey = mappedKey as keyof GameStateValues
        if (stateKey === 'currentYear' || stateKey === 'currentMonth' || stateKey === 'turn') continue
        const currentVal = (newStateVals[stateKey] as number) || 0
        const adjustedStateValue = applyOriginStateModifier(currentCharacter.origin, mappedKey, value)
        newStateVals[stateKey] = Math.max(0, Math.min(100, currentVal + adjustedStateValue))
      }
    }

    const attrsForCheck = { ...newAttrs } as Record<string, number>
    const stateForCheck = { ...newStateVals } as Record<string, number>
    const hiddenForCheck = { ...currentCharacter.hidden } as Record<string, number>

    setUndoHistory(prev => [...prev, {
      character: snapshotChar,
      gameState: snapshotState,
      eventHistory: [...currentEventHistory]
    }])

    setCharacter(prev => {
      const newChar = { ...prev }
      newChar.attributes = newAttrs

      const currentEventTitle = currentEvent?.title || '未知事件'
      const historyEntry = `${currentGameState.currentYear}年${currentGameState.currentMonth}月：${currentEventTitle} - ${choice.text}`
      newChar.history = [...newChar.history, historyEntry]

      if (choice.effects.hidden) {
        newChar.hidden = { ...newChar.hidden }
        for (const [key, value] of Object.entries(choice.effects.hidden)) {
          const hiddenKey = key as keyof typeof newChar.hidden
          const currentVal = newChar.hidden[hiddenKey]
          newChar.hidden[hiddenKey] = Math.max(0, Math.min(100, currentVal + value))
        }
      }
      if (choice.effects.flags?.add) {
        newChar.flags = [...newChar.flags, ...choice.effects.flags.add.filter(f => !newChar.flags.includes(f))]
      }
      if (choice.effects.flags?.remove) {
        newChar.flags = newChar.flags.filter(f => !choice.effects.flags!.remove!.includes(f))
      }

      const addedFlags = choice.effects.flags?.add || []
      const removedFlags = choice.effects.flags?.remove || []
      if (addedFlags.length > 0 || removedFlags.length > 0) {
        newChar.faction = { ...newChar.faction }
        let { 东林好感, 阉党好感, 立场, 党争烈度 } = newChar.faction

        for (const flag of addedFlags) {
          if (flag === '阉党路线') {
            阉党好感 = Math.min(100, 阉党好感 + 20)
            东林好感 = Math.max(0, 东林好感 - 15)
            立场 = '阉党'
            党争烈度 = Math.min(100, 党争烈度 + 10)
          } else if (flag === '复社成员' || flag === '东林死忠') {
            东林好感 = Math.min(100, 东林好感 + 20)
            阉党好感 = Math.max(0, 阉党好感 - 15)
            立场 = '东林'
            党争烈度 = Math.min(100, 党争烈度 + 8)
          } else if (flag === '叛徒') {
            if (立场 === '阉党') {
              东林好感 = Math.min(100, 东林好感 + 25)
              阉党好感 = Math.max(0, 阉党好感 - 30)
              立场 = '中间'
            }
          } else if (flag === '两面三刀') {
            党争烈度 = Math.min(100, 党争烈度 + 5)
          } else if (flag === '主和派') {
            阉党好感 = Math.min(100, 阉党好感 + 10)
            东林好感 = Math.max(0, 东林好感 - 10)
          }
        }

        for (const flag of removedFlags) {
          if (flag === '阉党路线') {
            阉党好感 = Math.max(0, 阉党好感 - 25)
            立场 = '中间'
          }
        }

        if (choice.effects.gameState) {
          if (choice.effects.gameState['清议'] && choice.effects.gameState['清议'] > 0) {
            东林好感 = Math.min(100, 东林好感 + Math.floor(choice.effects.gameState['清议'] / 2))
          }
          if (choice.effects.gameState['中官'] && choice.effects.gameState['中官'] > 0) {
            阉党好感 = Math.min(100, 阉党好感 + Math.floor(choice.effects.gameState['中官'] / 2))
          }
          if (choice.effects.gameState['清议'] && choice.effects.gameState['清议'] < 0) {
            东林好感 = Math.max(0, 东林好感 + Math.floor(choice.effects.gameState['清议'] / 2))
          }
          if (choice.effects.gameState['中官'] && choice.effects.gameState['中官'] < 0) {
            阉党好感 = Math.max(0, 阉党好感 + Math.floor(choice.effects.gameState['中官'] / 2))
          }
        }

        newChar.faction = { 东林好感, 阉党好感, 立场, 党争烈度 }
      }

      return newChar
    })

    addLifeRecord({
      year: currentGameState.currentYear,
      month: currentGameState.currentMonth,
      type: currentEvent?.type === 'historical' ? 'event' : 'choice',
      title: currentEvent?.title || '未知事件',
      description: choice.text,
      impact: choice.resultDescription || choice.result?.title,
      attributesChange: choice.effects.attributes,
      gameStateChange: choice.effects.gameState,
      hiddenChange: choice.effects.hidden,
      relatedEvent: currentEvent?.id
    })

    // 剧情线推进：优先采用选项显式指定的非 ordinary 剧情线；其次继承当前事件的非 ordinary 剧情线
    const explicitChoiceLine = choice.storyline && choice.storyline !== 'ordinary' ? choice.storyline : undefined
    const eventLine = currentEvent?.storyline && currentEvent.storyline !== 'ordinary' ? currentEvent.storyline : undefined
    const newStoryline = explicitChoiceLine || eventLine
    if (newStoryline && newStoryline !== currentStorylineRef.current) {
      currentStorylineRef.current = newStoryline
      setCurrentStoryline(newStoryline)
    }

    if (choice.effects.meritScore !== undefined) {
      const baseChange = choice.effects.meritScore
      const eventMultiplier = (currentEvent?.type === 'historical' || currentEvent?.type === 'ending') ? 2 : 1
      const finalChange = baseChange * eventMultiplier * difficultyConfigRef.current.meritScoreMultiplier

      setPreviousMeritScore(prev => prev + finalChange)

      if (finalChange !== 0) {
        const changeText = finalChange > 0 ? `+${Math.round(finalChange)}` : `${Math.round(finalChange)}`
        setPromotionMessage(`政绩分变化：${changeText}`)
        setTimeout(() => setPromotionMessage(null), 2000)
      }
    }

    if (choice.effects.special?.type === 'ending') {
      const isResignEnding = choice.text.includes('辞官') ||
        choice.text.includes('归隐') ||
        choice.text.includes('请辞') ||
        choice.text.includes('致仕') ||
        choice.text.includes('挂冠') ||
        choice.text.includes('急流勇退') ||
        choice.text.includes('隐姓埋名')

      if (isResignEnding) {
        setResignConfirmModal({
          isOpen: true,
          choice: choice,
          newStateVals: newStateVals,
          newAttrs: newAttrs
        })
        return
      }

      handleGameOver(currentEvent ?? undefined)
      return
    }

    setGameState(prev => {
      const newState = { ...prev, ...newStateVals }
      if (newState.民望 !== undefined) {
        newState.民望 = Math.max(-100, Math.min(100, newState.民望))
      }
      if (newState.士绅 !== undefined) {
        newState.士绅 = Math.max(0, Math.min(100, newState.士绅))
      }
      if (newState.圣眷 !== undefined) {
        newState.圣眷 = Math.max(0, Math.min(100, newState.圣眷))
      }
      if (newState.中官 !== undefined) {
        newState.中官 = Math.max(0, Math.min(100, newState.中官))
      }
      return newState
    })

    try {
      const params = {
        attributes: attrsForCheck,
        gameState: stateForCheck,
        hidden: hiddenForCheck,
        faction: currentCharacter.faction,
        flags: currentCharacter.flags,
        currentYear: currentGameState.currentYear,
        currentMonth: currentGameState.currentMonth
      }

      const triggeredEvent = boundaryEventManager.checkByType(params, 'ending')

      if (triggeredEvent) {
        if (triggeredEvent.id === 'bankrupt') {
          const bankruptEndingEvent: GameEvent = {
            id: 'ending_bankrupt',
            title: '【结局】倾家荡产',
            description: `你的银两已经耗尽，再也无法维持生计。\n\n债主们堵上了门，官府也下了文书——再不还钱就要抄家问罪。\n\n你这一生，终究是在贫困潦倒中落下了帷幕。`,
            conditions: {},
            choices: [{
              id: 'accept',
              text: '接受命运',
              effects: {},
              resultDescription: '游戏结束'
            }],
            type: 'ending'
          }
          setCurrentEvent(bankruptEndingEvent)
          handleGameOver(bankruptEndingEvent)
          return
        }
        setCurrentEvent(triggeredEvent.event)
      }
    } catch (e) {
      console.error('handleChoice boundary check error:', e)
    }
  }, [])

  const checkBoundary = useCallback((): boolean => {
    try {
      const currentCharacter = characterRef.current
      const currentGameState = gameStateRef.current
      const currentEvent = currentEventRef.current

      if (!currentCharacter?.attributes || !currentGameState) return false
      if (currentEvent?.id?.startsWith('boundary_')) return false

      const params = {
        attributes: { ...currentCharacter.attributes } as Record<string, number>,
        gameState: { 圣眷: currentGameState.圣眷, 中官: currentGameState.中官, 清议: currentGameState.清议, 士绅: currentGameState.士绅, 民望: currentGameState.民望, 国势: currentGameState.国势 },
        hidden: { ...currentCharacter.hidden } as Record<string, number>,
        faction: currentCharacter.faction,
        flags: currentCharacter.flags,
        currentYear: currentGameState.currentYear,
        currentMonth: currentGameState.currentMonth
      }

      const triggeredEvent = boundaryEventManager.checkByType(params, 'ending')
      if (triggeredEvent) {
        if (triggeredEvent.id === 'bankrupt') {
          const bankruptEndingEvent: GameEvent = {
            id: 'ending_bankrupt',
            title: '【结局】倾家荡产',
            description: `你的银两已经耗尽，再也无法维持生计。\n\n债主们堵上了门，官府也下了文书——再不还钱就要抄家问罪。\n\n你这一生，终究是在贫困潦倒中落下了帷幕。`,
            conditions: {},
            choices: [{
              id: 'accept',
              text: '接受命运',
              effects: {},
              resultDescription: '游戏结束'
            }],
            type: 'ending'
          }
          setCurrentEvent(bankruptEndingEvent)
          handleGameOver(bankruptEndingEvent)
          return true
        }
        setCurrentEvent(triggeredEvent.event)
        handleGameOver(triggeredEvent.event)
        return true
      }
    } catch (e) {
      console.error('checkBoundary error:', e)
    }
    return false
  }, [])

  const handleNextMonth = useCallback(() => {
    setIsProcessing(true)
    setUndoHistory([])

    setGameState(prev => {
      let newState = { ...prev }
      let allEvents: GameEvent[] = []
      let skippedMonths = 0
      const maxSkip = 12

      // 连续跳过空月，直到找到事件或达到上限，避免玩家反复点击继续
      while (skippedMonths < maxSkip) {
        let nextMonth = newState.currentMonth + 1
        let nextYear = newState.currentYear

        if (nextMonth > 12) {
          nextMonth = 1
          nextYear++
        }

        const current国势 = newState.国势 ?? 75
        let 国势Decay = 0
        const decayMultiplier = difficultyConfigRef.current.countryPowerDecay
        if (nextYear >= 1636) {
          国势Decay = -1 * decayMultiplier
        }
        if (nextYear >= 1640) {
          国势Decay = -2 * decayMultiplier
        }
        if (nextYear >= 1643) {
          国势Decay = -3 * decayMultiplier
        }

        newState = {
          ...newState,
          currentMonth: nextMonth,
          currentYear: nextYear,
          turn: newState.turn + 1,
          国势: Math.max(0, Math.min(100, current国势 + 国势Decay))
        }

        allEvents = findAllEventsForState(newState)
        skippedMonths++
        if (allEvents.length > 0) break
      }

      setCharacter(prevChar => ({
        ...prevChar,
        age: prevChar.age + skippedMonths / 12
      }))

      setTimeout(() => {
        if (checkBoundary()) {
          setIsProcessing(false)
          return
        }
        if (allEvents.length > 0) {
          setCurrentEvent(allEvents[0])
          setPendingEvents(allEvents.slice(1))
          setEventHistory(prevHistory => [...prevHistory, ...allEvents.map(e => e.id)])
        } else {
          setCurrentEvent(null)
        }
        setIsProcessing(false)
        checkAchievements()
      }, 300)

      return newState
    })
  }, [])

  const handleContinue = useCallback(() => {
    const currentPending = pendingEventsRef.current
    if (currentPending.length > 0) {
      const [next, ...rest] = currentPending
      setCurrentEvent(next)
      setPendingEvents(rest)
      return
    }

    // 当前月份事件已处理完，直接进入下月，不再显示空事件界面
    handleNextMonth()
  }, [handleNextMonth])

  const handleUndo = useCallback(() => {
    const history = undoHistoryRef.current
    if (history.length === 0) return
    const snapshot = history[history.length - 1]
    setCharacter({ ...snapshot.character })
    setGameState(snapshot.gameState)
    setEventHistory(snapshot.eventHistory)
    setUndoHistory(prev => prev.slice(0, -1))
  }, [])

  const handleSave = useCallback(() => {
    setSaveSlotsMode('save')
    setIsSaveSlotsOpen(true)
  }, [])

  const handleSaveToSlot = useCallback((slotId: number) => {
    const currentCharacter = characterRef.current
    const currentGameState = gameStateRef.current
    const currentEventHistory = eventHistoryRef.current
    const currentLifeRecords = lifeRecordsRef.current
    const charForSave = { ...currentCharacter }
    const saveData: SaveData = {
      character: charForSave as any,
      gameState: currentGameState,
      eventHistory: currentEventHistory,
      origin,
      degree,
      playerName: currentCharacter.name || playerName || '',
      identityType: identityTypeRef.current,
      lifeRecords: currentLifeRecords,
      savedAt: new Date().toISOString(),
      playTime: playTimeRef.current,
      achievements: loadAchievements()
    }
    const ok = saveSaveSlot(slotId, saveData)
    setIsSaveSlotsOpen(false)
    if (ok) {
      setSaveNotification({
        isOpen: true,
        message: '存档成功',
        subMessage: `${currentCharacter.name || '无名氏'} · ${currentGameState.currentYear}年${currentGameState.currentMonth}月 · ${currentCharacter.rank}`
      })
    } else {
      setSaveNotification({
        isOpen: true,
        message: '存档失败',
        subMessage: 'localStorage 写入异常，请检查浏览器存储空间或隐私模式设置'
      })
    }
  }, [origin, degree, playerName])

  const handleLoadFromSlot = useCallback((slotId: number) => {
    const saveData = loadSaveSlot(slotId)
    if (saveData) {
      setIsSaveSlotsOpen(false)
      if (onReturnToMenuRef.current) {
        onReturnToMenuRef.current()
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('loadSave', { detail: saveData }))
        }, 100)
      }
    }
  }, [])

  const handleRestart = useCallback(() => {
    setGameState({
      currentYear: 1628,
      currentMonth: 1,
      turn: 0,
      圣眷: 50,
      中官: 50,
      清议: 50,
      士绅: 50,
      民望: 50,
      国势: 75
    })
    setLifeRecords([])
    setCurrentEvent(null)
    setIsGameOver(false)
  }, [])

  const handleReturnToMenu = useCallback(() => {
    setIsGameOver(false)
    if (onReturnToMenuRef.current) {
      onReturnToMenuRef.current()
    }
  }, [])

  const generateLifeSummary = useCallback((): LifeSummary => {
    const startYear = 1628
    const endYear = gameStateRef.current.currentYear
    const character = characterRef.current
    const gameState = gameStateRef.current
    const lifeRecords = lifeRecordsRef.current

    const getReputation = () => {
      const { 理政 } = character.attributes
      const { 圣眷, 民望 } = gameState
      const { 道德值 } = character.hidden

      if (道德值 >= 70 && 民望 >= 60) return '清廉正直，深得民心'
      if (道德值 >= 50 && 理政 >= 60) return '政绩卓著，为官清廉'
      if (圣眷 >= 70) return '深受皇恩，位极人臣'
      if (道德值 <= 30) return '贪墨成性，声名狼藉'
      if (民望 <= 30) return '民怨沸腾，臭名昭著'
      return '平平无奇，碌碌无为'
    }

    const getLegacy = () => {
      const { 理政, 文韬 } = character.attributes
      const { 民望, 清议 } = gameState

      if (理政 >= 70 && 民望 >= 60) return '其政绩为后人所称道，百姓立碑纪念。'
      if (文韬 >= 70 && 清议 >= 60) return '其文章传世，为士林所推崇。'
      if (character.promotionCount >= 3) return '历经宦海沉浮，最终位极人臣。'
      if (character.demotionCount >= 2) return '仕途坎坷，屡遭贬谪，令人唏嘘。'
      return '其一生平淡，未留下太多痕迹。'
    }

    const achievements: string[] = []
    if (character.promotionCount >= 3) achievements.push(`历经${character.promotionCount}次升迁`)
    if (character.attributes.理政 >= 70) achievements.push('政绩斐然')
    if (character.attributes.文韬 >= 70) achievements.push('文采出众')
    if (character.attributes.武略 >= 70) achievements.push('武艺超群')
    if (gameState.圣眷 >= 70) achievements.push('深受皇恩')
    if (gameState.民望 >= 70) achievements.push('深得民心')
    if (character.hidden.道德值 >= 70) achievements.push('清廉自守')

    const controversies: string[] = []
    if (character.demotionCount >= 2) controversies.push(`遭贬${character.demotionCount}次`)
    if (character.hidden.道德值 <= 30) controversies.push('贪墨受贿')
    if (gameState.民望 <= 30) controversies.push('民怨沸腾')
    if (character.hidden.欲望值 >= 70) controversies.push('欲望膨胀')

    return {
      totalRecords: lifeRecords.length,
      keyEvents: lifeRecords.filter(r =>
        r.type === 'promotion' ||
        r.type === 'demotion' ||
        r.type === 'death' ||
        (r.type === 'event' && r.impact)
      ).slice(-10),
      finalTitle: character.rank,
      finalRank: character.degree,
      reputation: getReputation(),
      legacy: getLegacy(),
      lifespan: { start: startYear, end: endYear },
      achievements,
      controversies
    }
  }, [])

  const handleDeathEnding = useCallback((ending: {
    type: 'martyrdom' | 'suicide' | 'killed' | 'execution'
    title: string
    description: string
    echo: string
    tags: string[]
  }) => {
    const currentGameState = gameStateRef.current
    addLifeRecord({
      year: currentGameState.currentYear,
      month: currentGameState.currentMonth,
      type: 'death',
      title: ending.title,
      description: ending.description,
      impact: ending.echo
    })
    setDeathEndingState({
      show: true,
      ...ending
    })
  }, [])

  // UI 开关回调
  const openCheatMode = useCallback(() => setIsCheatModeOpen(true), [])
  const closeCheatMode = useCallback(() => setIsCheatModeOpen(false), [])
  const openAchievementPanel = useCallback(() => setIsAchievementPanelOpen(true), [])
  const closeAchievementPanel = useCallback(() => setIsAchievementPanelOpen(false), [])
  const openHelp = useCallback(() => setShowHelp(true), [])
  const closeHelp = useCallback(() => setShowHelp(false), [])
  const openAIAdvisor = useCallback(() => setShowAIAdvisor(true), [])
  const closeAIAdvisor = useCallback(() => setShowAIAdvisor(false), [])
  const openImageGenerator = useCallback(() => setShowImageGenerator(true), [])
  const closeImageGenerator = useCallback(() => setShowImageGenerator(false), [])
  const openLifeReview = useCallback(() => setIsLifeReviewOpen(true), [])
  const closeLifeReview = useCallback(() => setIsLifeReviewOpen(false), [])
  const closeTutorial = useCallback(() => setShowTutorial(false), [])
  const completeTutorial = useCallback(() => {
    localStorage.setItem('chongzhen_tutorial_seen', 'true')
    setShowTutorial(false)
  }, [])
  const closeSaveNotification = useCallback(() => setSaveNotification(prev => ({ ...prev, isOpen: false })), [])
  const closeSaveSlots = useCallback(() => setIsSaveSlotsOpen(false), [])
  const dismissNewAchievement = useCallback(() => setNewAchievement(null), [])
  const closeDeathEnding = useCallback(() => setDeathEndingState(prev => ({ ...prev, show: false })), [])

  const confirmResign = useCallback(() => {
    setResignConfirmModal(prev => ({ ...prev, isOpen: false, choice: null, newStateVals: {}, newAttrs: characterRef.current.attributes }))
    setIsGameOver(true)
  }, [])

  const cancelResign = useCallback(() => {
    setResignConfirmModal(prev => ({ ...prev, isOpen: false, choice: null, newStateVals: {}, newAttrs: characterRef.current.attributes }))
  }, [])

  const handleLoadAutosave = useCallback(() => {
    setIsSaveSlotsOpen(false)
    const raw = localStorage.getItem('chongzhen_autosave')
    if (!raw) return
    try {
      const saveData = JSON.parse(raw) as SaveData
      if (saveData && saveData.character && saveData.gameState) {
        window.dispatchEvent(new CustomEvent('loadSave', { detail: saveData }))
      }
    } catch (e) {
      console.error('[onLoadAutosave] failed:', e)
    }
  }, [])

  // 当 loadSaveData 变化时（读档），恢复存档数据
  useEffect(() => {
    if (!loadSaveData) return
    const char = loadSaveData.character
    const flags = char.degree === '进士' && !char.flags.includes('地方官任职')
      ? [...char.flags, '地方官任职']
      : char.flags

    const faction = (char as any).faction || {
      东林好感: 50,
      阉党好感: 50,
      立场: '未定',
      党争烈度: 30
    }

    const fixedCharacter = {
      ...char,
      courtesyName: char.courtesyName || '',
      hometown: char.hometown || '',
      flags,
      faction
    }

    const oldState = loadSaveData.gameState
    const initialGameState = {
      currentYear: oldState.currentYear,
      currentMonth: oldState.currentMonth,
      turn: oldState.turn,
      圣眷: (oldState as any).帝心 ?? oldState.圣眷 ?? 50,
      中官: (oldState as any).中官 ?? 50,
      清议: (oldState as any).派系立场 ?? oldState.清议 ?? 50,
      士绅: (oldState as any).百姓口碑 ?? oldState.士绅 ?? 50,
      民望: (oldState as any).百姓口碑 ?? oldState.民望 ?? 50,
      国势: oldState.国势 ?? 75
    }

    const currentScore = calculateMeritScore(fixedCharacter, initialGameState)
    const correctRank = RANKS.slice().reverse().find(r => currentScore >= r.minScore)

    if (correctRank && fixedCharacter.rank !== correctRank.name) {
      fixedCharacter.rank = correctRank.name
    }

    setCharacter(fixedCharacter)
    setGameState(initialGameState)
    setEventHistory(loadSaveData.eventHistory)
    setUndoHistory([])
    setPendingEvents((loadSaveData as any).pendingEvents || [])
    setCurrentEvent((loadSaveData as any).currentEvent || null)

    setMeritScore(currentScore)
    setPreviousMeritScore(currentScore)

    if ((loadSaveData as any).identityType) {
      setIdentityType((loadSaveData as any).identityType)
    }

    const savedStoryline = (loadSaveData as any).currentStoryline
    if (savedStoryline) {
      currentStorylineRef.current = savedStoryline
      setCurrentStoryline(savedStoryline)
    }
  }, [loadSaveData])

  // 组件挂载/读档时初始化第一个事件
  useEffect(() => {
    if (currentEventRef.current) return
    if (isProcessingRef.current) return

    checkAchievements()

    const params = {
      attributes: { ...characterRef.current.attributes } as Record<string, number>,
      gameState: { 圣眷: gameStateRef.current.圣眷, 中官: gameStateRef.current.中官, 清议: gameStateRef.current.清议, 士绅: gameStateRef.current.士绅, 民望: gameStateRef.current.民望, 国势: gameStateRef.current.国势 },
      hidden: { ...characterRef.current.hidden } as Record<string, number>,
      faction: characterRef.current.faction,
      flags: characterRef.current.flags
    }

    const endingEvent = boundaryEventManager.checkByType(params, 'ending')
    if (endingEvent) {
      setCurrentEvent(endingEvent.event)
      if (endingEvent.id === 'bankrupt') {
        setIsGameOver(true)
      }
      return
    }

    const crisisEvent = boundaryEventManager.checkByType(params, 'crisis')
    if (crisisEvent && Math.random() < 0.3) {
      setCurrentEvent(crisisEvent.event)
      return
    }

    let allEvents = findAllEventsForState(gameStateRef.current)
    let newState = gameStateRef.current
    let attempts = 0
    while (allEvents.length === 0 && attempts < 24) {
      const nextMonth = newState.currentMonth + 1
      newState = nextMonth > 12
        ? { ...newState, currentMonth: 1, currentYear: newState.currentYear + 1 }
        : { ...newState, currentMonth: nextMonth }
      allEvents = findAllEventsForState(newState)
      attempts++
    }

    if (allEvents.length > 0) {
      if (newState !== gameStateRef.current) setGameState(newState)
      setCurrentEvent(allEvents[0])
      setPendingEvents(allEvents.slice(1))
      setEventHistory(prev => [...prev, ...allEvents.map(e => e.id)])
    }

    // 初始化时若跳过若干月份才找到事件，需同步增加角色年龄
    if (attempts > 0) {
      setCharacter(prev => ({
        ...prev,
        age: prev.age + attempts / 12
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 自动存档
  const autosaveTimerRef = useRef<number | null>(null)
  useEffect(() => {
    if (isProcessing) return
    if (!character || !gameState) return
    if (gameState.currentYear < 1628) return
    if (gameState.currentMonth < 1 || gameState.currentMonth > 12) return

    const charForSave = { ...character }
    const data: SaveData = {
      character: charForSave as any,
      gameState,
      eventHistory,
      currentEventId: currentEvent?.id || null,
      currentEvent: currentEvent || null,
      pendingEvents,
      origin,
      degree,
      playerName: character.name || playerName || '',
      identityType,
      lifeRecords,
      savedAt: new Date().toISOString(),
      playTime,
      achievements: loadAchievements(),
      currentStoryline
    }

    const fingerprint = `${gameState.currentYear}|${gameState.currentMonth}|${gameState.turn}|${eventHistory.length}|${character.attributes.财帛}|${character.attributes.文韬}|${character.attributes.理政}|${character.attributes.武略}|${character.attributes.体质}|${gameState.圣眷}|${gameState.中官}|${gameState.清议}|${gameState.士绅}|${gameState.民望}|${gameState.国势}|${character.flags.length}|${currentEvent?.id || ''}|${currentStoryline || ''}`
    if (fingerprint === lastAutosaveFingerprint) return

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      saveAutosave(data)
      setLastAutosaveFingerprint(fingerprint)
      autosaveTimerRef.current = null
    }, 400)

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
  }, [character, gameState, eventHistory, currentEvent, pendingEvents, isProcessing, identityType, lifeRecords, playTime, lastAutosaveFingerprint, origin, degree, playerName])

  // 升官贬官检查
  useEffect(() => {
    const currentCharacter = characterRef.current
    const currentGameState = gameStateRef.current
    const baseScore = calculateMeritScore(currentCharacter, currentGameState)
    const adjustedScore = baseScore / difficultyConfig.promotionThresholdMultiplier

    setMeritScore(baseScore)

    if (identityType === 'official') {
      const promotion = checkPromotion(adjustedScore, previousMeritScore)
      if (promotion.promoted && promotion.message) {
        setPromotionMessage(promotion.message)
        setCharacter(prev => ({
          ...prev,
          rank: promotion.newRank || prev.rank,
          promotionCount: prev.promotionCount + 1,
          history: [...prev.history, `${currentGameState.currentYear}年${currentGameState.currentMonth}月：${promotion.message}`]
        }))
        addLifeRecord({
          year: currentGameState.currentYear,
          month: currentGameState.currentMonth,
          type: 'promotion',
          title: '官升一级',
          description: promotion.message,
          impact: `晋升为${promotion.newRank}`
        })
        const bonus = promotion.scoreBonus ?? 0
        // 升官后立即更新基准分，避免同一轮再次触发升降官或 immediate 贬官
        setPreviousMeritScore(adjustedScore + bonus)
        setTimeout(() => checkAchievements(), 100)
        setTimeout(() => setPromotionMessage(null), 3000)
        return
      }

      const demotion = checkDemotion(adjustedScore, previousMeritScore, currentCharacter, currentGameState)
      if (demotion.demoted && demotion.message) {
        if (demotion.newIdentity === 'civilian' || demotion.newIdentity === 'exiled') {
          addLifeRecord({
            year: currentGameState.currentYear,
            month: currentGameState.currentMonth,
            type: 'demotion',
            title: '革职查办',
            description: demotion.message,
            impact: '被贬为庶民'
          })
          const isExiled = demotion.newIdentity === 'exiled'
          const demotionEndingEvent: GameEvent = {
            id: 'ending_demotion',
            title: isExiled ? '流放边疆' : '革职为民',
            description: '',
            endingConfig: { category: 'personal_fate', tier: isExiled ? 'dark' : 'tragic' },
            narrative: {
              speaker: { title: '吏部文书', name: '吏部主事' },
              quote: isExiled
                ? '奉旨：某某革职查办，永不起用，即日押解宁古塔，交驻防将军管束。'
                : '奉旨：某某才疏学浅，难胜其任。着即革职，削籍为民，永不录用。',
              background: demotion.message + '\n\n吏部的文书送到的时候，你正在批阅最后几份公文。接过的那一刻，你知道——一切都结束了。',
              situation: isExiled
                ? '押解官已经在门外等候。你被允许带一床被子、两件换洗衣服和三本书。从京城到宁古塔，要走整整四个月。'
                : '你脱下官服，换上布衣。腰间的铜鱼袋解下来放在案头，发出一声轻响。从此以后，你只是一个普通百姓。'
            },
            conditions: {},
            choices: [{
              id: 'accept',
              text: '接受命运',
              effects: { special: { type: 'ending' } },
              result: {
                title: isExiled ? '万里投荒' : '布衣终老',
                tags: isExiled
                  ? ['贬官流放', '个人命运', '黑暗']
                  : ['贬官为民', '个人命运', '悲剧'],
                echo: isExiled
                  ? `【结局·流放边疆】\n\n宁古塔的风像刀子一样割在脸上。\n\n你在这里已经待了三年。三年里，你见过零下四十度的严寒，见过被冻死在路边的流民，见过驻防将军鞭打逃卒时溅出的血点。\n\n起初你还想着翻案、想着申诉。后来你就不想了。在这片苦寒之地，活着本身就是一种奢侈。\n\n你开始学着和当地的女真人打交道，学着种他们叫做"哈拉"的庄稼，学着在暴风雪来临前把地窖封好。\n\n某年冬天，一个来自京城的信使带来了消息：崇祯帝自缢于煤山，大顺军攻入北京。\n\n你站在雪地里，看着南方的天空，久久没有说话。\n\n第二天，人们发现你坐在地窖门口，脸上带着一种奇怪的表情——像是释然，又像是悲哀。\n\n手里攥着一封没写完的信，收信人写着两个字："陛下"。\n`
                  : `【结局·革职为民】\n\n回乡的路比想象中更长。\n\n不是距离上的远——而是当你以一个庶民的身份走在曾经管辖过的土地上时，那种物是人非的感觉几乎让人窒息。\n\n你路过自己曾经审过案的县衙，门口的差役换了一批又一批，没人认得你。你在路边摊吃了一碗面，味道和你当年微服私访时吃过的一模一样，但心境已天差地别。\n\n你在老家置了几亩薄田，日出而作，日落而息。日子过得清贫倒也安稳。\n\n偶尔有旧识路过来看你，你们喝茶聊天，谁也不提当年的事。只有临走时，他们会多看你一眼，眼神里有惋惜，也有某种说不清的释然。\n\n你活到了六十三岁。去世那天是一个普通的秋日，阳光很好，院子里的菊花开了。\n\n你没有留下什么丰功伟绩，也没有留下什么骂名。就像这世间千千万万的普通人一样，来过，走过，然后离开了。\n\n《县志》载："某公，曾为朝廷命官，后因故罢归。居家课子，乡党称善。"\n`
              }
            }],
            type: 'ending'
          }
          setCurrentEvent(demotionEndingEvent)
          setIdentityType(demotion.newIdentity || 'civilian')
          setIsGameOver(true)
          return
        }

        setPromotionMessage(demotion.message)
        setCharacter(prev => ({
          ...prev,
          rank: demotion.newRank || prev.rank,
          demotionCount: prev.demotionCount + 1,
          history: [...prev.history, `${currentGameState.currentYear}年${currentGameState.currentMonth}月：${demotion.message}（第${prev.demotionCount + 1}次贬官）`]
        }))
        addLifeRecord({
          year: currentGameState.currentYear,
          month: currentGameState.currentMonth,
          type: 'demotion',
          title: '贬官一级',
          description: demotion.message,
          impact: `贬为${demotion.newRank}`
        })
        setTimeout(() => checkAchievements(), 100)
        setTimeout(() => setPromotionMessage(null), 3000)
      }
    }

    setPreviousMeritScore(adjustedScore)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.attributes.理政, character.attributes.文韬, character.attributes.武略, character.attributes.财帛, character.hidden.道德值, character.hidden.欲望值, gameState.圣眷, gameState.中官, gameState.清议, gameState.士绅, gameState.民望, difficultyConfig, identityType, previousMeritScore])

  return {
    // 状态
    character,
    gameState,
    currentEvent,
    pendingEvents,
    eventHistory,
    undoHistory,
    meritScore,
    previousMeritScore,
    promotionMessage,
    identityType,
    isGameOver,
    saveNotification,
    resignConfirmModal,
    isCheatModeOpen,
    isSaveSlotsOpen,
    saveSlotsMode,
    isAchievementPanelOpen,
    newAchievement,
    showTutorial,
    showHelp,
    showAIAdvisor,
    showImageGenerator,
    playTime,
    lifeRecords,
    isLifeReviewOpen,
    deathEndingState,
    biography,
    lastAutosaveFingerprint,
    isProcessing,

    // UI 开关
    openCheatMode,
    closeCheatMode,
    openAchievementPanel,
    closeAchievementPanel,
    openHelp,
    closeHelp,
    openAIAdvisor,
    closeAIAdvisor,
    openImageGenerator,
    closeImageGenerator,
    openLifeReview,
    closeLifeReview,
    closeTutorial,
    completeTutorial,
    closeSaveNotification,
    closeSaveSlots,
    dismissNewAchievement,
    closeDeathEnding,

    // 核心回调
    handleChoice,
    handleNextMonth,
    handleContinue,
    handleUndo,
    handleSave,
    handleSaveToSlot,
    handleLoadFromSlot,
    handleLoadAutosave,
    handleRestart,
    handleReturnToMenu,
    handleGameOver,
    handleDeathEnding,
    confirmResign,
    cancelResign,

    // 辅助函数
    getCurrentStoryline,
    findAvailableEvent,
    findAvailableEventWithState,
    findAllEventsForState,
    addLifeRecord,
    generateLifeSummary,
    checkAchievements,
    getEndingType,
    checkBoundary
  }
}
