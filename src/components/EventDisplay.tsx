import { memo, useState, useEffect, useMemo, useCallback } from 'react'
import { GameEvent, EventChoice } from '../types/event'
import { Character, GameStateValues, Attributes } from '../types/game'
import { ATTR_DISPLAY_MAP, STATE_DISPLAY_MAP } from '../utils/constants'
import DiceAnimation from './DiceAnimation'
import Icon from './Icon'
import './EventDisplay.css'

interface EventDisplayProps {
  event: GameEvent | null
  character: Character
  gameState: GameStateValues
  onChoice?: (choice: EventChoice) => void
  onContinue?: () => void
  onUndo?: () => void
  onGameOver?: () => void
  canUndo?: boolean
  isProcessing?: boolean
  pendingCount?: number
  isGhostMode?: boolean
  onChoiceSelect?: (choiceId: string) => void
  showResult?: boolean
  selectedChoiceId?: string | null
  onBackToChoices?: () => void
  onDeathEnding?: (ending: {
    type: 'martyrdom' | 'suicide' | 'killed' | 'execution'
    title: string
    description: string
    echo: string
    tags: string[]
  }) => void
}

interface ChoiceCheckResult {
  available: boolean
  reason?: string
  staminaInfo?: { cost: number; current: number; after: number }
  difficulty?: number
  gap?: number
  conditionType?: 'attribute' | 'hidden' | 'gameState' | 'flag' | 'stamina' | 'origin'
  conditionKey?: string
  penaltyEffect?: {
    attributes?: Partial<Attributes>
    gameState?: Partial<GameStateValues>
    hidden?: { 道德值?: number; 欲望值?: number; 野心值?: number }
  }
}

function checkChoiceRequirement(
  choice: EventChoice,
  character: Character,
  gameState: GameStateValues
): ChoiceCheckResult {
  const cond = choice.showConditions
  
  const currentStamina = character.attributes.体质
  const staminaCost = choice.staminaCost || 0
  const staminaRequired = choice.staminaRequired || 0
  const staminaAfter = currentStamina - staminaCost
  
  if (staminaRequired > 0 && currentStamina < staminaRequired) {
    const gap = staminaRequired - currentStamina
    return { 
      available: false, 
      reason: `体质不足（需≥${staminaRequired}，当前${currentStamina}）`,
      staminaInfo: { cost: staminaCost, current: currentStamina, after: staminaAfter },
      difficulty: Math.min(6, Math.ceil(gap / 15) + 2),
      gap,
      conditionType: 'stamina',
      conditionKey: '体质',
      penaltyEffect: { attributes: { 体质: -5 } }
    }
  }

  if (cond?.attributes) {
    for (const [key, range] of Object.entries(cond.attributes)) {
      const displayKey = ATTR_DISPLAY_MAP[key] || key
      const attrValue = character.attributes[key as keyof Attributes] ?? 50
      
      if (range.max !== undefined && attrValue > range.max) {
        const gap = attrValue - range.max
        return { 
          available: false, 
          reason: `${displayKey}过高（需≤${range.max}，当前${Math.floor(attrValue)}）`,
          difficulty: Math.min(6, Math.ceil(gap / 15) + 2),
          gap,
          conditionType: 'attribute' as const,
          conditionKey: displayKey,
          penaltyEffect: { attributes: { [key as keyof Attributes]: -5 } as Partial<Attributes> }
        }
      }
      
      if (range.min !== undefined && attrValue < range.min) {
        const gap = range.min - attrValue
        return { 
          available: false, 
          reason: `${displayKey}不足（需≥${range.min}，当前${Math.floor(attrValue)}）`,
          difficulty: Math.min(6, Math.ceil(gap / 15) + 2),
          gap,
          conditionType: 'attribute' as const,
          conditionKey: displayKey,
          penaltyEffect: { attributes: { [key as keyof Attributes]: -5 } as Partial<Attributes> }
        }
      }
    }
  }

  if (cond?.gameState) {
    for (const [key, range] of Object.entries(cond.gameState)) {
      const displayKey = STATE_DISPLAY_MAP[key] || key
      const stateValue = gameState[key as keyof GameStateValues] ?? 50
      
      if (range.max !== undefined && stateValue > range.max) {
        const gap = stateValue - range.max
        return { 
          available: false, 
          reason: `${displayKey}过高（需≤${range.max}，当前${stateValue}）`,
          difficulty: Math.min(6, Math.ceil(gap / 10) + 2),
          gap,
          conditionType: 'gameState' as const,
          conditionKey: displayKey,
          penaltyEffect: { gameState: { [key as keyof GameStateValues]: -5 } as Partial<GameStateValues> }
        }
      }
      
      if (range.min !== undefined && stateValue < range.min) {
        const gap = range.min - stateValue
        return { 
          available: false, 
          reason: `${displayKey}不足（需≥${range.min}，当前${stateValue}）`,
          difficulty: Math.min(6, Math.ceil(gap / 10) + 2),
          gap,
          conditionType: 'gameState' as const,
          conditionKey: displayKey,
          penaltyEffect: { gameState: { [key as keyof GameStateValues]: -5 } as Partial<GameStateValues> }
        }
      }
    }
  }

  if (cond?.hidden) {
    for (const [key, range] of Object.entries(cond.hidden)) {
      const hiddenValue = character.hidden?.[key as keyof typeof character.hidden] ?? 50
      
      if (range.max !== undefined && hiddenValue > range.max) {
        const gap = hiddenValue - range.max
        return { 
          available: false, 
          reason: `${key}过高（需≤${range.max}）`,
          difficulty: Math.min(6, Math.ceil(gap / 10) + 2),
          gap,
          conditionType: 'hidden' as const,
          conditionKey: key,
          penaltyEffect: { hidden: { [key]: -5 } }
        }
      }
      
      if (range.min !== undefined && hiddenValue < range.min) {
        const gap = range.min - hiddenValue
        return { 
          available: false, 
          reason: `${key}不足（需≥${range.min}）`,
          difficulty: Math.min(6, Math.ceil(gap / 10) + 2),
          gap,
          conditionType: 'hidden' as const,
          conditionKey: key,
          penaltyEffect: { hidden: { [key]: -5 } }
        }
      }
    }
  }

  if (cond?.flags?.has?.length) {
    // 简化处理，假设所有flag都满足
  }

  // 出身条件检查
  if (cond?.origin) {
    const allowed = Array.isArray(cond.origin) ? cond.origin : [cond.origin]
    if (!allowed.includes(character.origin)) {
      const originNames: Record<string, string> = { '寒门': '寒门', '缙绅': '缙绅', '没落世家': '没落世家', '诗文清望': '诗文清望' }
      const names = allowed.map(o => originNames[o] || o).join('、')
      return {
        available: false,
        reason: `需要出身：${names}`,
        difficulty: 0,
        gap: 0,
        conditionType: 'origin' as const,
        conditionKey: '出身',
        penaltyEffect: undefined
      }
    }
  }

  return { available: true, staminaInfo: { cost: staminaCost, current: currentStamina, after: staminaAfter } }
}

