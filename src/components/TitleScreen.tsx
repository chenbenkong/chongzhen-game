import { memo, useMemo } from 'react'
import { BGMFixedButton } from './BGM'
import { SaveData, getAllSaveSlots, getAutosavePreview } from '../types/save'
import './TitleScreen.css'

export interface TitleScreenProps {
  onStart: () => void
  onContinueAutosave: () => void
  onOpenLoad: () => void
  onOpenAchievements: () => void
  onOpenCodex: () => void
  onOpenTutorial: () => void
  loadSaveData?: SaveData
}

function TitleScreenImpl({
  onStart,
  onContinueAutosave,
  onOpenLoad,
  onOpenAchievements,
  onOpenCodex,
  onOpenTutorial
}: TitleScreenProps) {
  const hasAnySave = useMemo(() => {
    const slots = getAllSaveSlots()
    return slots.some(s => s.preview)
  }, [])

  const autosavePreview = useMemo(() => getAutosavePreview(), [])

  return (
    <div className="title-screen paper-bg">
      <BGMFixedButton />
      {/* 6 层背景 */}
      <div className="title-bg-layer title-bg-gradient"></div>
      <div className="title-bg-layer title-bg-texture"></div>
      <div className="title-bg-layer title-bg-ink"></div>
      <div className="title-bg-layer title-bg-image"></div>
      <div className="title-bg-layer title-bg-mountains"></div>
      <div className="title-bg-layer title-bg-vignette"></div>
      <div className="title-ambient-glow"></div>
      <div className="title-ink-stroke-top"></div>
      <div className="title-ink-stroke-bot"></div>

      <div className="title-frame">
        <div className="title-seal">敕</div>
        <h1 className="title-main">崇祯直聘</h1>
        <p className="title-sub">明末官场沉浮模拟器</p>
        <p className="title-tagline">
          天启七年，天启帝驾崩，信王朱由检即位，改元崇祯。<br />
          新帝登基，朝局将变——而你，不过是一个刚刚踏入仕途的年轻人。<br />
          在这乱世之中，你将如何抉择？
        </p>
        <p className="title-quote">
          "你不是在一个稳定王朝里做官，<br />
          你是在一艘正在漏水的船上，努力决定自己要不要继续往上爬。"
        </p>
        <div className="title-buttons">
          <button className="title-btn" onClick={onStart}>
            开 始 仕 途
          </button>

          {hasAnySave && (
            <button className="title-btn" onClick={onOpenLoad}>
              读 取 存 档
            </button>
          )}

          {autosavePreview && (
            <button
              className="title-btn title-btn--autosave"
              onClick={onContinueAutosave}
              title={`自动存档 · ${autosavePreview.playerName} · ${autosavePreview.year}年${autosavePreview.month}月`}
            >
              继 续 游 戏
            </button>
          )}
        </div>
      </div>

      {/* 成就 + 图鉴 + 帮助 */}
      <div className="title-corner-buttons">
        <button className="title-follow-btn" onClick={onOpenAchievements}>
          成 就
        </button>
        <button className="title-follow-btn" onClick={onOpenCodex}>
          局 鉴
        </button>
        <button className="title-follow-btn" onClick={onOpenTutorial}>
          帮 助
        </button>
      </div>

      <p className="title-version-topleft">v0.3.0 Alpha</p>
    </div>
  )
}

export const TitleScreen = memo(TitleScreenImpl)
export default TitleScreen
