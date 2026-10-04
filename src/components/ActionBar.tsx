import { memo as ReactMemo } from 'react'
import './ActionBar.css'

interface ActionBarProps {
  onNextMonth: () => void
  onSave: () => void
  onOpenAchievements?: () => void
  onOpenHelp?: () => void
  onOpenAIAdvisor?: () => void
  onOpenImageGenerator?: () => void
  onReturnToMenu?: () => void
  turn: number
  canProceed: boolean
  /**
   * 按钮不可点时的原因（会显示给玩家）。
   *
   * 为什么需要它：「进 下 月」只在**没有待处理事件**时才可用
   * （canProceed = !currentEvent）。而实际上几乎每个月都会生成事件，
   * 所以这个按钮在正常游玩中**长期处于禁用状态**。
   * 玩家看到的是一个灰掉的、带边框的、看起来像坏了的主按钮，
   * 却没有任何说明 —— 于是被当成 bug 报上来（"下月的按钮怎么无法点击了"）。
   *
   * 真正推进流程的是事件面板里的「继 续」按钮。这里把这件事说清楚，
   * 比让玩家反复试错要有效得多。
   */
  blockedReason?: string
}

const ActionBarImpl = function ActionBar({ onNextMonth, onSave, onOpenAchievements, onOpenHelp, onOpenAIAdvisor, onOpenImageGenerator, onReturnToMenu, turn, canProceed, blockedReason }: ActionBarProps) {
  const hint = canProceed ? null : blockedReason || '需先处理本月待办事件'

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
          title={hint || '进入下一个月'}
          aria-describedby={hint ? 'action-next-hint' : undefined}
        >
          <span className="btn-icon">进</span>
          <span>下 月</span>
        </button>
        {/* 禁用原因常驻显示：光靠灰按钮玩家猜不出为什么 */}
        {hint && (
          <span className="action-hint" id="action-next-hint">
            {hint}
          </span>
        )}
      </div>

      <div className="action-right">
        {onReturnToMenu && (
          <button
            className="action-btn secondary menu-btn"
            onClick={onReturnToMenu}
            title="返回主菜单（自动存档会被保留）"
            aria-label="返回主菜单"
          >
            <span className="btn-icon">返</span>
            <span>主菜单</span>
          </button>
        )}
        <button className="action-btn secondary" onClick={onOpenAchievements}>
          <span className="btn-icon">功</span>
          <span>成就</span>
        </button>
        <button className="action-btn secondary" onClick={onOpenHelp}>
          <span className="btn-icon">问</span>
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
        {onOpenImageGenerator && (
          <button
            className="action-btn secondary image-generator-btn"
            onClick={onOpenImageGenerator}
            title="AI 生成场景插图"
            aria-label="丹青画卷"
          >
            <span className="btn-icon">绘</span>
            <span>丹青</span>
          </button>
        )}
        <button className="action-btn secondary" onClick={onSave}>
          <span className="btn-icon">存</span>
          <span>存 档</span>
        </button>
      </div>
    </div>
  )
}

// 性能优化: memo + default export（确保 default import 名字正确）
const ActionBar = ReactMemo(ActionBarImpl)
export default ActionBar
