import { useState, useCallback, useRef } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'

export interface ConfirmOptions {
  title?: string
  message: string
  detail?: string
  warning?: string
  variant?: 'danger' | 'primary'
  confirmText?: string
  cancelText?: string
}

interface InternalState extends ConfirmOptions {
  open: boolean
}

/**
 * 自定义确认弹窗 hook（替代 window.confirm）
 * 用法：
 *   const { confirm, dialog } = useConfirm()
 *   const ok = await confirm({ title, message, ... })
 *   if (ok) { ... }
 *   // JSX 末尾渲染 {dialog}
 */
export function useConfirm() {
  const [state, setState] = useState<InternalState>({
    open: false,
    message: ''
  })
  const resolveRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve
      setState({ ...opts, open: true })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true)
    resolveRef.current = null
    setState(s => ({ ...s, open: false }))
  }, [])

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false)
    resolveRef.current = null
    setState(s => ({ ...s, open: false }))
  }, [])

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      detail={state.detail}
      warning={state.warning}
      variant={state.variant}
      confirmText={state.confirmText}
      cancelText={state.cancelText}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  )

  return { confirm, dialog }
}
