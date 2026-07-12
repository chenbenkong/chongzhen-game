import { useEffect, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import './ConfirmDialog.css'

interface ConfirmDialogProps {
  open: boolean
  title?: string
  message: string
  /** 补充说明（红色，警示性） */
  warning?: string
  /** 关联的元信息（如事件标题） */
  detail?: string
  confirmText?: string
  cancelText?: string
  /** 'danger' 红色确认 / 'primary' 暗金确认 */
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

/** 自定义确认弹窗 —— 暗金古风主题，Portal 到 body */
function ConfirmDialogImpl({
  open,
  title = '请确认',
  message,
  warning,
  detail,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'danger',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Esc 取消 / Enter 确认 + 锁 body 滚动 + 默认聚焦确认按钮
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'Enter' && e.target === document.body) {
        // 仅在无 input focus 时按 Enter 确认
        e.preventDefault()
        onConfirm()
      }
    }
    window.addEventListener('keydown', onKey)

    // 延迟聚焦，等 transition 开始
    const t = setTimeout(() => confirmRef.current?.focus(), 50)

    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [open, onCancel, onConfirm])

  if (!open) return null

  const node = (
    <div
      className="cd-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="cd-panel" role="dialog" aria-modal="true" aria-labelledby="cd-title">
        <div className="cd-header">
          <div className="cd-icon">{variant === 'danger' ? '⚠' : '?'}</div>
          <h2 id="cd-title" className="cd-title">{title}</h2>
        </div>

        <div className="cd-body">
          <p className="cd-message">{message}</p>
          {detail && <div className="cd-detail">📜 {detail}</div>}
          {warning && <div className="cd-warning">⚠ {warning}</div>}
        </div>

        <div className="cd-actions">
          <button className="cd-btn cd-btn-cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            className={`cd-btn cd-btn-${variant}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}

export const ConfirmDialog = memo(ConfirmDialogImpl)
export default ConfirmDialog
