import { useEffect, useState } from 'react'
import './AchievementUnlock.css'

interface AchievementUnlockProps {
  achievementName: string
  achievementDescription: string
  achievementIcon: string
  isOpen: boolean
  onClose: () => void
}

export default function AchievementUnlock({
  achievementName,
  achievementDescription,
  achievementIcon,
  isOpen,
  onClose
}: AchievementUnlockProps) {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setLeaving(false)
      // Use rAF so the .visible class is applied in the next frame, allowing the entry transition to play.
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    } else {
      setVisible(false)
      setLeaving(false)
    }
  }, [isOpen])

  // ESC closes
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  const handleClose = () => {
    setLeaving(true)
    // Match the css exit duration (180ms) before unmounting.
    setTimeout(onClose, 180)
  }

  if (!isOpen && !visible) return null

  return (
    <div
      className={`achievement-unlock-overlay ${visible ? 'visible' : ''} ${leaving ? 'leaving' : ''}`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={`成就解锁：${achievementName}`}
    >
      <div
        className="achievement-unlock-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="achievement-icon-container">
          <div className="achievement-icon">{achievementIcon}</div>
        </div>
        <div className="achievement-content">
          <div className="achievement-badge">🏆 成就解锁！</div>
          <div className="achievement-name">{achievementName}</div>
          <div className="achievement-description">{achievementDescription}</div>
        </div>
        <button
          className="achievement-close-button"
          onClick={handleClose}
          autoFocus
        >
          ✕ 关闭
        </button>
      </div>
    </div>
  )
}
