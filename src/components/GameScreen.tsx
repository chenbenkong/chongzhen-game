import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Character, GameStateValues, OriginType, DegreeType, Attributes, LifeRecord, LifeSummary, PlayerFaction } from '../types/game'
import { GameEvent, EventChoice } from '../types/event'
import StatusBar from './StatusBar'
import AttributePanel from './AttributePanel'
import StatusPanel from './StatusPanel'
import EventDisplay from './EventDisplay'
import ActionBar from './ActionBar'
import GameOverScreen from './GameOverScreen'
import CheatMode from './CheatMode'
import LifeReview from './LifeReview'
import DeathEnding from './DeathEnding'
import SaveNotification from './SaveNotification'
import SaveSlotsModal from './SaveSlotsModal'
import AchievementUnlock from './AchievementUnlock'
import AchievementPanel from './AchievementPanel'
import TutorialModal from './TutorialModal'
import Icon from './Icon'
import StorylineBar from './StorylineBar'
import { SaveData, saveSaveSlot, loadSaveSlot, saveAutosave } from '../types/save'
import {
  checkAndUnlockAchievements,
  loadAchievements,
  Achievement,
  AchievementContext
} from '../types/achievement'
import { DifficultyLevel, getDifficultyConfig } from '../types/difficulty'
import { initialEvents, allGrayChoiceEvents } from '../data/events/index'
import { origins } from '../data/origins'
import { boundaryEventManager } from '../services/BoundaryEventManager'
import '../data/boundaryEvents'
import { triggerEndingAchievements, generateBiography } from '../utils/endingSystem'
import { ATTR_MAP, STATE_MAP, ATTR_BOUNDS } from '../utils/constants'
import { checkEventConditions, pickEvent } from '../utils/eventConditions'

import './GameScreen.css'

// 身份类型
type IdentityType = 'official' | 'civilian' | 'rebel' | 'exiled' | 'retired'

// 出身特性修正：属性效果
function applyOriginModifier(origin: OriginType, attrKey: string, value: number): number {
  // 寒门：清议变化速度 +50%，文韬正向效果 +15%
  if (origin === '寒门') {
    if (attrKey === '文韬' && value > 0) return Math.round(value * 1.15)
  }
  // 缙绅：财帛正向效果 +10%，理政正向效果 +10%
  if (origin === '缙绅') {
    if (attrKey === '财帛' && value > 0) return Math.round(value * 1.1)
    if (attrKey === '理政' && value > 0) return Math.round(value * 1.1)
  }
  // 没落世家：武略正向效果 +20%，文韬正向效果 -20%
  if (origin === '没落世家') {
    if (attrKey === '武略' && value > 0) return Math.round(value * 1.2)
    if (attrKey === '文韬' && value > 0) return Math.round(value * 0.8)
  }
  // 诗文清望：文韬正向效果 +25%，武略正向效果 -30%
  if (origin === '诗文清望') {
    if (attrKey === '文韬' && value > 0) return Math.round(value * 1.25)
    if (attrKey === '武略' && value > 0) return Math.round(value * 0.7)
  }
  return value
}

// 出身特性修正：五方态度效果
function applyOriginStateModifier(origin: OriginType, stateKey: string, value: number): number {
  // 寒门：清议变化速度 +50%，人脉积累 -30%
  if (origin === '寒门') {
    if (stateKey === '清议') return Math.round(value * 1.5)
    if (stateKey === '士绅' && value > 0) return Math.round(value * 0.7)
  }
  // 缙绅：士绅正向 +20%，圣眷正向 -10%（猜忌加成）
  if (origin === '缙绅') {
    if (stateKey === '士绅' && value > 0) return Math.round(value * 1.2)
    if (stateKey === '圣眷' && value > 0) return Math.round(value * 0.9)
  }
  // 没落世家：中官正向 +15%（武将与太监有交集），清议正向 -20%
  if (origin === '没落世家') {
    if (stateKey === '中官' && value > 0) return Math.round(value * 1.15)
    if (stateKey === '清议' && value > 0) return Math.round(value * 0.8)
  }
  // 诗文清望：清议正向 +25%，中官正向 -30%
  if (origin === '诗文清望') {
    if (stateKey === '清议' && value > 0) return Math.round(value * 1.25)
    if (stateKey === '中官' && value > 0) return Math.round(value * 0.7)
  }
  return value
}

interface GameScreenProps {
  origin: OriginType
  degree: DegreeType
  bonusAttributes: Attributes
  playerName?: string
  playerCourtesyName?: string  // 字（开局时由 NameInput 传入）
  playerHometown?: string      // 籍贯
  playerCustomAge?: number | null  // 自定义起始年龄（null = 走默认）
  loadSaveData?: SaveData
  difficulty: DifficultyLevel
  onReturnToMenu?: () => void
}

