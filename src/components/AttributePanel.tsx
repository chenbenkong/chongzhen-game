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
                  <span className="attr-warning">⚠️</span>
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
                  {key === '道德值' ? (value > 75 ? '君子' : value > 50 ? '正直' : value > 25 ? '常人' : '小人') :
                   key === '欲望值' ? (value > 75 ? '强烈' : value > 50 ? '一般' : value > 25 ? '淡泊' : '清心') :
                   key === '野心值' ? (value > 75 ? '勃勃' : value > 50 ? '有' : value > 25 ? '微' : '无') : ''}
                </span>
                {(isCritical && (level === 'bad' || level === 'critical')) && (
                  <span className="attr-warning-small">⚠️</span>
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
