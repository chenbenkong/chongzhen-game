import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { SaveSlot, getAllSaveSlots, deleteSaveSlot, hasAutosave, getAutosavePreview, deleteAutosave } from '../types/save'
import { useConfirm } from '../hooks/useConfirm'
import { useModal } from '../hooks/useModal'
import './SaveSlotsModal.css'

interface SaveSlotsModalProps {
  isOpen: boolean
  mode: 'save' | 'load'
  currentData?: {
    name: string
    year: number
    month: number
    rank: string
    title: string
  }
  onSelect: (slotId: number) => void
  /** 加载自动存档的回调（SaveSlotsModal 在自动存档槽位上点击时触发） */
  onLoadAutosave?: () => void
  onClose: () => void
}

export default function SaveSlotsModal({ isOpen, mode, currentData, onSelect, onLoadAutosave, onClose }: SaveSlotsModalProps) {
  const [slots, setSlots] = useState<SaveSlot[]>([])
  const [autosavePresent, setAutosavePresent] = useState(false)
  const [autosavePreview, setAutosavePreviewState] = useState<ReturnType<typeof getAutosavePreview>>(null)
  const { confirm, dialog: confirmDialog } = useConfirm()

  useEffect(() => {
    if (isOpen) {
      setSlots(getAllSaveSlots())
      setAutosavePresent(hasAutosave())
      setAutosavePreviewState(getAutosavePreview())
    }
  }, [isOpen])

  const handleDelete = useCallback(async (slotId: number) => {
    const slot = slots.find(s => s.id === slotId)
    const ok = await confirm({
      title: '焚毁存档',
      message: `确定要删除槽位 ${slotId} 的存档吗？`,
      detail: slot?.preview
        ? `${slot.preview.playerName} · ${slot.preview.year}年${slot.preview.month}月 · ${slot.preview.rank}`
        : undefined,
      warning: '删除后无法恢复，该进度将永久消失。',
      confirmText: '删除',
      cancelText: '保留',
      variant: 'danger'
    })
    if (!ok) return
    deleteSaveSlot(slotId)
    setSlots(getAllSaveSlots())
  }, [slots, confirm])

  const handleDeleteAutosave = useCallback(async () => {
    const ok = await confirm({
      title: '焚毁存档',
      message: '确定要删除自动存档吗？',
      warning: '删除后无法恢复，最近进度将丢失。',
      confirmText: '删除',
      cancelText: '保留',
      variant: 'danger'
    })
    if (!ok) return
    deleteAutosave()
    setAutosavePresent(false)
    setAutosavePreviewState(null)
  }, [confirm])

  // 对话框无障碍语义 + ESC / Tab 焦点陷阱 / 焦点还原 / 滚动锁
  // 遮罩点击改为 target 守卫：确认弹窗 portal 到 body，但 React 合成事件仍会沿 React 树冒泡上来
  const { getModalProps, dialogRef, titleId, handleOverlayClick } = useModal({
    open: isOpen,
    onClose
  })

  if (!isOpen) return null

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const formatPlayTime = (seconds?: number) => {
    if (!seconds) return ''
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}小时${minutes}分`
    }
    return `${minutes}分钟`
  }

  // 自动存档槽位 UI（独立于手动 1/2/3 槽，单独排在最上方）
  const renderAutosaveSlot = () => (
    <div className={`save-slot autosave-slot ${autosavePresent ? 'has-data' : 'empty'}`}>
      <div className="slot-header">
        <span className="slot-number autosave-label">自动存档</span>
        {autosavePresent && (
          <button
            className="delete-btn"
            aria-label="删除自动存档"
            onClick={(e) => { e.stopPropagation(); handleDeleteAutosave() }}
          >
            删
          </button>
        )}
      </div>

      {autosavePresent && autosavePreview ? (
        mode === 'load' ? (
          <button
            type="button"
            className="slot-content"
            onClick={() => onLoadAutosave?.()}
            aria-label={`读取自动存档：${autosavePreview.playerName} · ${autosavePreview.year}年${autosavePreview.month}月 · ${autosavePreview.rank}`}
          >
            <div className="slot-preview">
              <div className="preview-name">{autosavePreview.playerName}</div>
              <div className="preview-title">{autosavePreview.title}</div>
              <div className="autosave-tag">自动</div>
            </div>
            <div className="slot-info">
              <div className="info-row">
                <span className="label">时间：</span>
                <span className="value">{autosavePreview.year}年{autosavePreview.month}月</span>
              </div>
              <div className="info-row">
                <span className="label">官职：</span>
                <span className="value">{autosavePreview.rank}</span>
              </div>
              {autosavePreview.playTime && (
                <div className="info-row">
                  <span className="label">游玩：</span>
                  <span className="value">{formatPlayTime(autosavePreview.playTime)}</span>
                </div>
              )}
              <div className="info-row">
                <span className="label">存档：</span>
                <span className="value">{formatDate(autosavePreview.savedAt)}</span>
              </div>
            </div>
            <div className="slot-action">
              <span className="action-text">读取自动存档</span>
              <span className="arrow" aria-hidden="true">→</span>
            </div>
          </button>
        ) : (
          /* 存档模式下自动存档不可手动覆盖：保留原来的非交互信息块 */
          <div className="slot-content empty-slot">
            <div className="empty-icon" aria-hidden="true" />
            <div className="empty-text">自动保存中（不可手动覆盖）</div>
          </div>
        )
      ) : (
        <div className="slot-content empty-slot">
          <div className="empty-icon" aria-hidden="true" />
          <div className="empty-text">
            {mode === 'save' ? '游戏中会自动保存进度' : '暂无自动存档'}
          </div>
        </div>
      )}

    </div>
  )

  const node = (
    <div className="save-slots-overlay" onClick={handleOverlayClick}>
      <div className="save-slots-modal" ref={dialogRef} {...getModalProps()}>
        <div className="save-slots-header">
          <h2 id={titleId}>{mode === 'save' ? '选择存档槽位' : '选择存档'}</h2>
          <button className="close-btn" onClick={onClose} aria-label="关闭">×</button>
        </div>

        {mode === 'save' && currentData && (
          <div className="current-game-info">
            <span>当前进度：</span>
            <span className="highlight">{currentData.name}</span>
            <span>·</span>
            <span>{currentData.year}年{currentData.month}月</span>
            <span>·</span>
            <span>{currentData.rank}</span>
          </div>
        )}

        <div className="save-slots-list">
          {renderAutosaveSlot()}
          {[1, 2, 3].map(slotId => {
            const slot = slots.find(s => s.id === slotId)
            const hasData = !!slot?.preview

            return (
              <div key={slotId} className={`save-slot ${hasData ? 'has-data' : 'empty'}`}>
                <div className="slot-header">
                  <span className="slot-number">槽位 {slotId}</span>
                  {hasData && (
                    <button
                      className="delete-btn"
                      aria-label={`删除槽位 ${slotId}`}
                      onClick={(e) => { e.stopPropagation(); handleDelete(slotId) }}
                    >
                      删
                    </button>
                  )}
                </div>

                {hasData ? (
                  <button
                    type="button"
                    className="slot-content"
                    onClick={() => onSelect(slotId)}
                    aria-label={`${mode === 'save' ? '覆盖' : '读取'}槽位 ${slotId}：${slot?.preview?.playerName} · ${slot?.preview?.year}年${slot?.preview?.month}月 · ${slot?.preview?.rank}`}
                  >
                    <div className="slot-preview">
                      <div className="preview-name">{slot?.preview?.playerName}</div>
                      <div className="preview-title">{slot?.preview?.title}</div>
                    </div>
                    <div className="slot-info">
                      <div className="info-row">
                        <span className="label">时间：</span>
                        <span className="value">{slot?.preview?.year}年{slot?.preview?.month}月</span>
                      </div>
                      <div className="info-row">
                        <span className="label">官职：</span>
                        <span className="value">{slot?.preview?.rank}</span>
                      </div>
                      {slot?.preview?.playTime && (
                        <div className="info-row">
                          <span className="label">游玩：</span>
                          <span className="value">{formatPlayTime(slot.preview.playTime)}</span>
                        </div>
                      )}
                      <div className="info-row">
                        <span className="label">存档：</span>
                        <span className="value">{formatDate(slot?.preview?.savedAt || '')}</span>
                      </div>
                    </div>
                    <div className="slot-action">
                      <span className="action-text">
                        {mode === 'save' ? '覆盖存档' : '读取存档'}
                      </span>
                      <span className="arrow" aria-hidden="true">→</span>
                    </div>
                  </button>
                ) : mode === 'save' ? (
                  <button
                    type="button"
                    className="slot-content empty-slot"
                    onClick={() => onSelect(slotId)}
                    aria-label={`保存到空槽位 ${slotId}`}
                  >
                    <div className="empty-icon" aria-hidden="true" />
                    <div className="empty-text">点击保存到该槽位</div>
                  </button>
                ) : (
                  <div className="slot-content empty-slot">
                    <div className="empty-icon" aria-hidden="true" />
                    <div className="empty-text">暂无存档</div>
                  </div>
                )}

              </div>
            )
          })}
        </div>
      </div>
      {confirmDialog}
    </div>
  )

  return createPortal(node, document.body)
}