// 官职体系 - 按明朝官制，每级差100分
// 主角从正七品知县开始，初始分530分
const RANKS = [
  { level: 1, name: '从九品·司狱', minScore: 0, type: 'official' as IdentityType },
  { level: 2, name: '正九品·主簿', minScore: 50, type: 'official' as IdentityType },
  { level: 3, name: '从八品·县丞', minScore: 100, type: 'official' as IdentityType },
  { level: 4, name: '正八品·照磨', minScore: 150, type: 'official' as IdentityType },
  { level: 5, name: '从七品·判官', minScore: 200, type: 'official' as IdentityType },
  { level: 6, name: '正七品·知县', minScore: 250, type: 'official' as IdentityType },  // 主角起始
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

function calculateMeritScore(
  character: Character, 
  gameState: GameStateValues,
  baseScore: number = BASE_MERIT_SCORE,
  eventType?: string,
  isImportant: boolean = false
): number {
  const attrs = character.attributes
  
  // 从基础分开始
  let score = baseScore
  
  // 学历加分
  if (character.degree === '进士') {
    score += 60
  } else if (character.degree === '举人') {
    score += 30
  }

  // 属性对政绩分的影响（提高系数，让升官更容易）
  score += (attrs.理政 - 50) * 1.5  // 理政影响最大
  score += (attrs.文韬 - 50) * 0.8
  score += (attrs.武略 - 50) * 0.4
  score += (gameState.圣眷 - 50) * 1.0  // 圣眷影响加大
  score += (gameState.民望 - 50) * 0.8  // 民望影响加大

  // 重要事件额外加成
  if (isImportant || (eventType && IMPORTANT_EVENT_TYPES.includes(eventType))) {
    score += 80  // 重要事件额外加80分
  }
  
  return Math.floor(score)
}

// 检查是否升官
function checkPromotion(currentScore: number, previousScore: number): { promoted: boolean; newRank?: string; message?: string; scoreBonus?: number } {
  // 从高到低找到第一个满足条件的官职（即当前分数对应的最高官职）
  const currentRankIndex = RANKS.slice().reverse().findIndex(r => currentScore >= r.minScore)
  const previousRankIndex = RANKS.slice().reverse().findIndex(r => previousScore >= r.minScore)
  
  // 转换回正序索引
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

// 贬官触发条件类型
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

// 检查是否贬官 - 基于当前官职基准分
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
  // 获取当前官职的基准分
  const currentRankData = RANKS.find(r => r.name === character.rank)
  const currentRankBaseScore = currentRankData?.minScore ?? 500
  
  // 贬官条件：政绩分低于当前官职基准分
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
      condition: character.hidden.欲望值 > 80 && character.attributes.财帛 > 80, 
      reason: '贪墨被查', 
      severity: 3,
      message: '贪污受贿，中饱私囊，东窗事发' 
    },
    { 
      condition: gameState.中官 < 30 && character.attributes.武略 < 20, 
      reason: '失职渎职', 
      severity: 2,
      message: '国难当头，尸位素餐，失职渎职' 
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
      condition: gameState.士绅 > 80 && gameState.圣眷 < 30, 
      reason: '得罪权贵', 
      severity: 2,
      message: '功高震主，树大招风，遭人构陷' 
    },
    { 
      condition: character.attributes.体质 < 20, 
      reason: '体弱多病', 
      severity: 1,
      message: '体弱多病，难以视事，需静养调理' 
    },
    { 
      condition: character.attributes.财帛 < -30, 
      reason: '财政亏空', 
      severity: 1,
      message: '亏空公款，账目不清，被弹劾查办' 
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
  
  // 检查是否触发贬官
  const triggeredReasons = reasons.filter(r => r.condition)
  
  if (triggeredReasons.length > 0) {
    // 取最严重的贬官原因
    const worstReason = triggeredReasons.sort((a, b) => b.severity - a.severity)[0]
    
    const currentRankIndex = RANKS.findIndex(r => currentScore >= r.minScore)
    const previousRankIndex = RANKS.findIndex(r => previousScore >= r.minScore)
    
    // 根据严重程度决定贬官幅度
    let demotionLevels = worstReason.severity
    if (worstReason.severity >= 3) {
      // 严重违规可能直接革职
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



export default function GameScreen({ origin, degree, bonusAttributes, playerName, playerCourtesyName, playerHometown, playerCustomAge, loadSaveData, difficulty, onReturnToMenu }: GameScreenProps) {
  const difficultyConfig = useMemo(() => getDifficultyConfig(difficulty), [difficulty])
  const [character, setCharacter] = useState<Character>(() => {
    if (loadSaveData) {
      const char = loadSaveData.character
      // 确保进士有地方官任职flag
      const flags = char.degree === '进士' && !char.flags.includes('地方官任职')
        ? [...char.flags, '地方官任职']
        : char.flags
      
      return {
        ...char,
        // 兼容旧存档：courtesyName / hometown 字段缺失时填空串
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
    return createInitialCharacter(origin, degree, bonusAttributes)
  })
  const [gameState, setGameState] = useState<GameStateValues>(() => {
    if (loadSaveData) {
      // 兼容旧存档，将旧属性映射到新属性
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
    // 使用出身数据中的初始五方态度
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
  // 当月待处理事件队列（"同月多事件"机制：主事件+支线都入队，处理完一个自动弹出下一个）
  const [pendingEvents, setPendingEvents] = useState<GameEvent[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [eventHistory, setEventHistory] = useState<string[]>(() => {
    if (loadSaveData) {
      return loadSaveData.eventHistory
    }
    return []
  })
  const [undoHistory, setUndoHistory] = useState<Array<{
    character: Character
    gameState: GameStateValues
    eventHistory: string[]
  }>>([])
  
  // 政绩分和升官系统
  // 主角从正七品知县开始，初始分530分（基准500+缓冲30）
  const [meritScore, setMeritScore] = useState<number>(() => {
    if (loadSaveData) {
      return calculateMeritScore(loadSaveData.character, loadSaveData.gameState)
    }
    // 新游戏统一从知县基准分开始，避免不同出身初始分不同
    return BASE_MERIT_SCORE
  })
  
  const [previousMeritScore, setPreviousMeritScore] = useState<number>(() => {
    if (loadSaveData) {
      const baseScore = calculateMeritScore(loadSaveData.character, loadSaveData.gameState)
      return baseScore / difficultyConfig.promotionThresholdMultiplier
    }
    // 新游戏统一从知县基准分开始，避免不同出身初始分不同
    return BASE_MERIT_SCORE / difficultyConfig.promotionThresholdMultiplier
  })
  const [promotionMessage, setPromotionMessage] = useState<string | null>(null)
  
  // 身份类型状态
  const [identityType, setIdentityType] = useState<IdentityType>(() => {
    if (loadSaveData) {
      // 从存档中恢复身份类型，默认为官员
      return (loadSaveData as any).identityType || 'official'
    }
    return 'official'
  })
  
  // 游戏结束状态
  const [isGameOver, setIsGameOver] = useState(false)

  // 存档成功提示弹窗状态
  const [saveNotification, setSaveNotification] = useState<{
    isOpen: boolean;
    message: string;
    subMessage: string;
  }>({ isOpen: false, message: '', subMessage: '' })
  
  // 辞官挽留弹窗状态
  const [resignConfirmModal, setResignConfirmModal] = useState<{
    isOpen: boolean;
    choice: EventChoice | null;
    newStateVals: Partial<GameStateValues>;
    newAttrs: typeof character.attributes;
  }>({ isOpen: false, choice: null, newStateVals: {}, newAttrs: character.attributes })
  
  // 作弊模式（幽灵模式）状态
  const [isCheatModeOpen, setIsCheatModeOpen] = useState(false)

  // 存档槽位弹窗状态
  const [isSaveSlotsOpen, setIsSaveSlotsOpen] = useState(false)
  const [saveSlotsMode, setSaveSlotsMode] = useState<'save' | 'load'>('save')

  // 成就系统状态
  const [isAchievementPanelOpen, setIsAchievementPanelOpen] = useState(false)
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null)
  
  // 新手引导状态
  const [showTutorial, setShowTutorial] = useState(() => {
    // 检查是否是第一次玩游戏
    const hasSeenTutorial = localStorage.getItem('chongzhen_tutorial_seen')
    return !hasSeenTutorial && !loadSaveData
  })
  const [showHelp, setShowHelp] = useState(false)
  
  const handleTutorialComplete = () => {
    localStorage.setItem('chongzhen_tutorial_seen', 'true')
    setShowTutorial(false)
  }

  // 游玩时间追踪（用于存档显示）
  const [playTime] = useState<number>(() => {
    if (loadSaveData && (loadSaveData as any).playTime) {
      return (loadSaveData as any).playTime
    }
    return 0
  })

  // 生平记录系统
  const [lifeRecords, setLifeRecords] = useState<LifeRecord[]>(() => {
    if (loadSaveData) {
      return (loadSaveData as any).lifeRecords || []
    }
    return []
  })
  
  // 生平回顾界面状态
  const [isLifeReviewOpen, setIsLifeReviewOpen] = useState(false)
  
  // 死亡结局状态（用于连接生平回顾）
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

  // 人物志（结局达成时自动生成）
  const [biography, setBiography] = useState<string>('')

  // 当 loadSaveData 变化时（读档），恢复存档数据
  useEffect(() => {
    if (loadSaveData) {
      const char = loadSaveData.character
      // 确保进士有地方官任职flag
      const flags = char.degree === '进士' && !char.flags.includes('地方官任职')
        ? [...char.flags, '地方官任职']
        : char.flags

      // 兼容旧存档：faction 字段缺失时填默认值，避免再次读档把它覆盖丢
      const faction = (char as any).faction || {
        东林好感: 50,
        阉党好感: 50,
        立场: '未定',
        党争烈度: 30
      }

      const fixedCharacter = {
        ...char,
        // 兼容旧存档：courtesyName / hometown 字段缺失时填空串
        courtesyName: char.courtesyName || '',
        hometown: char.hometown || '',
        flags,
        faction
      }
      
      // 兼容旧存档
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
      // 恢复事件卡：有 currentEvent 对象就直接恢复（最新的自动存档都会存整个对象）
      // 没有就保持 null（玩家下次点"下月"会查新事件）
      setCurrentEvent((loadSaveData as any).currentEvent || null)

      // 注意：成就数据由下方 mount-only useEffect 统一初始化（处理"读档时恢复 / 新游戏时清空"两种情况）

      setMeritScore(currentScore)
      setPreviousMeritScore(currentScore)
      
      if ((loadSaveData as any).identityType) {
        setIdentityType((loadSaveData as any).identityType)
      }
    }
  }, [loadSaveData])

  // 所有出身统一从正七品知县开始，此函数已不再使用
  // function getRankByDegree(deg: DegreeType, _originType: OriginType): string {
  //   if (deg !== '进士') return ''
  //   return '正七品·知县'
  // }

  function createInitialCharacter(
    originType: OriginType,
    deg: DegreeType,
    attrs: Attributes
  ): Character {
    const originData = origins[originType]
    const hidden = originData.initialHidden

    // 起始年龄：玩家在 NameInput 自定义 → 优先；否则按身份默认（进士 22 / 举人 24 / 其他 16-21）
    const defaultAge = deg === '进士' ? 22 : deg === '举人' ? 24 : 16 + Math.floor(Math.random() * 6)
    const initialAge = (playerCustomAge != null && playerCustomAge >= 16) ? playerCustomAge : defaultAge

    const tempCharacter = {
      name: playerName || '',
      courtesyName: playerCourtesyName || '',  // 字（开局由 NameInput 自动生成或玩家自填）
      hometown: playerHometown || '',          // 籍贯（开局玩家自填或随机抽）
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

  // 推断当前剧情线：从 eventHistory 末尾往前找第一个有 storyline 的事件
  const getCurrentStoryline = useCallback((): string | undefined => {
    const allEvents = [...initialEvents, ...allGrayChoiceEvents]
    for (let i = eventHistory.length - 1; i >= Math.max(0, eventHistory.length - 5); i--) {
      const id = eventHistory[i]
      const ev = allEvents.find(e => e.id === id)
      if (ev?.storyline) return ev.storyline
    }
    return undefined
  }, [eventHistory])

  // 把当前剧情线 key 稳定住，避免 StorylineBar (memo) 抖动
  const currentStorylineKey = useMemo(() => getCurrentStoryline(), [getCurrentStoryline])

  const findAvailableEvent = useCallback((): GameEvent | null => {
    // 合并所有事件（初始事件 + 灰色支线；结局由 BoundaryEventManager 触发，不入池）
    const allEvents = [...initialEvents, ...allGrayChoiceEvents]
    const available = allEvents.filter(e => checkEventConditions(e, character, gameState))
    return pickEvent(available, eventHistory, getCurrentStoryline())
  }, [character, gameState, eventHistory, getCurrentStoryline])

  const handleChoice = useCallback((choice: EventChoice) => {
    // 正确处理 Map 类型的序列化
    const charForSnapshot = {
      ...character
    }
    const snapshotChar = JSON.parse(JSON.stringify(charForSnapshot))
    const snapshotState = JSON.parse(JSON.stringify(gameState))

    let newAttrs = { ...character.attributes }
    
    // 处理体质消耗
    if (choice.staminaCost && choice.staminaCost > 0) {
      newAttrs.体质 = Math.max(0, newAttrs.体质 - choice.staminaCost)
    }
    
    // 处理体质奖励
    if (choice.staminaBonus && choice.staminaBonus > 0) {
      const bounds = ATTR_BOUNDS.体质
      newAttrs.体质 = Math.max(bounds.min, Math.min(bounds.max, newAttrs.体质 + choice.staminaBonus))
    }
    
    if (choice.effects.attributes) {
      for (const [key, value] of Object.entries(choice.effects.attributes)) {
        // 使用映射将旧属性名转换为新属性名
        const mappedKey = ATTR_MAP[key] || key
        const attrKey = mappedKey as keyof Attributes
        const bounds = ATTR_BOUNDS[attrKey] || { min: 0, max: 150 }
        // 应用难度系数
        let adjustedValue = value * difficultyConfig.attributeMultiplier
        // 出身特性修正
        adjustedValue = applyOriginModifier(character.origin, mappedKey, adjustedValue)
        newAttrs[attrKey] = Math.max(bounds.min, Math.min(bounds.max, (newAttrs[attrKey] || 0) + adjustedValue))
      }
    }

    let newStateVals = { ...gameState }
    if (choice.effects.gameState) {
      for (const [key, value] of Object.entries(choice.effects.gameState)) {
        // 使用映射将旧状态名转换为新状态名
        const mappedKey = STATE_MAP[key] || key
        const stateKey = mappedKey as keyof GameStateValues
        // 跳过非数值类型的key
        if (stateKey === 'currentYear' || stateKey === 'currentMonth' || stateKey === 'turn') continue
        
        const currentVal = (newStateVals[stateKey] as number) || 0
        // 出身特性修正
        const adjustedStateValue = applyOriginStateModifier(character.origin, mappedKey, value)
        // 所有属性范围：0 ~ 100
        newStateVals[stateKey] = Math.max(0, Math.min(100, currentVal + adjustedStateValue))
      }
    }

    const attrsForCheck = { ...newAttrs } as Record<string, number>
    const stateForCheck = { ...newStateVals } as Record<string, number>
    const hiddenForCheck = { ...character.hidden } as Record<string, number>

    setUndoHistory(prev => [...prev, {
      character: snapshotChar,
      gameState: snapshotState,
      eventHistory: [...eventHistory]
    }])

    setCharacter(prev => {
      const newChar = { ...prev }
      newChar.attributes = newAttrs
      
      // 添加历史记录
      const currentEventTitle = currentEvent?.title || '未知事件'
      const historyEntry = `${gameState.currentYear}年${gameState.currentMonth}月：${currentEventTitle} - ${choice.text}`
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

      // 派系状态联动：根据 flag 变化自动更新派系好感度和立场
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

        // 根据清议/中官属性变化间接影响派系好感
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
    
    // 记录生平事件
    addLifeRecord({
      year: gameState.currentYear,
      month: gameState.currentMonth,
      type: currentEvent?.type === 'historical' ? 'event' : 'choice',
      title: currentEvent?.title || '未知事件',
      description: choice.text,
      impact: choice.resultDescription || choice.result?.title,
      attributesChange: choice.effects.attributes,
      gameStateChange: choice.effects.gameState,
      hiddenChange: choice.effects.hidden,
      relatedEvent: currentEvent?.id
    })

    // 处理政绩分变化
    if (choice.effects.meritScore !== undefined) {
      const baseChange = choice.effects.meritScore
      // 重要事件翻倍
      const eventMultiplier = (currentEvent?.type === 'historical' || currentEvent?.type === 'ending') ? 2 : 1
      // 应用难度系数
      const finalChange = baseChange * eventMultiplier * difficultyConfig.meritScoreMultiplier
      
      setPreviousMeritScore(prev => prev + finalChange)
      
      // 显示政绩分变化提示
      if (finalChange !== 0) {
        const changeText = finalChange > 0 ? `+${Math.round(finalChange)}` : `${Math.round(finalChange)}`
        setPromotionMessage(`政绩分变化：${changeText}`)
        setTimeout(() => setPromotionMessage(null), 2000)
      }
    }

    // 处理特殊效果（如结局）
    if (choice.effects.special?.type === 'ending') {
      // 检查是否是主动辞官/归隐类结局，显示挽留弹窗
      const isResignEnding = choice.text.includes('辞官') || 
                             choice.text.includes('归隐') || 
                             choice.text.includes('请辞') ||
                             choice.text.includes('致仕') ||
                             choice.text.includes('挂冠') ||
                             choice.text.includes('急流勇退') ||
                             choice.text.includes('隐姓埋名');
      
      if (isResignEnding) {
        // 显示挽留弹窗，不立即结束游戏
        setResignConfirmModal({
          isOpen: true,
          choice: choice,
          newStateVals: newStateVals,
          newAttrs: newAttrs
        });
        return;
      }
      
      // 其他结局直接结束游戏
      handleGameOver(currentEvent ?? undefined);
      return;
    }

    setGameState(prev => {
      const newState = { ...prev, ...newStateVals }
      // 确保属性在合理范围内
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

    // 立即检查边界事件（不使用 setTimeout，使用计算好的新值）
    try {
      const params = {
        attributes: attrsForCheck,
        gameState: stateForCheck,
        hidden: hiddenForCheck,
        faction: character.faction,
        flags: character.flags,
        currentYear: gameState.currentYear,
        currentMonth: gameState.currentMonth
      }

      const triggeredEvent = boundaryEventManager.checkByType(params, 'ending')

      if (triggeredEvent) {
        // 财帛归零直接触发游戏结束
        if (triggeredEvent.id === 'bankrupt') {
          const bankruptEndingEvent: GameEvent = {
            id: 'ending_bankrupt',
            title: '【结局】倾家荡产',
            description: `你的银两已经耗尽，再也无法维持生计。

债主们堵上了门，官府也下了文书——再不还钱就要抄家问罪。

你这一生，终究是在贫困潦倒中落下了帷幕。`,
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
  }, [character, gameState, eventHistory])

  const checkBoundary = useCallback(() => {
    try {
      if (!character?.attributes || !gameState) return false

      if (currentEvent?.id?.startsWith('boundary_')) return false

      const params = {
        attributes: { ...character.attributes } as Record<string, number>,
        gameState: { 圣眷: gameState.圣眷, 中官: gameState.中官, 清议: gameState.清议, 士绅: gameState.士绅, 民望: gameState.民望, 国势: gameState.国势 },
        hidden: { ...character.hidden } as Record<string, number>,
        faction: character.faction,
        flags: character.flags,
        currentYear: gameState.currentYear,
        currentMonth: gameState.currentMonth
      }

      const triggeredEvent = boundaryEventManager.checkByType(params, 'ending')
      if (triggeredEvent) {
        // 财帛归零直接触发游戏结束
        if (triggeredEvent.id === 'bankrupt') {
          const bankruptEndingEvent: GameEvent = {
            id: 'ending_bankrupt',
            title: '【结局】倾家荡产',
            description: `你的银两已经耗尽，再也无法维持生计。

债主们堵上了门，官府也下了文书——再不还钱就要抄家问罪。

你这一生，终究是在贫困潦倒中落下了帷幕。`,
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
        // 其他叙事结局（如 ending_zhongxing_success / ending_martyr_nation 等）也直接结束游戏
        setCurrentEvent(triggeredEvent.event)
        handleGameOver(triggeredEvent.event)
        return true
      }
    } catch (e) {
      console.error('checkBoundary error:', e)
    }
    return false
  }, [character?.attributes, gameState, currentEvent?.id])

  const handleNextMonth = useCallback(() => {
    setIsProcessing(true)
    setUndoHistory([])

    setGameState(prev => {
      let newMonth = prev.currentMonth + 1
      let newYear = prev.currentYear

      if (newMonth > 12) {
        newMonth = 1
        newYear++
      }

      const current国势 = prev.国势 ?? 75
      let 国势Decay = 0
      // 应用难度系数调整国势衰减
      const decayMultiplier = difficultyConfig.countryPowerDecay
      if (newYear >= 1636) {
        国势Decay = -1 * decayMultiplier
      }
      if (newYear >= 1640) {
        国势Decay = -2 * decayMultiplier
      }
      if (newYear >= 1643) {
        国势Decay = -3 * decayMultiplier
      }

      const newState = {
        ...prev,
        currentMonth: newMonth,
        currentYear: newYear,
        turn: prev.turn + 1,
        国势: Math.max(0, Math.min(100, current国势 + 国势Decay))
      }

      // 使用新的状态来查找事件
      setTimeout(() => {
        if (checkBoundary()) {
          setIsProcessing(false)
          return
        }
        // 临时更新gameState来查找事件
        const event = findAvailableEventWithState(newState)
        setCurrentEvent(event)
        if (event) {
          setEventHistory(prevHistory => [...prevHistory, event.id])
        }
        setIsProcessing(false)
        // 检查成就
        checkAchievements()
      }, 300)

      return newState
    })

    setCharacter(prev => ({
      ...prev,
      age: prev.age + 1 / 12
    }))
  }, [findAvailableEvent, checkBoundary, character])

  // 使用指定状态查找可用事件的辅助函数
  const findAvailableEventWithState = useCallback((state: GameStateValues): GameEvent | null => {
    // 合并所有事件（初始事件 + 灰色支线；结局由 BoundaryEventManager 触发，不入池）
    const allEvents = [...initialEvents, ...allGrayChoiceEvents]
    const available = allEvents.filter(e => checkEventConditions(e, character, state))
    return pickEvent(available, eventHistory, getCurrentStoryline())
  }, [character, eventHistory, getCurrentStoryline])

  // 找当月所有可触发事件（主事件 1 个 + 支线最多 2 个），按"主优先"顺序返回数组
  // 用于"同月多事件"机制
  const findAllEventsForState = useCallback((state: GameStateValues): GameEvent[] => {
    const allEvents = [...initialEvents, ...allGrayChoiceEvents]
    const recentIds = eventHistory.slice(-5)
    const available = allEvents.filter(e => checkEventConditions(e, character, state))
    if (available.length === 0) return []

    const results: GameEvent[] = []

    // 1) 主事件 1 个：historical 优先
    const historical = available.filter(e => e.type === 'historical' && !eventHistory.includes(e.id) && !recentIds.includes(e.id))
    if (historical.length > 0) {
      results.push(historical[Math.floor(Math.random() * historical.length)])
    } else {
      // 1.5) 结局前奏事件：isPreEnding 强制优先（比普通 transition 优先级更高）
      const prelude = available.find(
        e => e.type === 'transition' && e.isPreEnding === true && !eventHistory.includes(e.id) && !recentIds.includes(e.id)
      )
      if (prelude) {
        results.push(prelude)
      } else {
        // 2) 次选 transition
        const transition = available.filter(e => e.type === 'transition' && !eventHistory.includes(e.id) && !recentIds.includes(e.id))
        if (transition.length > 0) {
          results.push(transition[Math.floor(Math.random() * transition.length)])
        }
      }
    }

    // 3) 支线（emotion/gray）条件满足的最多 2 个
    //    - emotion 情感线事件 play once：必须全局未触发过（eventHistory）
    //    - gray 灰色事件：滑动窗口去重（最近 5 个月不重复），允许后续条件满足时再触发
    //    - 同时尊重 recentIds（最近 5 个月不重复，避免同月/连月刷屏）
    const branchEmotion = available.filter(
      e => e.type === 'emotion' && !eventHistory.includes(e.id) && !recentIds.includes(e.id)
    )
    const branchGray = available.filter(
      e => e.type === 'gray' && !recentIds.includes(e.id)
    )
    const branchShuffled = [...branchEmotion, ...branchGray].sort(() => Math.random() - 0.5)
    const branchPick = branchShuffled.slice(0, 2) // 最多 2 个支线
    results.push(...branchPick)

    return results
  }, [character, eventHistory])

  const handleContinue = useCallback(() => {
    // 优先处理当月队列（同月多事件）：玩家点"继续"后自动弹出下一个
    if (pendingEvents.length > 0) {
      const [next, ...rest] = pendingEvents
      setCurrentEvent(next)
      setPendingEvents(rest)
      return
    }

    setCurrentEvent(null)
    setIsProcessing(true)
    setUndoHistory([])

    setGameState(prev => {
      let newMonth = prev.currentMonth + 1
      let newYear = prev.currentYear
      if (newMonth > 12) {
        newMonth = 1
        newYear++
      }

      const newState = {
        ...prev,
        currentMonth: newMonth,
        currentYear: newYear,
        turn: prev.turn + 1
        // 帝心和国势不再自动变化，只通过事件影响
      }

      // 使用新的状态来查找事件
    setTimeout(() => {
      if (checkBoundary()) {
        setIsProcessing(false)
        return
      }
      // 找当月所有可触发事件（主事件+支线，入队处理）
      const allEvents = findAllEventsForState(newState)
      if (allEvents.length > 0) {
        setCurrentEvent(allEvents[0])
        setPendingEvents(allEvents.slice(1))
        setEventHistory(prevHistory => [...prevHistory, ...allEvents.map(e => e.id)])
      } else {
        setCurrentEvent(null)
      }
      // 检查成就
      checkAchievements()
      setIsProcessing(false)
    }, 300)

      return newState
    })

    setCharacter(prev => ({
      ...prev,
      age: prev.age + 1 / 12
    }))
  }, [pendingEvents, findAllEventsForState, checkBoundary, character])

  const handleUndo = useCallback(() => {
    if (undoHistory.length === 0) return
    
    const snapshot = undoHistory[undoHistory.length - 1]
    
    // 恢复状态，保持 currentEvent 不变
    // 将普通对象转回 Map
    setCharacter({
      ...snapshot.character
    })
    setGameState(snapshot.gameState)
    setEventHistory(snapshot.eventHistory)
    setUndoHistory(prev => prev.slice(0, -1))
  }, [undoHistory])

  const handleSave = useCallback(() => {
    setSaveSlotsMode('save')
    setIsSaveSlotsOpen(true)
  }, [])

  const handleSaveToSlot = useCallback((slotId: number) => {
    const charForSave = {
      ...character
    }
    const saveData: SaveData = {
      character: charForSave as any,
      gameState,
      eventHistory,
      origin,
      degree,
      playerName: character.name || playerName || '',
      identityType,
      lifeRecords,
      savedAt: new Date().toISOString(),
      playTime,
      // 把当前成就数据一起存档（每个存档独立）
      achievements: loadAchievements()
    }
    const ok = saveSaveSlot(slotId, saveData)
    setIsSaveSlotsOpen(false)
    if (ok) {
      setSaveNotification({
        isOpen: true,
        message: '存档成功',
        subMessage: `${character.name || '无名氏'} · ${gameState.currentYear}年${gameState.currentMonth}月 · ${character.rank}`
      })
    } else {
      setSaveNotification({
        isOpen: true,
        message: '存档失败',
        subMessage: 'localStorage 写入异常，请检查浏览器存储空间或隐私模式设置'
      })
    }
  }, [character, gameState, eventHistory, origin, degree, playerName, identityType, lifeRecords, playTime])

  const handleLoadFromSlot = useCallback((slotId: number) => {
    const saveData = loadSaveSlot(slotId)
    if (saveData) {
      // 触发重新加载
      setIsSaveSlotsOpen(false)
      // 通过 props 传递数据
      if (onReturnToMenu) {
        onReturnToMenu()
        setTimeout(() => {
          // 使用 window 事件通知 App 组件
          window.dispatchEvent(new CustomEvent('loadSave', { detail: saveData }))
        }, 100)
      }
    }
  }, [onReturnToMenu])

  // 成就检查函数
  const checkAchievements = useCallback((hasEnded?: boolean, endingType?: string) => {
    const ctx: AchievementContext = {
      attributes: character.attributes,
      gameState: gameState,
      characterRank: character.rank,
      eventHistory: eventHistory,
      hasEnded: hasEnded,
      endingType: endingType
    }
    const newlyUnlocked = checkAndUnlockAchievements(ctx)
    if (newlyUnlocked.length > 0) {
      // 逐个显示成就解锁弹窗
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
  }, [character, gameState, eventHistory])

  // 检测结局类型
  const getEndingType = useCallback((event?: GameEvent | null): 'legendary' | 'good' | 'normal' | 'bad' | 'tragic' => {
    const attrs = character.attributes
    const hidden = character.hidden
    const state = gameState
    
    // 先检查是否有结局事件
    if (event) {
      const eventId = event.id
      const endingTitle = event.title
      
      // 传奇结局 - 太师+高属性
      const isLegendary = character.rank === '正一品·太师' && 
        state.民望 >= 80 && 
        state.圣眷 >= 70 && 
        hidden.道德值 >= 70 &&
        attrs.理政 >= 70
      
      if (isLegendary) return 'legendary'
      
      // 功成身退 - 主动辞官且高属性
      const isRetire = eventId.includes('retire') || endingTitle.includes('归隐') || endingTitle.includes('辞官')
      if (isRetire && hidden.道德值 >= 70 && state.民望 >= 60) return 'good'
      
      // 鞠躬尽瘁 - 病逝且高道德
      const isDeath = eventId.includes('death') || endingTitle.includes('病逝') || endingTitle.includes('油尽灯枯')
      if (isDeath && hidden.道德值 >= 60) return 'good'
      
      // 贬谪/庶民 - 坏结局
      if (eventId.includes('demotion') || endingTitle.includes('革职') || endingTitle.includes('庶民')) return 'bad'
      
      // 帝怒/众叛亲离 - 悲剧结局
      if (eventId.includes('emperor') || eventId.includes('moral') || endingTitle.includes('众叛亲离')) return 'tragic'
    }
    
    // 检查属性归零情况
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
    
    // 道德值归零 - 悲剧
    if (triggerAttr === '道德值') return 'tragic'
    // 圣眷归零 - 坏结局
    if (triggerAttr === '圣眷') return 'bad'
    // 其他属性归零 - 普通结局
    if (triggerAttr) return 'normal'
    
    // 默认普通结局
    return 'normal'
  }, [character, gameState])

  // 游戏结束处理 - 显示游戏结束页面
  const handleGameOver = useCallback((event?: GameEvent) => {
    const endingType = getEndingType(event)
    // 检查结局相关成就
    checkAchievements(true, endingType)
    // 结局专用：解锁该具体结局的成就 + 人物志
    if (event) {
      setEventHistory(prev => prev.includes(event.id) ? prev : [...prev, event.id])
      triggerEndingAchievements(event)
      const bio = generateBiography(character, gameState, event, lifeRecords)
      setBiography(bio)
    }
    setIsGameOver(true)
  }, [getEndingType, checkAchievements, character, gameState, lifeRecords])
  
  // 再入仕途 - 保留角色属性，重新开始游戏
  const handleRestart = useCallback(() => {
    // 保留角色属性，重置游戏状态
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
  
  // 归园田居 - 返回主菜单
  const handleReturnToMenu = useCallback(() => {
    // 不删除存档，只是返回主菜单
    setIsGameOver(false)
    // 通知父组件返回主菜单
    if (onReturnToMenu) {
      onReturnToMenu()
    }
  }, [onReturnToMenu])

  // 记录生平事件的函数
  const addLifeRecord = useCallback((record: Omit<LifeRecord, 'id'>) => {
    const newRecord: LifeRecord = {
      ...record,
      id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    setLifeRecords(prev => [...prev, newRecord])
  }, [])

  // 处理死亡结局
  const handleDeathEnding = useCallback((ending: {
    type: 'martyrdom' | 'suicide' | 'killed' | 'execution'
    title: string
    description: string
    echo: string
    tags: string[]
  }) => {
    // 记录死亡事件
    addLifeRecord({
      year: gameState.currentYear,
      month: gameState.currentMonth,
      type: 'death',
      title: ending.title,
      description: ending.description,
      impact: ending.echo
    })
    // 显示死亡结局界面
    setDeathEndingState({
      show: true,
      ...ending
    })
  }, [gameState.currentYear, gameState.currentMonth, addLifeRecord])

  // 生成生平总结
  const generateLifeSummary = useCallback((): LifeSummary => {
    const startYear = 1628
    const endYear = gameState.currentYear
    
    // 根据属性生成评价
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
    
    // 生成成就列表
    const achievements: string[] = []
    if (character.promotionCount >= 3) achievements.push(`历经${character.promotionCount}次升迁`)
    if (character.attributes.理政 >= 70) achievements.push('政绩斐然')
    if (character.attributes.文韬 >= 70) achievements.push('文采出众')
    if (character.attributes.武略 >= 70) achievements.push('武艺超群')
    if (gameState.圣眷 >= 70) achievements.push('深受皇恩')
    if (gameState.民望 >= 70) achievements.push('深得民心')
    if (character.hidden.道德值 >= 70) achievements.push('清廉自守')
    
    // 生成争议列表
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
  }, [character, gameState, lifeRecords])

  // 组件挂载/读档时初始化第一个事件
  useEffect(() => {
    // 避免重复执行：如果已经有当前事件，不执行
    if (currentEvent) return
    // handleContinue 期间不抢，避免双触发
    if (isProcessing) return

    // 检查成就 - 游戏开始时检查初始状态的成就
    checkAchievements()

    // 检查边界条件（内联逻辑，避免依赖checkBoundary导致的循环）
    const params = {
      attributes: { ...character.attributes } as Record<string, number>,
      gameState: { 圣眷: gameState.圣眷, 中官: gameState.中官, 清议: gameState.清议, 士绅: gameState.士绅, 民望: gameState.民望, 国势: gameState.国势 },
      hidden: { ...character.hidden } as Record<string, number>,
      faction: character.faction,
      flags: character.flags
    }

    // 优先检查结局类边界事件
    const endingEvent = boundaryEventManager.checkByType(params, 'ending')
    if (endingEvent) {
      setCurrentEvent(endingEvent.event)
      if (endingEvent.id === 'bankrupt') {
        setIsGameOver(true)
      }
      return
    }

    // 检查危机类边界事件（带随机性）
    const crisisEvent = boundaryEventManager.checkByType(params, 'crisis')
    if (crisisEvent && Math.random() < 0.3) {
      setCurrentEvent(crisisEvent.event)
      return
    }

    // 找当月所有可触发事件（主事件+支线，入队处理）；如果当月没事件（比如读档时存档月份已经走完），
    // 自动推进到下一个有事件的月份，最多推进 24 个月（2 年），
    // 避免玩家读档后看到"暂无事件"必须手动点下月。
    let allEvents = findAllEventsForState(gameState)
    let newState = gameState
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
      // 同步推进 gameState 并设置事件
      if (newState !== gameState) setGameState(newState)
      setCurrentEvent(allEvents[0])
      setPendingEvents(allEvents.slice(1))
      setEventHistory(prev => [...prev, ...allEvents.map(e => e.id)])
    }
  }, [character, gameState, eventHistory, currentEvent, isProcessing, checkAchievements, findAllEventsForState])

  // 注意：成就数据由 App.tsx 的新游戏/读档事件处理函数显式初始化（handleStart / handleLoadSaveEvent / handleLoadAutosave / handleSelectSaveSlot），
  // 不再在 mount effect 里清空，避免 React 18 StrictMode 双 mount / Vite HMR 重挂载时
  // 重复执行 setAchievementData({unlocked:[],...}) 把已经解锁的成就数据清掉，
  // 导致后续 checkAchievements 把已解锁的成就误判为"新解锁"而重复弹窗。
  // 荣誉一旦获得就跟存档一辈子——本存档解锁过就不会再弹窗。

  // ==========================================
  // 自动存档：每次状态变化时静默写入
  // ==========================================
  // 触发点：character / gameState / eventHistory 任一变化（处理完事件或下月）时写入。
  // 与手动存档 1/2/3 号槽完全独立，玩家无法在手动存档 UI 中误删。
  //
  // 关键：事件刚出现时（currentEvent 有值）也要写——否则存档一直停在"上个月"，
  //       玩家在事件卡上退到主菜单再继续，会发现回到了旧状态。
  // 只跳过 isProcessing（setTimeout 异步查事件过程中的中间态）。
  // 性能优化: 引用保存 setTimeout id，避免依赖变化时多次排程 / 卸载时悬挂
  const autosaveTimerRef = useRef<number | null>(null)
  const [lastAutosaveFingerprint, setLastAutosaveFingerprint] = useState<string>('')
  useEffect(() => {
    // 跳过中间态：正在异步查事件时（isProcessing=true）不写
    if (isProcessing) return
    if (!character || !gameState) return // 数据未就绪
    if (gameState.currentYear < 1628) return // 防止极早期未初始化
    if (gameState.currentMonth < 1 || gameState.currentMonth > 12) return

    const charForSave = {
      ...character
    }
    const data: SaveData = {
      character: charForSave as any,
      gameState,
      eventHistory,
      currentEventId: currentEvent?.id || null,  // 记下当前正在处理的事件 id
      currentEvent: currentEvent || null,        // 同时存整个事件对象（"继续游戏"时能直接恢复事件卡）
      pendingEvents,                              // 同月多事件队列
      origin,
      degree,
      playerName: character.name || playerName || '',
      identityType,
      lifeRecords,
      savedAt: new Date().toISOString(),
      playTime,
      achievements: loadAchievements()
    }

    // 用拼接字符串替代 JSON.stringify 做 fingerprint，性能更好
    const fingerprint = `${gameState.currentYear}|${gameState.currentMonth}|${gameState.turn}|${eventHistory.length}|${character.attributes.财帛}|${character.attributes.文韬}|${character.attributes.理政}|${character.attributes.武略}|${character.attributes.体质}|${gameState.圣眷}|${gameState.中官}|${gameState.清议}|${gameState.士绅}|${gameState.民望}|${gameState.国势}|${character.flags.length}|${currentEvent?.id || ''}`
    if (fingerprint === lastAutosaveFingerprint) return

    // 性能优化: 400ms debounce - 避免连续多属性修改触发多次 localStorage 写入
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
    }
    autosaveTimerRef.current = window.setTimeout(() => {
      saveAutosave(data)
      setLastAutosaveFingerprint(fingerprint)
      autosaveTimerRef.current = null
    }, 400)

    return () => {
      // 清理函数 - 组件卸载或依赖变化时取消未触发的写入
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)
        autosaveTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, gameState, eventHistory, currentEvent, isProcessing])

  // 升官贬官检查 useEffect
  useEffect(() => {
    // 计算当前政绩分
    const baseScore = calculateMeritScore(character, gameState)
    // 应用难度系数调整实际有效的政绩分
    const adjustedScore = baseScore / difficultyConfig.promotionThresholdMultiplier
    
    // 更新政绩分显示（显示原始分数，不显示调整后的值）
    setMeritScore(baseScore)
    
    // 只有官员身份才能升官/贬官
      if (identityType === 'official') {
        // 检查是否升官（当前分数 vs 上一次记录的分数）
        const promotion = checkPromotion(adjustedScore, previousMeritScore)
        if (promotion.promoted && promotion.message) {
          setPromotionMessage(promotion.message)
          // 更新角色官职、升迁次数并添加历史记录
          setCharacter(prev => ({
            ...prev,
            rank: promotion.newRank || prev.rank,
            promotionCount: prev.promotionCount + 1,  // 增加升迁次数
            history: [...prev.history, `${gameState.currentYear}年${gameState.currentMonth}月：${promotion.message}`]
          }))
          // 记录升迁事件
          addLifeRecord({
            year: gameState.currentYear,
            month: gameState.currentMonth,
            type: 'promotion',
            title: '官升一级',
            description: promotion.message,
            impact: `晋升为${promotion.newRank}`
          })
          // 升官后额外加缓冲分，防止刚升官就贬官
          const bonus = promotion.scoreBonus ?? 0
          if (bonus > 0) {
            setPreviousMeritScore(prev => prev + bonus)
          }
          // 检查成就 - 升官后检查成就
          setTimeout(() => checkAchievements(), 100)
          // 3秒后清除消息
          setTimeout(() => setPromotionMessage(null), 3000)
        }
        
        // 检查是否贬官
        const demotion = checkDemotion(adjustedScore, previousMeritScore, character, gameState)
        if (demotion.demoted && demotion.message) {
          // 如果被革职为庶民，触发游戏结束
          if (demotion.newIdentity === 'civilian' || demotion.newIdentity === 'exiled') {
            // 记录贬官事件
            addLifeRecord({
              year: gameState.currentYear,
              month: gameState.currentMonth,
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
                    ? `【结局·流放边疆】

宁古塔的风像刀子一样割在脸上。

你在这里已经待了三年。三年里，你见过零下四十度的严寒，见过被冻死在路边的流民，见过驻防将军鞭打逃卒时溅出的血点。

起初你还想着翻案、想着申诉。后来你就不想了。在这片苦寒之地，活着本身就是一种奢侈。

你开始学着和当地的女真人打交道，学着种他们叫做"哈拉"的庄稼，学着在暴风雪来临前把地窖封好。

某年冬天，一个来自京城的信使带来了消息：崇祯帝自缢于煤山，大顺军攻入北京。

你站在雪地里，看着南方的天空，久久没有说话。

第二天，人们发现你坐在地窖门口，脸上带着一种奇怪的表情——像是释然，又像是悲哀。

手里攥着一封没写完的信，收信人写着两个字："陛下"。
`
                    : `【结局·革职为民】

回乡的路比想象中更长。

不是距离上的远——而是当你以一个庶民的身份走在曾经管辖过的土地上时，那种物是人非的感觉几乎让人窒息。

你路过自己曾经审过案的县衙，门口的差役换了一批又一批，没人认得你。你在路边摊吃了一碗面，味道和你当年微服私访时吃过的一模一样，但心境已天差地别。

你在老家置了几亩薄田，日出而作，日落而息。日子过得清贫倒也安稳。

偶尔有旧识路过来看你，你们喝茶聊天，谁也不提当年的事。只有临走时，他们会多看你一眼，眼神里有惋惜，也有某种说不清的释然。

你活到了六十三岁。去世那天是一个普通的秋日，阳光很好，院子里的菊花开了。

你没有留下什么丰功伟绩，也没有留下什么骂名。就像这世间千千万万的普通人一样，来过，走过，然后离开了。

《县志》载："某公，曾为朝廷命官，后因故罢归。居家课子，乡党称善。"
`
                }
              }],
              type: 'ending'
            }
            setCurrentEvent(demotionEndingEvent)
            setIsGameOver(true)
            return
          }
          
          // 普通贬官（降级但仍是官员）
          setPromotionMessage(demotion.message)
          setCharacter(prev => ({
            ...prev,
            rank: demotion.newRank || prev.rank,
            demotionCount: prev.demotionCount + 1,  // 增加贬官次数
            history: [...prev.history, `${gameState.currentYear}年${gameState.currentMonth}月：${demotion.message}（第${prev.demotionCount + 1}次贬官）`]
          }))
          // 记录贬官事件
          addLifeRecord({
            year: gameState.currentYear,
            month: gameState.currentMonth,
            type: 'demotion',
            title: '贬官一级',
            description: demotion.message,
            impact: `贬为${demotion.newRank}`
          })
          // 检查成就 - 贬官后检查成就
          setTimeout(() => checkAchievements(), 100)
          setTimeout(() => setPromotionMessage(null), 3000)
        }
      }
    
    // 更新上一次记录的分数（用于下次比较，使用调整后的分数）
    setPreviousMeritScore(adjustedScore)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.attributes.理政, character.attributes.文韬, character.attributes.武略, character.attributes.财帛, character.hidden.道德值, character.hidden.欲望值, gameState.圣眷, gameState.中官, gameState.清议, gameState.士绅, gameState.民望, difficultyConfig])

  return (
    <div className="game-screen">
      {/* 游戏结束页面 */}
      {isGameOver && (
        <GameOverScreen
          endingEvent={currentEvent}
          character={character}
          gameState={gameState}
          biography={biography}
          onRestart={handleRestart}
          onReturnToMenu={handleReturnToMenu}
          onViewLifeReview={() => setIsLifeReviewOpen(true)}
        />
      )}
      
      {promotionMessage && (
        <div className={`promotion-toast ${promotionMessage.includes('恭喜') ? 'promotion-toast--promote' : 'promotion-toast--demote'}`}>
          {promotionMessage}
        </div>
      )}
      
      <StatusBar
        character={character}
        gameState={gameState}
        degree={degree}
        onCheatClick={() => setIsCheatModeOpen(true)}
      />

      {/* 当前剧情线（游戏主题分组），让玩家在 UI 上看到自己当前所在的叙事走向 */}
      <StorylineBar
        currentStorylineKey={currentStorylineKey}
        eventCount={eventHistory.length}
      />

      {/* 作弊模式（幽灵模式）弹窗 */}
      <CheatMode
        isOpen={isCheatModeOpen}
        onClose={() => setIsCheatModeOpen(false)}
        currentGameState={{
          currentYear: gameState.currentYear,
          currentMonth: gameState.currentMonth,
          turn: 0,
          eventHistory: []
        }}
        currentCharacter={character}
        currentGameStateValues={gameState}
      />
      
      <div className="game-main">
        <aside className="sidebar">
          <AttributePanel
            attributes={character.attributes}
            hidden={character.hidden}
          />
          
          {/* 身份显示 */}
          <div className={`identity-panel identity-panel--${identityType === 'official' ? 'official' : identityType === 'rebel' ? 'rebel' : identityType === 'exiled' ? 'exiled' : 'other'}`}>
            <h4>
              {identityType === 'official' ? '官 职' : 
               identityType === 'rebel' ? '反 贼 身 份' :
               identityType === 'exiled' ? '罪 臣 身 份' :
               identityType === 'retired' ? '归 隐 身 份' : '民 间 身 份'}
            </h4>
            <div className="identity-rank">
              {character.rank}
            </div>
            <div className="identity-desc">
              {identityType === 'official' 
                ? `朝廷命官，当前政绩分${meritScore}，下一级需${RANKS.find(r => r.minScore > meritScore)?.minScore || '已达最高'}分`
                : identityType === 'rebel'
                ? '占山为王，与朝廷为敌'
                : identityType === 'exiled'
                ? '革职查办，待罪之身'
                : identityType === 'retired'
                ? '辞官归隐，不问世事'
                : '一介布衣，无权无势'}
            </div>
          </div>
          
        </aside>

        <main className="main-content">
          <EventDisplay
            event={currentEvent}
            character={character}
            gameState={gameState}
            onChoice={handleChoice}
            onContinue={handleContinue}
            onUndo={handleUndo}
            onGameOver={handleGameOver}
            onDeathEnding={handleDeathEnding}
            canUndo={undoHistory.length > 0}
            isProcessing={isProcessing}
            pendingCount={pendingEvents.length}
          />
        </main>

        <aside className="right-sidebar">
          <StatusPanel
            gameState={gameState}
          />

          {/* 政绩评定（从左边栏搬到右边） */}
          {identityType === 'official' && (
            <div className="merit-panel">
              <h4>政 绩 评 定</h4>
              <div className="merit-score-row">
                <span className="merit-score-label">当前政绩分</span>
                <span className="merit-score-value">{meritScore}</span>
              </div>
              <div className="merit-bar-track">
                <div className="merit-bar-fill" style={{ width: `${Math.min(100, (meritScore / 1100) * 100)}%` }} />
              </div>
              <div className="merit-next">
                下一级需: {RANKS.find(r => r.minScore > meritScore)?.minScore || '已达最高'} 分
              </div>
            </div>
          )}
        </aside>
      </div>

      <ActionBar
        onNextMonth={handleNextMonth}
        onSave={handleSave}
        onOpenAchievements={() => setIsAchievementPanelOpen(true)}
        onOpenHelp={() => setShowHelp(true)}
        onReturnToMenu={handleReturnToMenu}
        turn={gameState.turn}
        canProceed={!currentEvent || isProcessing}
      />

      {/* 辞官挽留确认弹窗 */}
      {resignConfirmModal.isOpen && (
        <div className="modal-overlay" onClick={() => {
          setResignConfirmModal({ isOpen: false, choice: null, newStateVals: {}, newAttrs: character.attributes });
        }}>
          <div className="modal-content resign-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Icon name="warning" size={20} color="#d4a520" style={{ verticalAlign: 'middle', marginRight: 8 }} />皇帝挽留</h2>
            </div>
            <div className="modal-body">
              <p className="resign-warning">
                你上疏请求辞官，皇帝看了你的奏疏，面露不悦：
              </p>
              <p className="resign-quote">
                "朕待你不薄，为何此时要弃朕而去？再考虑考虑吧..."
              </p>
              <p className="resign-hint">
                （辞官后将结束游戏，确定要这么做吗？）
              </p>
            </div>
            <div className="modal-actions">
              <button 
                className="confirm-resign-btn"
                onClick={() => {
                  setResignConfirmModal({ isOpen: false, choice: null, newStateVals: {}, newAttrs: character.attributes });
                  setIsGameOver(true);
                }}
              >
                坚持辞官
              </button>
              <button 
                className="cancel-resign-btn"
                onClick={() => {
                  // 取消辞官，关闭弹窗，不执行任何效果
                  setResignConfirmModal({ isOpen: false, choice: null, newStateVals: {}, newAttrs: character.attributes });
                }}
              >
                收回奏疏
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 死亡结局界面 */}
      <DeathEnding
        isOpen={deathEndingState.show}
        endingType={deathEndingState.type}
        title={deathEndingState.title}
        description={deathEndingState.description}
        echo={deathEndingState.echo}
        tags={deathEndingState.tags}
        onClose={() => {
          setDeathEndingState(prev => ({ ...prev, show: false }))
          setIsLifeReviewOpen(true)
        }}
        onRestart={handleRestart}
      />

      {/* 生平回顾界面 */}
      <LifeReview
        isOpen={isLifeReviewOpen}
        lifeRecords={lifeRecords}
        lifeSummary={generateLifeSummary()}
        character={character}
        finalGameState={gameState}
        endingEvent={currentEvent ?? undefined}
        onClose={() => setIsLifeReviewOpen(false)}
        onRestart={handleRestart}
      />

      {/* 存档成功提示弹窗 */}
      <SaveNotification
        isOpen={saveNotification.isOpen}
        onClose={() => setSaveNotification(prev => ({ ...prev, isOpen: false }))}
        message={saveNotification.message}
        subMessage={saveNotification.subMessage}
      />

      {/* 存档槽位选择弹窗 */}
      <SaveSlotsModal
        isOpen={isSaveSlotsOpen}
        mode={saveSlotsMode}
        currentData={{
          name: character.name || '无名氏',
          year: gameState.currentYear,
          month: gameState.currentMonth,
          rank: character.rank,
          title: identityType === 'official' ? '官员' : identityType === 'civilian' ? '平民' : '其他'
        }}
        onSelect={saveSlotsMode === 'save' ? handleSaveToSlot : handleLoadFromSlot}
        onLoadAutosave={() => {
          setIsSaveSlotsOpen(false)
          const raw = localStorage.getItem('chongzhen_autosave')
          if (!raw) return
          try {
            const saveData = JSON.parse(raw) as SaveData
            if (saveData && saveData.character && saveData.gameState) {
              // 直接通过事件加载，不调用 onReturnToMenu（避免清空 loadSaveData）
              window.dispatchEvent(new CustomEvent('loadSave', { detail: saveData }))
            }
          } catch (e) {
            console.error('[onLoadAutosave] failed:', e)
          }
        }}
        onClose={() => setIsSaveSlotsOpen(false)}
      />

      {/* 成就解锁弹窗 */}
      {newAchievement && (
        <AchievementUnlock
          achievementName={newAchievement.name}
          achievementDescription={newAchievement.description}
          achievementIcon={newAchievement.icon}
          isOpen={true}
          onClose={() => setNewAchievement(null)}
        />
      )}

      {/* 成就面板 */}
      <AchievementPanel
        isOpen={isAchievementPanelOpen}
        onClose={() => setIsAchievementPanelOpen(false)}
      />
      
      {/* 新手引导 */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onComplete={handleTutorialComplete}
      />
      
      {/* 游戏内帮助 */}
      <TutorialModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        onComplete={() => setShowHelp(false)}
      />
    </div>
  )
}
