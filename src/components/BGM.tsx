import { useBGM } from './BGMContext'
import './BGM.css'

// 主菜单 fixed 定位（独立浮在屏幕右上）
export function BGMFixedButton() {
  const { on, toggle } = useBGM()
  return (
    <button
      className="bgm-toggle bgm-toggle--fixed"
      onClick={toggle}
      title={on ? '音乐：开（点击关闭）' : '音乐：关（点击开启）'}
      aria-label={on ? '关闭背景音乐' : '开启背景音乐'}
    >
      <span className="bgm-icon">{on ? '🎵' : '🔇'}</span>
      <span className="bgm-label">音乐：{on ? '开' : '关'}</span>
    </button>
  )
}

// 内联（在 StatusBar 幽灵模式按钮左边）
export function BGMInlineButton() {
  const { on, toggle } = useBGM()
  return (
    <button
      className="bgm-toggle bgm-toggle--inline"
      onClick={toggle}
      title={on ? '音乐：开（点击关闭）' : '音乐：关（点击开启）'}
      aria-label={on ? '关闭背景音乐' : '开启背景音乐'}
    >
      <span className="bgm-icon">{on ? '🎵' : '🔇'}</span>
      <span className="bgm-label">{on ? '音乐：开' : '音乐：关'}</span>
    </button>
  )
}
