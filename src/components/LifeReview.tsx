import { useState } from 'react'
import { createPortal } from 'react-dom'
import { LifeRecord, LifeSummary, Character, GameStateValues } from '../types/game'
import { GameEvent } from '../types/event'
import { generateEpitaph } from '../utils/endingSystem'
import Icon, { IconName } from './Icon'
import './LifeReview.css'

interface LifeReviewProps {
  isOpen: boolean
  lifeRecords: LifeRecord[]
  lifeSummary: LifeSummary
  character: Character
  finalGameState: GameStateValues
  endingEvent?: GameEvent
  onClose: () => void
  onRestart: () => void
}

export default function LifeReview({
  isOpen,
  lifeRecords,
  lifeSummary,
  character,
  finalGameState,
  endingEvent,
  onClose,
  onRestart
}: LifeReviewProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'summary' | 'achievements' | 'epitaph'>('timeline')

  if (!isOpen) return null

  const getRecordIcon = (type: LifeRecord['type']): IconName => {
    switch (type) {
      case 'birth': return 'birth'
      case 'exam': return 'exam'
      case 'promotion': return 'promotion'
      case 'demotion': return 'demotion'
      case 'event': return 'document'
      case 'choice': return 'sword'
      case 'death': return 'coffin'
      case 'marriage': return 'marriage'
      case 'relation': return 'handshake'
      default: return 'pin'
    }
  }

  const getRecordColor = (type: LifeRecord['type']) => {
    switch (type) {
      case 'promotion': return 'promotion'
      case 'demotion': return 'demotion'
      case 'death': return 'death'
      case 'exam': return 'exam'
      default: return 'default'
    }
  }

  const renderTimeline = () => {
    // 优先使用 keyEvents，如果没有则使用 lifeRecords
    const records = lifeSummary.keyEvents?.length > 0 ? lifeSummary.keyEvents : lifeRecords
    
    return (
      <div className="life-review-timeline compact">
        {records.map((record) => (
          <div key={record.id} className={`timeline-row ${getRecordColor(record.type)}`}>
            <div className="timeline-date-badge">
              <span className="date-year">{record.year}</span>
              <span className="date-month">{record.month}月</span>
            </div>
            <div className="timeline-icon-badge"><Icon name={getRecordIcon(record.type)} size={14} color="#d4af37" /></div>
            <div className="timeline-content-compact">
              <div className="timeline-title-row">
                <span className="timeline-event-title">{record.title}</span>
                {record.impact && <span className="timeline-impact-tag">{record.impact}</span>}
              </div>
              <p className="timeline-desc-text">{record.description}</p>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderSummary = () => (
    <div className="life-review-summary compact">
      {/* 顶部信息卡片 - 一行展示 */}
      <div className="summary-top-card">
        <div className="top-card-main">
          <span className="top-card-rank">{lifeSummary.finalTitle}</span>
          <span className="top-card-degree">{lifeSummary.finalRank} · {character.origin}</span>
        </div>
        <div className="top-card-stats">
          <span className="top-stat">享年{lifeSummary.lifespan.end - lifeSummary.lifespan.start}岁</span>
          <span className="top-stat">{character.promotionCount}升{character.demotionCount}贬</span>
          <span className="top-stat">{character.wives.length}妻{character.lovers.length}妾</span>
        </div>
      </div>

      {/* 评价卡片 */}
      <div className="summary-evaluation-card">
        <div className="evaluation-main">
          <span className="evaluation-label">历史评价</span>
          <p className="evaluation-reputation">{lifeSummary.reputation}</p>
        </div>
        <p className="evaluation-legacy">{lifeSummary.legacy}</p>
      </div>
    </div>
  )

  const renderAchievements = () => (
    <div className="life-review-achievements compact">
      {/* 功过卡片 - 并排显示 */}
      <div className="merit-demerit-row">
        {/* 功绩 */}
        <div className="merit-box">
          <div className="merit-header">
            <span className="merit-icon"><Icon name="sparkle" size={14} color="#d4af37" /></span>
            <span className="merit-title">生平功绩</span>
            <span className="merit-count">{lifeSummary.achievements.length}</span>
          </div>
          <div className="merit-tags">
            {lifeSummary.achievements.map((achievement, idx) => (
              <span key={idx} className="merit-tag positive">{achievement}</span>
            ))}
          </div>
        </div>

        {/* 争议 */}
        {lifeSummary.controversies.length > 0 && (
          <div className="merit-box">
            <div className="merit-header">
              <span className="merit-icon"><Icon name="sparkleDim" size={16} color="#a08060" /></span>
              <span className="merit-title">争议是非</span>
              <span className="merit-count">{lifeSummary.controversies.length}</span>
            </div>
            <div className="merit-tags">
              {lifeSummary.controversies.map((controversy, idx) => (
                <span key={idx} className="merit-tag negative">{controversy}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 属性面板 - 紧凑网格 */}
      <div className="attributes-compact-panel">
        <div className="attr-panel-header">最终属性</div>
        <div className="attributes-grid">
          {/* 个人能力 */}
          <div className="attr-column">
            <span className="attr-col-title">个人能力</span>
            {Object.entries(character.attributes).map(([key, value]) => (
              <div key={key} className="attr-mini-bar">
                <span className="attr-mini-name">{key}</span>
                <div className="attr-mini-track">
                  <div className="attr-mini-fill" style={{ width: `${value}%` }}></div>
                </div>
                <span className="attr-mini-value">{value}</span>
              </div>
            ))}
          </div>
          {/* 五方态度 */}
          <div className="attr-column">
            <span className="attr-col-title">五方态度</span>
            {Object.entries(finalGameState)
              .filter(([key]) => !['currentYear', 'currentMonth', 'turn'].includes(key))
              .map(([key, value]) => (
                <div key={key} className="attr-mini-bar">
                  <span className="attr-mini-name">{key}</span>
                  <div className="attr-mini-track">
                    <div className="attr-mini-fill" style={{ width: `${value}%` }}></div>
                  </div>
                  <span className="attr-mini-value">{value}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderEpitaph = () => {
    if (!endingEvent) {
      return (
        <div className="life-review-epitaph">
          <p className="epitaph-empty">无结局事件，无法生成墓志铭。</p>
        </div>
      )
    }
    const text = generateEpitaph(character, finalGameState, endingEvent)
    return (
      <div className="life-review-epitaph compact">
        <div className="epitaph-paper">
          <pre className="epitaph-text">{text}</pre>
        </div>
      </div>
    )
  }

  const node = (
    <div className="life-review-overlay">
      {/* 顶部装饰条 */}
      <div className="life-review-top-bar"></div>

      {/* 主容器 */}
      <div className="life-review-container">
        {/* 头部 */}
        <div className="life-review-header">
          <h1 className="life-review-title">生平回顾</h1>
          <p className="life-review-subtitle">
            {character.name} · {character.origin} · 崇祯{lifeSummary.lifespan.start}-{lifeSummary.lifespan.end}年
          </p>
        </div>

        {/* 标签页 */}
        <div className="life-review-tabs">
          <button
            className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('timeline')}
          >
            生平大事
          </button>
          <button
            className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            人生总结
          </button>
          <button
            className={`tab-btn ${activeTab === 'achievements' ? 'active' : ''}`}
            onClick={() => setActiveTab('achievements')}
          >
            功过评价
          </button>
          {endingEvent && (
            <button
              className={`tab-btn ${activeTab === 'epitaph' ? 'active' : ''}`}
              onClick={() => setActiveTab('epitaph')}
            >
              墓志铭
            </button>
          )}
        </div>

        {/* 内容区域 */}
        <div className="life-review-content">
          {activeTab === 'timeline' && renderTimeline()}
          {activeTab === 'summary' && renderSummary()}
          {activeTab === 'achievements' && renderAchievements()}
          {activeTab === 'epitaph' && endingEvent && renderEpitaph()}
        </div>

        {/* 底部按钮 */}
        <div className="life-review-actions">
          <button className="life-review-btn life-review-btn-secondary" onClick={onClose}>
            返回
          </button>
          <button className="life-review-btn life-review-btn-primary" onClick={onRestart}>
            重新开始
          </button>
        </div>

        {/* 底部装饰 */}
        <div className="life-review-footer">
          <span className="life-review-footer-text">
            共计{lifeSummary.totalRecords}件大事 · 载入史册
          </span>
        </div>
      </div>

      {/* 底部装饰条 */}
      <div className="life-review-bottom-bar"></div>
    </div>
  )

  return createPortal(node, document.body)
}
