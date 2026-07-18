import { memo } from 'react'
import { EventChoice } from '../types/event'
import { ConfirmDialog } from './ConfirmDialog'

interface ResignConfirmDialogProps {
  open: boolean
  choice: EventChoice | null
  onConfirm: () => void
  onCancel: () => void
}

function ResignConfirmDialogImpl({
  open,
  choice,
  onConfirm,
  onCancel
}: ResignConfirmDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="皇帝挽留"
      message="你上疏请求辞官，皇帝看了你的奏疏，面露不悦：「朕待你不薄，为何此时要弃朕而去？再考虑考虑吧……」"
      detail={choice?.text || undefined}
      warning="辞官后将结束游戏，此决定不可撤销。"
      confirmText="坚持辞官"
      cancelText="收回奏疏"
      variant="danger"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

export const ResignConfirmDialog = memo(ResignConfirmDialogImpl)
export default ResignConfirmDialog
