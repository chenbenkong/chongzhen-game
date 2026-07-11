import './DeathEnding.css'

interface DeathEndingProps {
  isOpen: boolean
  endingType: 'martyrdom' | 'suicide' | 'killed' | 'execution'
  title: string
  description: string
  echo: string
  tags: string[]
  onClose: () => void
  onRestart?: () => void
}

export default function DeathEnding({ 
  isOpen, 
  endingType, 
  title, 
  description, 
  echo,
  tags,
  onClose,
  onRestart 
}: DeathEndingProps) {
  if (!isOpen) return null

  const getEndingIcon = () => {
    switch (endingType) {
      case 'martyrdom':
        return '⚔️'
      case 'suicide':
        return '🕯️'
      case 'killed':
        return '⚰️'
      case 'execution':
        return '🔪'
      default:
        return '💀'
    }
  }

  const getEndingTitle = () => {
    switch (endingType) {
      case 'martyrdom':
        return '殉国而亡'
      case 'suicide':
        return '自缢身亡'
      case 'killed':
        return '战死沙场'
      case 'execution':
        return '身首异处'
      default:
        return '英年早逝'
    }
  }

  const getEndingColor = () => {
    switch (endingType) {
      case 'martyrdom':
        return 'martyrdom'
      case 'suicide':
        return 'suicide'
      case 'killed':
        return 'killed'
      case 'execution':
        return 'execution'
      default:
        return 'default'
    }
  }

  return (
    <div className={`death-ending-overlay ${getEndingColor()}`}>
      {/* 顶部装饰条 */}
      <div className="death-ending-top-bar"></div>

      {/* 主容器 */}
      <div className="death-ending-container">
        {/* 头部区域 */}
        <div className="death-ending-header">
          <div className="death-ending-icon">{getEndingIcon()}</div>
          <div className="death-ending-type">{getEndingTitle()}</div>
        </div>

        {/* 标题 */}
        <h2 className="death-ending-title">{title}</h2>

        {/* 属性标签 */}
        {tags.length > 0 && (
          <div className="death-ending-tags">
            {tags.map((tag, index) => (
              <span key={index} className="death-ending-tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 描述文本 */}
        {description && (
          <div className="death-ending-description">
            {description}
          </div>
        )}

        {/* 回音 */}
        {echo && (
          <div className="death-ending-echo">
            <div className="death-ending-echo-label">【历史评价】</div>
            <p className="death-ending-echo-text">{echo}</p>
          </div>
        )}

        {/* 底部按钮 */}
        <div className="death-ending-actions">
          <button className="death-ending-btn death-ending-btn-primary" onClick={onClose}>
            查看生平
          </button>
          {onRestart && (
            <button className="death-ending-btn death-ending-btn-secondary" onClick={onRestart}>
              重新开始
            </button>
          )}
        </div>

        {/* 底部装饰 */}
        <div className="death-ending-footer">
          <span className="death-ending-footer-text">大明王朝 · 崇祯年间</span>
        </div>
      </div>

      {/* 底部装饰条 */}
      <div className="death-ending-bottom-bar"></div>
    </div>
  )
}
