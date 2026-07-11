import { memo as ReactMemo } from 'react'
import './ActionBar.css'

interface ActionBarProps {
  onNextMonth: () => void
  onSave: () => void
  onOpenAchievements?: () => void
  onOpenHelp?: () => void
  onOpenAIAdvisor?: () => void
  onReturnToMenu?: () => void
  turn: number
  canProceed: boolean
}

const ActionBarImpl = function ActionBar({ onNextMonth, onSave, onOpenAchievements, onOpenHelp, onOpenAIAdvisor, onReturnToMenu, turn, canProceed }: ActionBarProps) {
  return (
    <div className="action-bar">
      <div className="action-left">
        <span className="turn-info">第 {turn} 回合</span>
      </div>

      <div className="action-center">
        <button
          className={`action-btn primary ${!canProceed ? 'disabled' : ''}`}
          onClick={onNextMonth}
          disabled={!canProceed}
        >
          <span className="btn-icon">▸</span>
          <span>下 月</span>
        </button>
      </div>

      <div className="action-right">
        {onReturnToMenu && (
          <button
            className="action-btn secondary menu-btn"
            onClick={onReturnToMenu}
            title="返回主菜单（自动存档会被保留）"
            aria-label="返回主菜单"
          >
            <span className="btn-icon">↩</span>
            <span>主菜单</span>
          </button>
        )}
        <button className="action-btn secondary" onClick={onOpenAchievements}>
          <span className="btn-icon">🏆</span>
          <span>成就</span>
        </button>
        <button className="action-btn secondary" onClick={onOpenHelp}>
          <span className="btn-icon">❓</span>
          <span>帮助</span>
        </button>
        {onOpenAIAdvisor && (
          <button
            className="action-btn secondary ai-advisor-btn"
            onClick={onOpenAIAdvisor}
            title="询问 AI 谋士"
            aria-label="AI 谋士"
          >
            <span className="btn-icon">策</span>
            <span>谋士</span>
          </button>
        )}
        <button className="action-btn secondary" onClick={onSave}>
          <span className="btn-icon">💾</span>
          <span>存 档</span>
        </button>
      </div>
    </div>
  )
}

// 性能优化: memo + default export（确保 default import 名字正确）
const ActionBar = ReactMemo(ActionBarImpl)
export default ActionBar