/**
 * 根据选项的"成功时的效果"反推失败时的合理副作用。
 * 原则：成功+的属性，失败时按比例扣回；隐藏属性默认道德-、野心+。
 */
function deriveFailEffects(choice: EventChoice): {
  attributes?: Record<string, number>
  gameState?: Record<string, number>
  hidden?: Record<string, number>
} {
  const attrs = (choice.effects && choice.effects.attributes) || {}
  const gs = (choice.effects && choice.effects.gameState) || {}
  const hid = (choice.effects && choice.effects.hidden) || {}

  const failAttrs: Record<string, number> = {}
  const failGs: Record<string, number> = {}
  const failHid: Record<string, number> = {}

  // 1. 属性类
  if (typeof attrs.体质 === 'number' && attrs.体质 > 0) {
    failAttrs.体质 = -Math.min(5, Math.max(2, Math.ceil(attrs.体质 / 2)))
  } else if (typeof attrs.体质 === 'number' && attrs.体质 < 0) {
    // 成功时就要扣体质的事件（如苦差事），失败时扣更多
    failAttrs.体质 = -Math.min(8, Math.max(3, Math.abs(attrs.体质)))
  }
  if (typeof attrs.财帛 === 'number' && attrs.财帛 > 0) {
    failAttrs.财帛 = -Math.min(8, Math.max(3, Math.ceil(attrs.财帛 / 2)))
  }
  if (typeof attrs.武略 === 'number' && attrs.武略 > 0) {
    failAttrs.武略 = -Math.min(3, Math.max(1, Math.ceil(attrs.武略 / 3)))
  }
  if (typeof attrs.理政 === 'number' && attrs.理政 > 0) {
    failAttrs.理政 = -Math.min(3, Math.max(1, Math.ceil(attrs.理政 / 3)))
  }
  if (typeof attrs.文韬 === 'number' && attrs.文韬 > 0) {
    failAttrs.文韬 = -Math.min(3, Math.max(1, Math.ceil(attrs.文韬 / 3)))
  }

  // 2. 朝堂指标
  if (typeof gs.圣眷 === 'number' && gs.圣眷 > 0) {
    failGs.圣眷 = -Math.min(8, Math.max(3, Math.ceil(gs.圣眷 / 2)))
  }
  if (typeof gs.清议 === 'number' && gs.清议 > 0) {
    failGs.清议 = -Math.min(8, Math.max(3, Math.ceil(gs.清议 / 2)))
  }
  if (typeof gs.民望 === 'number' && gs.民望 > 0) {
    failGs.民望 = -Math.min(8, Math.max(3, Math.ceil(gs.民望 / 2)))
  }
  if (typeof gs.中官 === 'number' && gs.中官 > 0) {
    failGs.中官 = -Math.min(6, Math.max(2, Math.ceil(gs.中官 / 2)))
  }

  // 3. 隐藏属性
  if (typeof hid.道德值 === 'number' && hid.道德值 > 0) {
    failHid.道德值 = -Math.min(5, Math.max(2, Math.ceil(hid.道德值 / 2)))
  } else {
    failHid.道德值 = -2
  }
  failHid.野心值 = (typeof hid.野心值 === 'number')
    ? Math.max(2, Math.ceil(Math.abs(hid.野心值) / 2 + 1))
    : 2

  // 兜底
  const totalFail = Object.values(failAttrs).reduce((s, v) => s + Math.abs(v), 0) +
                    Object.values(failGs).reduce((s, v) => s + Math.abs(v), 0)
  if (totalFail === 0) {
    failAttrs.体质 = (failAttrs.体质 ?? 0) - 2
  }

  return {
    attributes: Object.keys(failAttrs).length ? failAttrs : undefined,
    gameState: Object.keys(failGs).length ? failGs : undefined,
    hidden: Object.keys(failHid).length ? failHid : undefined
  }
}

