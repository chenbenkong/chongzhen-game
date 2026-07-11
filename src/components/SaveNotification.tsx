import { useEffect } from 'react'
import './SaveNotification.css'

interface SaveNotificationProps {
  isOpen: boolean
  onClose: () => void
  message: string
  subMessage?: string
}

export default function SaveNotification({ isOpen, onClose, message, subMessage }: SaveNotificationProps) {
  // 自动关闭
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose()
      }, 2000) // 2秒后自动关闭
      return () => clearTimeout(timer)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="save-notification-overlay" onClick={onClose}>
      <div className="save-notification" onClick={e => e.stopPropagation()}>
        <div className="save-icon">💾</div>
        <div className="save-content">
          <div className="save-title">{message}</div>
          {subMessage && <div className="save-subtitle">{subMessage}</div>}
        </div>
      </div>
    </div>
  )
}
