import { memo } from 'react'
import { Attributes, HiddenAttributes } from '../types/game'
import './AttributePanel.css'

interface AttributePanelProps {
  attributes: Attributes
  hidden: HiddenAttributes
}

function AttributePanel({ attributes, hidden }: AttributePanelProps) {
  const getAttributeLevel = (value: number): 'normal' | 'low' | 'danger' | 'critical' => {
    if (value <= 0) return 'critical'
    if (value <= 10) return 'danger'
    if (value <= 25) return 'low'
    return 'normal'
  }

  const getHiddenLevel = (value: number): 'good' | 'neutral' | 'bad' | 'critical' => {
    if (value <= 0) return 'critical'
    if (value <= 25) return 'bad'
    if (value <= 50) return 'neutral'
    return 'good'
  }

  /** 隐藏属性的四档评价文案 */
  const HIDDEN_HINTS: Record<string, [string, string, string, string]> = {
    // [>75, >50, >25, ≤25]
    道德值: ['君子', '正直', '常人', '小人'],
    欲望值: ['强烈', '一般', '淡泊', '清心'],
    野心值: ['勃勃', '有', '微', '无'],
    机敏值: ['机警', '敏锐', '寻常', '迟钝'],
    忠诚值: ['死忠', '忠谨', '观望', '首鼠']
  }

  const hiddenHint = (key: string, value: number): string => {
    const tiers = HIDDEN_HINTS[key]
    if (!tiers) return ''
    if (value > 75) return tiers[0]
    if (value > 50) return tiers[1]
    if (value > 25) return tiers[2]
    return tiers[3]
  }

  const personalAttributes = [
    { key: '财帛', value: attributes.财帛 },
    { key: '文韬', value: attributes.文韬 },
    { key: '理政', value: attributes.理政 },
    { key: '武略', value: attributes.武略 },
    { key: '体质', value: attributes.体质 },
  ]

  return (
    <div className="attribute-panel">
      <div className="panel-section">
        <h3 className="section-title">个人能力</h3>
        <div className="attr-list">
          {personalAttributes.map(({ key, value }) => {
            const level = getAttributeLevel(value)
            const isCritical = key === '财帛' || key === '体质'
            return (
              <div key={key} className={`attr-item attr-${level} ${isCritical ? 'attr-critical-type' : ''}`}>
                <span className="attr-name">{key}</span>
                <div className="attr-bar-wrap">
                  <div className="attr-bar-bg">
                    <div
                      className={`attr-bar-fill attr-bar-${level}`}
                      style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
                    />
                  </div>
                </div>
                <span className={`attr-num attr-num-${level}`}>{Math.round(Math.max(value, 0))}</span>
                {(isCritical && (level === 'danger' || level === 'critical')) && (
                  <span className="attr-warning" aria-label="警告" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="panel-section hidden-attrs">
        <h3 className="section-title">隐藏属性</h3>
        <div className="attr-list compact">
          {Object.entries(hidden).map(([key, value]) => {
            const level = getHiddenLevel(value)
            const isCritical = key === '道德值'
            return (
              <div key={key} className={`attr-item small attr-${level}`}>
                <span className="attr-name">{key}</span>
                <div className="attr-bar-wrap" style={{ width: '60px' }}>
                  <div className="attr-bar-bg">
                    <div
                      className={`attr-bar-fill attr-bar-${level}`}
                      style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
                    />
                  </div>
                </div>
                <span className={`attr-num attr-num-${level}`} style={{ fontSize: '0.85rem', minWidth: '30px' }}>
                  {Math.round(Math.max(value, 0))}
                </span>
                <span className={`attr-hint attr-hint-${level}`} style={{ fontSize: '0.7rem', minWidth: '40px' }}>
                  {hiddenHint(key, value)}
                </span>
                {(isCritical && (level === 'bad' || level === 'critical')) && (
                  <span className="attr-warning-small" aria-label="警告" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// 性能优化: memo - character.attributes/hidden 引用未变时跳过整个面板重渲染
// (EventDisplay 等子树更新时不会连带重渲染 5 个属性条)
export default memo(AttributePanel)
