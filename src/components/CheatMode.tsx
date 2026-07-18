import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Character, GameStateValues } from '../types/game'
import { GameEvent, EventChoice } from '../types/event'
import { initialEvents, allGrayChoiceEvents, allEndingEvents } from '../data/events/index'
import { factionEvents } from '../data/events/faction/faction_events'
import { originEvents } from '../data/events/origin/index'
import { getStoryline, type StorylineTone } from '../data/storylines'
import Icon from './Icon'
import type { IconName } from './Icon'
import './CheatMode.css'

interface CheatModeProps {
  isOpen: boolean
  onClose: () => void
  currentGameState: {
    currentYear: number
    currentMonth: number
    turn: number
    eventHistory: string[]
  }
  currentCharacter: Character
  currentGameStateValues: GameStateValues
}

export default function CheatMode({ 
  isOpen, 
  onClose,
  currentCharacter: _currentCharacter,
  currentGameStateValues: _currentGameStateValues
}: CheatModeProps) {
  const [selectedEvent, setSelectedEvent] = useState<GameEvent | null>(null)
  const [selectedChoice, setSelectedChoice] = useState<EventChoice | null>(null)
  
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'historical' | 'transition' | 'emotion' | 'gray' | 'origin' | 'faction'>('all')
  const [viewMode, setViewMode] = useState<'events' | 'endings'>('events')
  const [previousViewMode, setPreviousViewMode] = useState<'events' | 'endings'>('events')
  const [endingFilter, setEndingFilter] = useState<'all' | 'triggerable' | 'narrative' | 'debauchery'>('all')

  const [_deathEndingPreview, setDeathEndingPreview] = useState<{
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

  const [_isLifeReviewOpen] = useState(false)

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

    const text = choice.text || ''
    const fullText = text

    const excludePatterns = [
      /卢督师.*殉国/, /卢象升.*殉国/, /卢督师.*阵亡/, /卢象升.*阵亡/, /坐视.*殉国/, /坐视.*阵亡/
    ]
    
    for (const pattern of excludePatterns) {
      if (pattern.test(fullText)) return { isDeath: false, type: 'martyrdom' }
    }

    for (const [type, keywords] of Object.entries(deathKeywords)) {
      for (const keyword of keywords) {
        if (fullText.includes(keyword)) return { isDeath: true, type: type as 'martyrdom' | 'suicide' | 'killed' | 'execution' }
      }
    }

    return { isDeath: false, type: 'martyrdom' }
  }, [])

  if (!isOpen) return null

  const filteredInitialHistorical = initialEvents.filter((e): e is GameEvent => e.type === 'historical')
  const filteredInitialTransition = initialEvents.filter((e): e is GameEvent => e.type === 'transition')
  const filteredEmotionEvents = initialEvents.filter((e): e is GameEvent => e.type === 'emotion')
  const filteredGrayEvents = allGrayChoiceEvents.filter((e): e is GameEvent => e.type === 'gray')
  const filteredOriginEvents = originEvents
  const filteredFactionEvents = factionEvents

  const sortByTime = <T extends GameEvent>(arr: T[]): T[] =>
    [...arr].sort((a, b) => {
      const yA = a.conditions?.year?.min ?? 0, yB = b.conditions?.year?.min ?? 0
      if (yA !== yB) return yA - yB
      return (a.conditions?.month?.min ?? 0) - (b.conditions?.month?.min ?? 0)
    })

  const sortedHistorical = sortByTime(filteredInitialHistorical)
  const sortedTransition = sortByTime(filteredInitialTransition)
  const sortedGray = sortByTime(filteredGrayEvents)
  const sortedEmotion = sortByTime(filteredEmotionEvents)
  const sortedOrigin = sortByTime(filteredOriginEvents)
  const sortedFaction = sortByTime(filteredFactionEvents)

  let filteredEvents: GameEvent[] = []
  if (eventTypeFilter === 'historical') filteredEvents = sortedHistorical
  else if (eventTypeFilter === 'transition') filteredEvents = sortedTransition
  else if (eventTypeFilter === 'emotion') filteredEvents = sortedEmotion
  else if (eventTypeFilter === 'gray') filteredEvents = sortedGray
  else if (eventTypeFilter === 'origin') filteredEvents = sortedOrigin
  else if (eventTypeFilter === 'faction') filteredEvents = sortedFaction
  else filteredEvents = [...sortedHistorical, ...sortedTransition, ...sortedEmotion, ...sortedGray, ...sortedOrigin, ...sortedFaction]

  const historicalCount = sortedHistorical.length
  const transitionCount = sortedTransition.length
  const emotionCount = sortedEmotion.length
  const grayCount = sortedGray.length
  const originCount = sortedOrigin.length
  const factionCount = sortedFaction.length

  const getEndingSourceType = (event: GameEvent): 'triggerable' | 'narrative' | 'debauchery' => {
    if (event.id.startsWith('triggerable_')) return 'triggerable'
    if (event.id.startsWith('ending_debauchery_')) return 'debauchery'
    return 'narrative'
  }

  const filteredEndingEvents = endingFilter === 'all'
    ? allEndingEvents
    : allEndingEvents.filter(e => getEndingSourceType(e) === endingFilter)

  const triggerableCount = allEndingEvents.filter(e => e.id.startsWith('triggerable_')).length
  const narrativeCount = allEndingEvents.filter(e => !e.id.startsWith('triggerable_') && !e.id.startsWith('ending_debauchery_')).length
  const debaucheryCount = allEndingEvents.filter(e => e.id.startsWith('ending_debauchery_')).length

  const handleBackToList = () => {
    setSelectedEvent(null)
    setSelectedChoice(null)
    setViewMode(previousViewMode)
  }

  const handleBackToChoices = () => {
    setSelectedChoice(null)
    setDeathEndingPreview(prev => ({ ...prev, show: false }))
  }

  const handleSelectChoice = (choice: EventChoice) => {
    const deathCheck = checkDeathEnding(choice)
    if (deathCheck.isDeath) {
      setDeathEndingPreview({
        show: true,
        type: deathCheck.type,
        title: choice.result?.title || '以身殉国',
        description: choice.resultDescription || choice.description || '',
        echo: choice.result?.echo || '',
        tags: choice.result?.tags || []
      })
    }
    setSelectedChoice(choice)
  }

  const handleEventClick = (event: GameEvent) => {
    setPreviousViewMode(viewMode)
    setSelectedEvent(event)
    setSelectedChoice(null)
  }

  const handleEndingDoubleClick = (event: GameEvent) => {
    setPreviousViewMode('endings')
    setSelectedEvent(event)
    setSelectedChoice(null)
  }

  const eventTypeLabels: Record<string, string> = {
    historical: '历史事件', transition: '过渡事件',
    emotion: '情感线', gray: '灰色选择'
  }
  const eventTypeIcons: Record<string, string> = {
    historical: '史', transition: '转',
    emotion: '情', gray: '灰'
  }
  const categoryLabels: Record<string, string> = {
    personal_fate: '个人命运', ming_fate: '大明国运', special: '特殊结局'
  }
  const tierLabels: Record<string, string> = {
    legendary: '传说', epic: '史诗', rare: '稀有', historical: '历史',
    bittersweet: '苦涩', tragic: '悲剧', dark: 'dark', controversial: '争议',
    peaceful: '平和', transcendent: '超脱', saintly: '圣贤',
    heartwarming: '暖心', mysterious: '神秘', miracle: '奇迹'
  }

  // 剧情线 icon 映射（与 StorylineBar 一致）
  const SL_ICON_MAP: Record<string, IconName> = {
    document: 'document', sword: 'sword', coffin: 'coffin',
    flower: 'flower', star: 'star', pin: 'pin', sparkle: 'sparkle',
    marriage: 'marriage', shuffle: 'shuffle', starOutline: 'starOutline',
    warning: 'warning', sparkleDim: 'sparkleDim'
  }

  // 渲染剧情线徽章（用于事件列表 + 详情页 + 结局图鉴）
  const renderStorylineBadge = (storylineKey?: string) => {
    const sl = getStoryline(storylineKey)
    if (!sl) return null
    const iconName = SL_ICON_MAP[sl.iconName] || 'sparkle'
    const tone: StorylineTone = sl.tone
    return (
      <span className={`cheat-storyline-badge cheat-storyline-badge--${tone}`} title={sl.intro}>
        <Icon name={iconName} size={11} />
        <span className="cheat-storyline-badge__name">{sl.name}</span>
      </span>
    )
  }

  if (selectedEvent) {
    const narrative = selectedEvent.narrative
    
    const node = (
    <div className="cheat-modal-overlay" key={`event-detail-${selectedEvent.id}`}>
        <div className="cheat-modal cheat-detail-modal">
          <div className="cheat-modal-header">
            <div className="cheat-modal-title">
              幽灵模式<span className="cheat-mode-badge">调试工具</span>
            </div>
            <div className="cheat-header-actions">
              <button className="cheat-back-btn" onClick={handleBackToList}>返回列表</button>
              <button className="cheat-close-btn" onClick={onClose}>退出幽灵模式</button>
            </div>
          </div>

          <div className="cheat-modal-body">
            <div className="cheat-event-detail-header">
              <h2 className="cheat-event-detail-title">{selectedEvent.title}</h2>
              {selectedEvent.type !== 'ending' && selectedEvent.conditions?.year?.min && (
                <div className="cheat-event-detail-time">
                  崇祯{selectedEvent.conditions.year.min - 1627}年{selectedEvent.conditions.month?.min && ` ${selectedEvent.conditions.month.min}月`}
                </div>
              )}
            </div>

            <div className="cheat-narrative-section">
              {(narrative?.speaker || narrative?.quote) && (
                <div className="cheat-speaker-quote-row">
                  {narrative?.speaker && (
                    <div className="cheat-speaker-card">
                      <div className="cheat-speaker-avatar">{narrative.speaker.name[0]}</div>
                      <div className="cheat-speaker-info">
                        <span className="cheat-speaker-name">{narrative.speaker.name}</span>
                        <span className="cheat-speaker-title">{narrative.speaker.title}</span>
                      </div>
                    </div>
                  )}
                  {narrative?.quote && (
                    <div className="cheat-quote-box">
                      <span className="cheat-quote-mark">"</span>
                      <p className="cheat-quote-text">{narrative.quote}</p>
                      <span className="cheat-quote-end">"</span>
                    </div>
                  )}
                </div>
              )}

              {narrative?.background && (
                <div className="cheat-narrative-body">
                  {narrative.background.split('\n').map((line, i) => (
                    <p key={i} className="cheat-narrative-paragraph">{line}</p>
                  ))}
                </div>
              )}

              <div className="cheat-situation-prompt">{narrative?.situation || '你决定——'}</div>
            </div>

            {!selectedChoice ? (
              <div className="cheat-choices-section">
                <div className="cheat-choices-list">
                  {selectedEvent.choices.map((choice) => (
                    <button key={choice.id} className="cheat-choice-card" onClick={() => handleSelectChoice(choice)}>
                      <div className="cheat-choice-content">
                        <div className="cheat-choice-title">{choice.text}</div>
                        {choice.description && <div className="cheat-choice-description">{choice.description}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="cheat-result-section">
                <div className="cheat-selected-choice">
                  <div className="cheat-selected-choice-title">{selectedChoice.text}</div>
                  {selectedChoice.description && <div className="cheat-selected-choice-desc">{selectedChoice.description}</div>}
                </div>

                <div className="cheat-settlement-area">
                  {selectedChoice.result?.title && <div className="cheat-settlement-title">{selectedChoice.result.title}</div>}

                  {selectedEvent.type === 'ending' ? (
                    <div className="cheat-ending-final-stats">
                      {(() => {
                        const baseAttrs: Record<string, number> = { 财帛: 35, 文韬: 50, 理政: 48, 武略: 32, 体质: 25 }
                        const gameState: Record<string, number> = { 圣眷: 38, 中官: 42, 清议: 45, 士绅: 40, 民望: 36 }
                        const hidden: Record<string, number> = { 道德值: 42, 欲望值: 55, 野心值: 38 }

                        if (selectedEvent.id === 'triggerable_bankrupt') baseAttrs['财帛'] = 0
                        else if (selectedEvent.id === 'triggerable_death_illness') baseAttrs['体质'] = 0
                        else if (selectedEvent.id === 'triggerable_emperor_hate') gameState['圣眷'] = 0
                        else if (selectedEvent.id === 'triggerable_eunuch') gameState['中官'] = 0
                        else if (selectedEvent.id === 'triggerable_scholar_ostracism') gameState['清议'] = 0
                        else if (selectedEvent.id === 'triggerable_gentry_rebellion') gameState['士绅'] = 0
                        else if (selectedEvent.id === 'triggerable_popular_uproar') gameState['民望'] = 0
                        else if (selectedEvent.id === 'triggerable_moral_degeneracy') {
                          if (selectedChoice.id === 'c2') hidden['道德值'] = 30
                          else hidden['道德值'] = 0
                        }
                        
                        if (selectedChoice.effects.attributes) {
                          Object.entries(selectedChoice.effects.attributes).forEach(([k, v]) => {
                            if (baseAttrs[k] !== undefined) baseAttrs[k] = Math.max(0, Math.min(100, baseAttrs[k] + v))
                          })
                        }
                        if (selectedChoice.effects.gameState) {
                          Object.entries(selectedChoice.effects.gameState).forEach(([k, v]) => {
                            if (gameState[k] !== undefined) gameState[k] = Math.max(0, Math.min(100, gameState[k] + v))
                          })
                        }
                        if (selectedChoice.effects.hidden) {
                          Object.entries(selectedChoice.effects.hidden).forEach(([k, v]) => {
                            if (hidden[k] !== undefined) hidden[k] = Math.max(0, Math.min(100, hidden[k] + v))
                          })
                        }

                        return (
                          <>
                            <div className="cheat-final-stats-row">
                              {Object.entries(baseAttrs).map(([key, value]) => (
                                <span key={key} className={`cheat-final-stat ${value <= 10 ? 'critical' : value <= 30 ? 'warning' : ''}`}>
                                  {key} {value}
                                </span>
                              ))}
                            </div>
                            <div className="cheat-final-stats-row">
                              {Object.entries(gameState).map(([key, value]) => (
                                <span key={key} className={`cheat-final-stat ${value <= 10 ? 'critical' : value <= 20 ? 'warning' : ''}`}>
                                  {key} {value}
                                </span>
                              ))}
                            </div>
                            <div className="cheat-final-stats-row">
                              {Object.entries(hidden).map(([key, value]) => (
                                <span key={key} className={`cheat-final-stat ${key === '道德值' ? (value <= 10 ? 'critical' : value <= 30 ? 'warning' : '') : value >= 80 ? 'critical' : ''}`}>
                                  {key} {value}
                                </span>
                              ))}
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="cheat-effects-grid">
                      {selectedChoice.effects.attributes && Object.entries(selectedChoice.effects.attributes).map(([key, value]) => (
                        <div key={key} className={`cheat-effect-tag ${value > 0 ? 'positive' : 'negative'}`}>
                          {key}{value > 0 ? `+${value}` : value}
                        </div>
                      ))}
                      {selectedChoice.effects.gameState && Object.entries(selectedChoice.effects.gameState).map(([key, value]) => (
                        <div key={key} className={`cheat-effect-tag ${value > 0 ? 'positive' : 'negative'}`}>
                          {key}{value > 0 ? `+${value}` : value}
                        </div>
                      ))}
                      {selectedChoice.effects.hidden && Object.entries(selectedChoice.effects.hidden).map(([key, value]) => (
                        <div key={key} className={`cheat-effect-tag ${value > 0 ? 'positive' : 'negative'}`}>
                          {key}{value > 0 ? `+${value}` : value}
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedChoice.result?.echo && (
                    <div className="cheat-echo-box">
                      <div className="cheat-echo-label">【回音】</div>
                      <p className="cheat-echo-text">{selectedChoice.result.echo}</p>
                    </div>
                  )}
                </div>

                <div className="cheat-result-actions">
                  <button className="cheat-undo-btn" onClick={handleBackToChoices}>返回选项</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )

    return createPortal(node, document.body)
  }

  const node = (
    <div className="cheat-modal-overlay">
      <div className="cheat-modal">
        <div className="cheat-modal-header">
          <div className="cheat-modal-title">幽灵模式<span className="cheat-mode-badge">调试工具</span></div>
          <button className="cheat-close-btn" onClick={onClose}>退出幽灵模式</button>
        </div>

        <div className="cheat-modal-body">
          <div className="cheat-view-tabs">
            <button className={`cheat-view-tab ${viewMode === 'events' ? 'active' : ''}`} onClick={() => setViewMode('events')}>
              事件浏览
            </button>
            <button className={`cheat-view-tab ${viewMode === 'endings' ? 'active' : ''}`} onClick={() => setViewMode('endings')}>
              结局图鉴
            </button>
          </div>

          {viewMode === 'events' && (
            <>
              <div className="cheat-filter-section">
                <span className="cheat-filter-label">事件类型：</span>
                <select className="cheat-filter-select" value={eventTypeFilter} onChange={(e) => setEventTypeFilter(e.target.value as any)}>
                  <option value="all">全部 ({filteredEvents.length})</option>
                  <option value="historical">历史事件 ({historicalCount})</option>
                  <option value="transition">过渡事件 ({transitionCount})</option>
                  <option value="emotion">情感线 ({emotionCount})</option>
                  <option value="gray">灰色选择 ({grayCount})</option>
                  <option value="origin">出身路线 ({originCount})</option>
                  <option value="faction">派系事件 ({factionCount})</option>
                </select>
              </div>

              <div className="cheat-event-list">
                {filteredEvents.map((event) => (
                  <div key={`${event.type}_${event.id}`} className={`cheat-event-item ${event.type}`} onClick={() => handleEventClick(event)}>
                    <span className="cheat-event-type-badge">{eventTypeIcons[event.type] || '文'}</span>
                    <div className="cheat-event-content">
                      <div className="cheat-event-title-row">
                        <span className="cheat-event-title">{event.title}</span>
                        <span className="cheat-event-type-tag cheat-event-type-tag--inline">{eventTypeLabels[event.type] || event.type}</span>
                      </div>
                      {event.storyline && (
                        <div className="cheat-event-storyline-row">
                          {renderStorylineBadge(event.storyline)}
                        </div>
                      )}
                      {event.type !== 'ending' && event.conditions?.year?.min && (
                        <div className="cheat-event-time">
                          崇祯{event.conditions.year.min - 1627}年{event.conditions.month?.min && ` ${event.conditions.month.min}月`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {viewMode === 'endings' && (
            <>
              <div className="cheat-filter-section">
                <span className="cheat-filter-label">结局来源：</span>
                <select className="cheat-filter-select" value={endingFilter} onChange={(e) => setEndingFilter(e.target.value as any)}>
                  <option value="all">全部 ({allEndingEvents.length})</option>
                  <option value="triggerable">可触发 ({triggerableCount})</option>
                  <option value="narrative">叙事结局 ({narrativeCount})</option>
                  <option value="debauchery">荒淫线 ({debaucheryCount})</option>
                </select>
              </div>

              <div className="cheat-ghost-notice">
                结局图鉴：双击结局卡片可查看完整详情（叙事 + 选择 + 回音），结局由游戏系统根据属性/选择自动触发
              </div>

              <div className="cheat-ending-gallery">
                {filteredEndingEvents.map((ending) => {
                  const category = ending.endingConfig?.category || 'special'
                  const tier = ending.endingConfig?.tier || 'tragic'
                  const firstChoice = ending.choices[0]
                  
                  return (
                    <div key={ending.id} className="cheat-ending-card" onDoubleClick={() => handleEndingDoubleClick(ending)}>
                      <div className="cheat-ending-card-header">
                        <span className={`cheat-ending-category cat-${category}`}>{categoryLabels[category] || category}</span>
                        <span className={`cheat-ending-tier tier-${tier}`}>{tierLabels[tier] || tier}</span>
                      </div>
                      <div className="cheat-ending-card-title">{ending.title}</div>
                      {ending.storyline && (
                        <div className="cheat-ending-card-storyline">
                          {renderStorylineBadge(ending.storyline)}
                        </div>
                      )}
                      {firstChoice?.result?.tags && firstChoice.result.tags.length > 0 && (
                        <div className="cheat-ending-card-tags">
                          {firstChoice.result.tags.map((tag, i) => <span key={i} className="cheat-ending-tag">{tag}</span>)}
                        </div>
                      )}
                      {firstChoice?.result?.echo && (
                        <div className="cheat-ending-card-echo-preview">
                          <pre>{firstChoice.result.echo.slice(0, 120)}{firstChoice.result.echo.length > 120 ? '...' : ''}</pre>
                        </div>
                      )}
                      <div className="cheat-ending-card-footer">
                        <span className="cheat-ending-id">{ending.id}</span>
                        <span className="cheat-ending-trigger">{ending.choices.length} 个分支</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
    </div>
  </div>
  )

  return createPortal(node, document.body)
}
