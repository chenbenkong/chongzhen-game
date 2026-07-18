import { useBGM } from './BGMContext'
import './BGM.css'

// 主菜单 fixed 定位（独立浮在屏幕右上）
export function BGMFixedButton() {
  const { on, toggle, status, errorMessage } = useBGM()
  // 错误时强制显示 "关" 状态图标，避免误导
  const isError = status === 'error'
  return (
    <button
      type="button"
      className={`bgm-toggle bgm-toggle--fixed ${isError ? 'is-error' : ''}`}
      onClick={toggle}
      title={isError ? errorMessage || '音乐加载失败，点击重试' : on ? '点击关闭音乐' : '点击开启音乐'}
      aria-label={on ? '关闭音乐' : '开启音乐'}
    >
      <span className={`bgm-icon ${isError ? 'is-error' : on ? 'is-on' : 'is-off'}`} />
      <span className="bgm-label">{isError ? '音乐加载失败' : (on ? '音乐：开' : '音乐：关')}</span>
    </button>
  )
}

export function BGMInlineButton() {
  const { on, toggle, status, errorMessage } = useBGM()
  const isError = status === 'error'
  return (
    <button
      type="button"
      className={`bgm-toggle bgm-toggle--inline ${isError ? 'is-error' : ''}`}
      onClick={toggle}
      title={isError ? errorMessage || '音乐加载失败，点击重试' : on ? '点击关闭音乐' : '点击开启音乐'}
      aria-label={on ? '关闭音乐' : '开启音乐'}
    >
      <span className={`bgm-icon ${isError ? 'is-error' : on ? 'is-on' : 'is-off'}`} />
      <span className="bgm-label">{isError ? '音乐加载失败' : (on ? '音乐：开' : '音乐：关')}</span>
    </button>
  )
}