/**
 * 根据所选选项、失败条件、事件背景，生成跟事件强相关的失败回音。
 * 优先级：事件描述 > 选项意图 > 失败条件原因。
 */
function generateFailEcho(
  choice: EventChoice,
  dice: { reason?: string; conditionType?: string; conditionKey?: string; difficulty?: number; gap?: number },
  event: GameEvent | null
): { title: string; description: string; echo: string } {
  const eventDesc = event?.description || event?.narrative?.situation || ''
  // 从 choice.text 中精准提取【...】中的标签（如"【全力赈灾】"当..." → "全力赈灾"）
  const tagMatch = (choice.text || '').match(/【([^】]+)】/)
  const choiceText = (tagMatch ? tagMatch[1] : (choice.text || '')).trim()
  const reason = dice.reason || ''
  // 从 reason 中提取属性名（"文韬不足（需≥50，当前33）" → "文韬"）。
  // 先去掉"不足""差距"等后缀词，避免"道德值不足"被抓成"道德值不足"
  const reasonTrimmed = reason.replace(/(不足|差距|太低|欠缺)$/g, '')
  // 属性名通常 2~3 个汉字：圣眷/清议/民望/文韬/武略/理政/体质/中官/士绅/财帛/道德值
  // 用 [\u4e00-\u9fa5] 限定仅匹配汉字，并用 (?=[不足低欠差（）(]) 断言后跟边界字符，
  // 避免"武略不足"被贪心匹配成"武略不足"
  const keyMatch = reasonTrimmed.match(/^([\u4e00-\u9fa5]{2,4})(?=[不足低欠差（）(])/)
  const lackingKey = keyMatch ? keyMatch[1] : (dice.conditionKey || '')

  // 缺什么能力的"中文修饰词"（不含"不足"二字，避免与 reason 里的"不足"重复）
  const lackingDescriptive = (() => {
    if (!lackingKey) return '能力尚有欠缺'
    if (/(文|才|学|理|墨|笔)/.test(lackingKey)) return '文才未逮'
    if (/(武|兵|战|勇|力)/.test(lackingKey)) return '武略生疏'
    if (/(圣|帝|眷|宠|心)/.test(lackingKey)) return '圣眷未孚'
    if (/(中|宦|阉|寺|内|官)/.test(lackingKey)) return '内侍嫌隙'
    if (/(清|议|士|林|言|弹)/.test(lackingKey)) return '清议责难'
    if (/(民|望|乡|里|众|舆)/.test(lackingKey)) return '民望有亏'
    if (/(绅|豪|地|方|族)/.test(lackingKey)) return '乡绅掣肘'
    if (/(体|身|疾|病|康)/.test(lackingKey)) return '身体违和'
    if (/(财|银|钱|资|库)/.test(lackingKey)) return '资财短绌'
    if (/(道|德|品|行)/.test(lackingKey)) return '德行有亏'
    return `${lackingKey}尚欠火候`
  })()

  // 文绉绉的失败叙述模板
  const title = `未能如愿 · ${choiceText || '行动'}`
  const description = `因${lackingDescriptive}，强行为之反遭其祸。`

  // 根据事件/选项的特征关键词匹配更具体的回音
  const evtLower = (eventDesc + ' ' + choiceText).toLowerCase()
  const isMilitary = /军|兵|战|剿|守|边|关|匪|贼/.test(evtLower)
  const isPolitics = /官|朝|政|奏|帝|阉|东林|权|党/.test(evtLower)
  const isExam = /考|试|举|进士|状元|科举/.test(evtLower)
  const isDiplomacy = /外|使|和|贡|边|夷|番/.test(evtLower)
  const isRelief = /灾|民|荒|济|赈|赋|税/.test(evtLower)
  const isBandit = /士子|闹|考|落|落第|举|监|学/.test(evtLower)

  // 先抓一句"开场白"：把事件描述截短作为引子
  const intro = eventDesc.length > 0
    ? eventDesc.slice(0, Math.min(eventDesc.length, 60))
    : '事情出了岔子'

  let body = ''
  if (isMilitary) {
    body = `你自恃能武，执意出战。无奈${lackingKey || '武略'}不济，阵脚大乱，反被对方看出破绽。\n\n兵卒折损数十，部下虽未明言，眼底颇有怨色。\n\n` +
      `更糟的是，这一败让你的威严扫地，往后再要整军，只怕调遣不动。`
  } else if (isPolitics) {
    body = `你欲在朝堂上翻云覆雨，无奈${lackingKey || '根基'}未稳，被对方一句话顶了回来。\n\n` +
      `朝会散后，政敌们相视而笑，传言当晚便在京城各衙门口传开。\n\n` +
      `你不仅没占到便宜，反而暴露出急于求成的底牌。`
  } else if (isExam) {
    body = `你自信才学，欲在科场上一搏。无奈${lackingKey || '文才'}欠火候，文章被考官批得体无完肤。\n\n` +
      `同场士子皆以异样的目光看你，更有好事者当场赋诗讽之。\n\n` +
      `你颜面尽失，原本有意结交的几位才子，也悄然远离。`
  } else if (isDiplomacy) {
    body = `你欲以外交手段斡旋，奈何${lackingKey || '手腕'}生疏，被对方使节三言两语便看穿了底牌。\n\n` +
      `谈判未成，反被对方抓住了把柄，回国后还须向朝廷解释。\n\n` +
      `消息传回京城，主和派借题发挥，让你处境愈发尴尬。`
  } else if (isRelief) {
    body = `你心系灾民，急于赈济。无奈${lackingDescriptive}，筹到的米粮杯水车薪，分配时又生骚乱。\n\n` +
      `流民非但没有领情，反而砸了你的施粥棚。\n\n` +
      `此事被人参了一本，说你沽名钓誉、办事不力。`
  } else if (isBandit) {
    body = `你欲以德化之、安抚之。无奈${lackingDescriptive}，群情激愤之下反被人揪住衣领质问。\n\n` +
      `你仓皇退场，不仅平白折了脸面，事情也彻底闹大。\n\n` +
      `更麻烦的是，落榜士子已将你视为眼中钉，日后再想施恩，怕是没人会领情。`
  } else {
    body = `你决意强行推动此事，无奈${lackingDescriptive}，结果与你的设想背道而驰。\n\n` +
      `现场陷入一片尴尬的沉默。旁人的目光，让你恨不得掘地三尺。\n\n` +
      `事后回想，其实若再等一等、准备更充分一些，未必不能成事。`
  }

  // 末尾提示：避免"不足"重复，改用"还差 X 点"
  const gapHint = (dice.gap !== undefined && dice.gap > 0)
    ? `\n\n（提示：${lackingKey || dice.conditionKey || '此项'}还差约${dice.gap}点，待来日修为精进，或可一搏。）`
    : ''

  const echo = `【回音】\n\n${intro}…\n\n${body}\n\n——事已至此，多想无益。${gapHint}`

  return { title, description, echo }
}

function EventDisplay({
  event,
  character,
  gameState,
  onChoice,
  onContinue,
  onUndo,
  canUndo,
  isProcessing,
  pendingCount = 0,
  isGhostMode,
  onChoiceSelect,
  showResult: externalShowResult,
  selectedChoiceId: externalSelectedChoiceId,
  onBackToChoices,
  onDeathEnding
}: EventDisplayProps) {
  const [internalSelectedChoice, setInternalSelectedChoice] = useState<EventChoice | null>(null)
  const [internalShowResult, setInternalShowResult] = useState(false)
  
  // 幽灵模式使用外部状态，正常模式使用内部状态
  const selectedChoice = isGhostMode 
    ? (externalSelectedChoiceId ? event?.choices.find(c => c.id === externalSelectedChoiceId) || null : null)
    : internalSelectedChoice
  const showResult = isGhostMode ? externalShowResult : internalShowResult
  const setSelectedChoice = isGhostMode ? () => {} : setInternalSelectedChoice
  const setShowResult = isGhostMode ? () => {} : setInternalShowResult
  
  // 事件级投骰状态：整个事件只能投一次
  const [eventDiceUsed, setEventDiceUsed] = useState(false)

  const [diceModal, setDiceModal] = useState<{
    show: boolean
    choice: EventChoice | null
    isRolling: boolean
    rollResult: number | null
    success: boolean | null
    showPenalty: boolean
    difficulty?: number
    reason?: string
    attemptCount: number
  }>({
    show: false,
    choice: null,
    isRolling: false,
    rollResult: null,
    success: null,
    showPenalty: false,
    attemptCount: 0
  })

  // 记录每个选项的独立尝试状态
  const [attemptedChoices, setAttemptedChoices] = useState<Set<string>>(new Set())
  // 记录每个选项的成功/失败状态
  const [choiceResults, setChoiceResults] = useState<Map<string, boolean>>(new Map())



  // 判断是否为死亡结局选项
  const checkDeathEnding = useCallback((choice: EventChoice): {
    isDeath: boolean
    type: 'martyrdom' | 'suicide' | 'killed' | 'execution'
  } => {
    const deathKeywords = {
      martyrdom: ['殉国', '殉死', '殉难', '殉节', '殉职', '殉道'],
      suicide: ['自缢', '自尽', '自杀', '自刎', '自裁', '自绝', '上吊', '投河', '跳井'],
      killed: ['战死', '阵亡', '战死沙场', '力战而死', '血战而死', '壮烈牺牲'],
      execution: ['处斩', '斩首', '凌迟', '处死', '赐死', '赐自尽', '押赴刑场']
    }

    // 只检测选项文本，不检测description和result（它们可能描述其他人的死亡或包含误导性词汇）
    const text = choice.text || ''
    const fullText = text

    // 排除词：如果包含这些词，说明是描述他人的死亡，不是玩家自己
    // 这些词描述的是他人的死亡，不是玩家角色的死亡
    // 使用正则表达式匹配"卢督师...阵亡"的模式（中间可以有其他字）
    const excludePatterns = [
      /卢督师.*殉国/,
      /卢象升.*殉国/,
      /卢督师.*阵亡/,
      /卢象升.*阵亡/,
      /坐视.*殉国/,
      /坐视.*阵亡/
    ]

    for (const pattern of excludePatterns) {
      if (pattern.test(fullText)) {
        return { isDeath: false, type: 'martyrdom' }
      }
    }

    for (const [type, keywords] of Object.entries(deathKeywords)) {
      for (const keyword of keywords) {
        if (fullText.includes(keyword)) {
          return { isDeath: true, type: type as 'martyrdom' | 'suicide' | 'killed' | 'execution' }
        }
      }
    }

    return { isDeath: false, type: 'martyrdom' }
  }, [])

  const choiceChecks = useMemo(() => {
    const checks = new Map<string, ChoiceCheckResult>()
    if (!event) return checks
    
    for (const choice of event.choices) {
      checks.set(choice.id, checkChoiceRequirement(choice, character, gameState))
    }
    
    return checks
  }, [event, character, gameState])

  useEffect(() => {
    setShowResult(false)
    setSelectedChoice(null)
    setEventDiceUsed(false) // 切换事件时重置骰子状态
    setDiceModal({
      show: false,
      choice: null,
      isRolling: false,
      rollResult: null,
      success: null,
      showPenalty: false,
      attemptCount: 0
    })
    // 重置每个选项的尝试记录
    setAttemptedChoices(new Set())
    setChoiceResults(new Map())
  }, [event])

  const handleSelectChoice = useCallback((choice: EventChoice) => {
    if ((isProcessing) && !isGhostMode) return
    
    // 检查是否为死亡结局
    const deathCheck = checkDeathEnding(choice)
    
    if (isGhostMode) {
      // 幽灵模式：只触发选择，不改变状态
      onChoiceSelect?.(choice.id)
    } else if (deathCheck.isDeath) {
      // 死亡结局：通过回调通知父组件
      onDeathEnding?.({
        type: deathCheck.type,
        title: choice.result?.title || '以身殉国',
        description: choice.resultDescription || choice.description || '',
        echo: choice.result?.echo || '',
        tags: choice.result?.tags || []
      })
      onChoice?.(choice)
    } else {
      // 正常模式
      setSelectedChoice(choice)
      setShowResult(true)
      onChoice?.(choice)
    }
  }, [isProcessing, onChoice, isGhostMode, onChoiceSelect, checkDeathEnding, onDeathEnding])

  const openDiceModal = useCallback((choice: EventChoice) => {
    const check = choiceChecks.get(choice.id)
    if (!check || check.available) return

    if (choiceResults.get(choice.id) === true) return

    // 整个事件已经用过了投骰
    if (eventDiceUsed) return

    setDiceModal({
      show: true,
      choice,
      isRolling: false,
      rollResult: null,
      success: (choiceResults.get(choice.id) === true) ? true : null,
      showPenalty: false,
      attemptCount: 0,
      ...check
    })
  }, [choiceChecks, choiceResults, eventDiceUsed])

  const closeDiceModal = useCallback(() => {
    setDiceModal(prev => ({ ...prev, show: false }))
  }, [])

  const rollDice = useCallback(() => {
    setDiceModal(prev => ({ ...prev, isRolling: true }))

    setTimeout(() => {
      setDiceModal(dicePrev => {
        const choice = dicePrev.choice
        if (!choice) return dicePrev

        // 整个事件只能投一次
        const baseDifficulty = dicePrev.difficulty || 3
        const adjustedDifficulty = baseDifficulty

        const roll = Math.floor(Math.random() * 6) + 1
        const success = roll >= adjustedDifficulty

        // 标记事件级骰子已用
        setEventDiceUsed(true)

        if (success) {
          // 成功：用原 effects / result
          setChoiceResults(r => new Map(r).set(choice.id, true))
          setTimeout(() => {
            if (isGhostMode) {
              onChoiceSelect?.(choice.id)
            } else {
              setSelectedChoice(choice)
              setShowResult(true)
              onChoice?.(choice)
            }
            setDiceModal(p => ({ ...p, show: false }))
          }, 1500)
        } else {
          // 失败：用 failEffects / failResult；若无则默认一个简单的
          setAttemptedChoices(r => new Set(r).add(choice.id))
          setChoiceResults(r => new Map(r).set(choice.id, false))

          setTimeout(() => {
            if (isGhostMode) {
              onChoiceSelect?.(choice.id)
            } else {
              // 根据所选选项 + 失败条件 + 事件背景动态生成回音
              const generated = generateFailEcho(choice, dicePrev, event)

              // 失败副作用：优先用作者在 choice.failEffects 里配的，否则根据"成功时的效果"反推
              // 绝不再用死数据"体质-2/道德值-1"敷衍
              const failEffects = choice.failEffects || deriveFailEffects(choice)

              const useChoice: EventChoice = {
                ...choice,
                effects: failEffects,
                resultDescription: choice.failResultDescription || generated.description,
                result: choice.failResult || {
                  title: generated.title,
                  tags: ['投骰失败', '副作用'],
                  echo: generated.echo
                }
              }
              setSelectedChoice(useChoice)
              setShowResult(true)
              onChoice?.(useChoice)
            }
            setDiceModal(p => ({ ...p, show: false }))
          }, 1500)
        }

        return {
          ...dicePrev,
          isRolling: false,
          rollResult: roll,
          success,
          attemptCount: 1,
          showPenalty: !success,
          difficulty: adjustedDifficulty
        }
      })
    }, 800)
  }, [isGhostMode, onChoiceSelect, onChoice])

  const handleContinue = () => {
    if (isGhostMode) {
      onBackToChoices?.()
    } else {
      setShowResult(false)
      setSelectedChoice(null)
      onContinue?.()
    }
  }

  const handleUndoClick = () => {
    if (isGhostMode) {
      onBackToChoices?.()
    } else {
      setShowResult(false)
      setSelectedChoice(null)
      onUndo?.()
    }
  }

  if (!event) {
    return (
      <div className="event-display empty">
        <div className="empty-state">
          <div className="empty-icon">📜</div>
          <p className="empty-text">暂无事件</p>
          <p className="empty-hint">等待命运的安排...</p>
        </div>
      </div>
    )
  }

  const narrative = event.narrative

  return (
    <div className={`event-display ${showResult ? 'show-result' : ''}`}>
      {/* 标题区 */}
      <div className="event-header">
        <h1 className="event-title">{event.title}</h1>
        {pendingCount > 0 && (
          <div className="event-pending-hint">
            本月尚有 <strong>{pendingCount}</strong> 个事件待处理
          </div>
        )}
      </div>

      {/* 叙事区 */}
      <div className="narrative-section">
        {/* 人物信息和引语合并 */}
        {(narrative?.speaker || narrative?.quote) && (
          <div className="speaker-quote-row">
            {narrative?.speaker && (
              <div className="speaker-card-compact">
                <div className="speaker-avatar-compact">
                  <svg viewBox="0 0 32 32" className="avatar-svg">
                    {/* 背景圆 */}
                    <circle cx="16" cy="16" r="15" fill="url(#avatarBg)" />
                    {/* 身体/衣服 */}
                    <path d="M8 26 Q16 20 24 26 L24 28 Q16 24 8 28 Z" fill="#8b6914" />
                    {/* 脖子 */}
                    <rect x="14" y="18" width="4" height="4" fill="#d4a574" />
                    {/* 脸部 */}
                    <ellipse cx="16" cy="14" rx="5" ry="6" fill="#d4a574" />
                    {/* 帽子顶部 */}
                    <ellipse cx="16" cy="7" rx="7" ry="2" fill="#2a2a2a" />
                    {/* 帽子主体 */}
                    <path d="M9 7 L9 10 Q16 12 23 10 L23 7 Z" fill="#3a3a3a" />
                    {/* 帽子装饰带 */}
                    <rect x="9" y="9" width="14" height="1.5" fill="#c9a227" />
                    {/* 眼睛 */}
                    <circle cx="14" cy="14" r="0.8" fill="#2a1a10" />
                    <circle cx="18" cy="14" r="0.8" fill="#2a1a10" />
                    {/* 眉毛 */}
                    <path d="M13 12 Q14 11.5 15 12" stroke="#2a1a10" strokeWidth="0.5" fill="none" />
                    <path d="M17 12 Q18 11.5 19 12" stroke="#2a1a10" strokeWidth="0.5" fill="none" />
                    {/* 胡须 */}
                    <path d="M15 19 Q16 21 17 19" stroke="#2a1a10" strokeWidth="0.8" fill="none" />
                    <path d="M16 20 L16 22" stroke="#2a1a10" strokeWidth="0.8" fill="none" />
                    {/* 渐变定义 */}
                    <defs>
                      <linearGradient id="avatarBg" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#4a3520" />
                        <stop offset="100%" stopColor="#2a1a10" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="speaker-info-compact">
                  <span className="speaker-name-compact">{narrative.speaker.name}</span>
                  <span className="speaker-title-compact">{narrative.speaker.title}</span>
                </div>
              </div>
            )}
            {narrative?.quote && (
              <div className="quote-box-compact">
                <span className="quote-mark-compact">"</span>
                <p className="quote-text-compact">{narrative.quote}</p>
                <span className="quote-end-compact">"</span>
              </div>
            )}
          </div>
        )}

        {/* 背景叙述 */}
        <div className="narrative-body">
          {(narrative?.background || event.description).split('\n').map((line, i) => (
            <p key={i} className="narrative-paragraph">{line}</p>
          ))}
        </div>

        {/* 决策引导 */}
        <div className="situation-prompt">
          {narrative?.situation || '你决定——'}
        </div>
      </div>

      {!showResult ? (
        /* 选项列表 */
        <div className="choices-section">
          <div className="choices-list">
            {event.choices.map((choice, idx) => {
              const check = choiceChecks.get(choice.id)
              if (!check) return null

              const canAttemptDice = !check.available &&
                !diceModal.isRolling &&
                check.difficulty !== undefined &&
                check.conditionType !== 'flag' &&
                (choiceResults.get(choice.id) !== true) &&
                !eventDiceUsed // 整个事件只投一次

              return (
                <div key={`${choice.id}-${idx}`} className="choice-card-wrapper">
                  <button
                    className={`choice-card ${!check.available ? 'locked' : ''}`}
                    onClick={() => handleSelectChoice(choice)}
                    disabled={isProcessing || !check.available}
                  >
                    <div className="choice-content">
                      <div className="choice-title">
                        {choice.text}
                      </div>
                      {choice.description && (
                        <div className="choice-description">{choice.description}</div>
                      )}
                    </div>

                    {!check.available && (
                      <div className="choice-lock-reason">
                        {check.reason}
                        {attemptedChoices.has(choice.id) && choiceResults.get(choice.id) === false && (
                          <span className="attempt-failed-mark"> <Icon name="cross" size={12} /> 已失败</span>
                        )}
                        {eventDiceUsed && !canAttemptDice && choiceResults.get(choice.id) !== true && (
                          <span className="attempt-failed-mark"> （本事件骰子已投）</span>
                        )}
                      </div>
                    )}
                  </button>

                  {canAttemptDice && (
                    <button
                      className="dice-attempt-btn"
                      onClick={() => openDiceModal(choice)}
                    >
                      勉力一试
                    </button>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      ) : (
        /* 结果展示 */
        <div className="result-section">
          {/* 选中的选项卡片 */}
          {selectedChoice && (
            <div className="selected-choice">
              <div className="selected-choice-title">
                {selectedChoice.text}
              </div>
              {selectedChoice.description && (
                <div className="selected-choice-desc">{selectedChoice.description}</div>
              )}
            </div>
          )}

          {/* 结算区域 */}
          <div className="settlement-area">
            {/* 结果评价 */}
            {selectedChoice?.result?.title && (
              <div className="settlement-title">{selectedChoice.result.title}</div>
            )}
            
            {/* 属性变化 */}
            <div className="effects-grid">
              {selectedChoice?.effects.attributes && Object.entries(selectedChoice.effects.attributes).map(([key, value]) => (
                <div key={key} className={`effect-tag ${value > 0 ? 'positive' : 'negative'}`}>
                  {ATTR_DISPLAY_MAP[key] || key}{value > 0 ? `+${value}` : value}
                </div>
              ))}
              {selectedChoice?.effects.gameState && Object.entries(selectedChoice.effects.gameState).map(([key, value]) => (
                <div key={key} className={`effect-tag ${value > 0 ? 'positive' : 'negative'}`}>
                  {STATE_DISPLAY_MAP[key] || key}{value > 0 ? `+${value}` : value}
                </div>
              ))}
              {selectedChoice?.effects.hidden && Object.entries(selectedChoice.effects.hidden).map(([key, value]) => (
                <div key={key} className={`effect-tag ${value > 0 ? 'positive' : 'negative'}`}>
                  {key}{value > 0 ? `+${value}` : value}
                </div>
              ))}
            </div>

            {/* 回音叙述 */}
            {selectedChoice?.result?.echo && (() => {
              const echo = selectedChoice.result.echo
              return (
                <div className="echo-box">
                  <div className="echo-label">【回音】</div>
                  <pre className="echo-text">{echo}</pre>
                </div>
              )
            })()}
          </div>

          {/* 操作按钮 */}
          <div className="result-actions">
            {(canUndo || isGhostMode) && (
              <button className="undo-btn" onClick={handleUndoClick}>
                {isGhostMode ? '↩ 返回' : '↩ 悔棋'}
              </button>
            )}
            <button className="continue-btn" onClick={handleContinue}>
              {isGhostMode ? '返 回' : '继 续'}
            </button>
          </div>
        </div>
      )}

      {/* 骰子弹窗 */}
      {diceModal.show && diceModal.choice && (() => {
        const check = choiceChecks.get(diceModal.choice.id)
        return check && !check.available
      })() && (
        <div className="dice-modal-overlay" onClick={closeDiceModal}>
          <div className="dice-modal" onClick={e => e.stopPropagation()}>
            <div className="dice-modal-header">
              <h3>勉 力 一 试</h3>
            </div>

            <div className="dice-modal-content">
              {(() => {
                const check = choiceChecks.get(diceModal.choice!.id)
                if (!check || check.available) return null

                return (
                  <div className="dice-info-simple">
                    <div className="dice-condition-simple">
                      {check.reason}
                    </div>

                    <div className="difficulty-adjust-info">
                      <span className="difficulty-label">难度：</span>
                      <div className="difficulty-circles">
                        {[1, 2, 3, 4, 5, 6].map((level) => (
                          <span
                            key={level}
                            className={`difficulty-circle ${level <= (diceModal.difficulty || 3) ? 'active' : ''}`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="dice-target">
                      需投出 <span className="target-char">{['零', '一', '二', '三', '四', '五', '六'][diceModal.difficulty || 3]}</span>（{diceModal.difficulty}）或以上
                    </div>

                    <div className="attempt-info">
                      投骰一次，成功即达成，失败则触发负面效果
                    </div>
                  </div>
                )
              })()}
              
              <div className="dice-area" onClick={!diceModal.isRolling && diceModal.success === null ? rollDice : undefined}>
                <DiceAnimation 
                  isRolling={diceModal.isRolling}
                  result={diceModal.rollResult}
                  success={diceModal.success}
                />
              </div>
              
              {!diceModal.isRolling && diceModal.success === null && (
                <div className="dice-click-hint">点击骰子开始</div>
              )}
              
              {diceModal.success !== null && (
                <div className={`dice-result-text ${diceModal.success ? 'success' : 'fail'}`}>
                  {diceModal.success ? '天命所归——成功' : '力有不逮——失败'}
                </div>
              )}
              
              {/* 失败后的属性变化会由效果系统自动应用，不在弹窗里重复显示 */}
            </div>
            
            <div className="dice-modal-footer">
              {/* 失败后会自动显示结果，不需要单独确认按钮了 */}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// 性能优化: memo - event/character/gameState/callbacks 引用未变时跳过整个事件面板重渲染
// (handleChoice/handleContinue/handleUndo 等已用 useCallback 包裹，引用稳定 → memo 有效)
// (AttributePanel/StatusPanel 状态条变化时不会连带重渲染整个事件卡 DOM)
export default memo(EventDisplay)
