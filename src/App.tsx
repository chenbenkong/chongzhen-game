import { useState, useEffect, lazy, Suspense } from 'react'
import './App.css'
import NameInput, { NameInputResult } from './components/NameInput'
import OriginSelect from './components/OriginSelect'
import GameScreen from './components/GameScreen'
import SaveNotification from './components/SaveNotification'
import { BGMProvider } from './components/BGMContext'
import { BGMFixedButton } from './components/BGM'
import { OriginType, DegreeType, Attributes } from './types/game'
import { SaveData, getAllSaveSlots, getAutosavePreview, deleteAutosave } from './types/save'
import { origins } from './data/origins'
import { setAchievementData } from './types/achievement'

// 懒加载模态组件
const SaveSlotsModal = lazy(() => import('./components/SaveSlotsModal'))
const AchievementPanel = lazy(() => import('./components/AchievementPanel'))
const EndingCodex = lazy(() => import('./components/EndingCodex'))
const TutorialModal = lazy(() => import('./components/TutorialModal'))

type GamePhase = 'title' | 'name-input' | 'origin-select' | 'playing'

function App() {
  const [phase, setPhase] = useState<GamePhase>('title')
  const [playerName, setPlayerName] = useState('')
  const [playerCourtesyName, setPlayerCourtesyName] = useState('')  // 字
  const [playerHometown, setPlayerHometown] = useState('')          // 籍贯
  const [playerCustomAge, setPlayerCustomAge] = useState<number | null>(null)  // 自定义起始年龄
  const [selectedOrigin, setSelectedOrigin] = useState<OriginType | null>(null)
  const [finalDegree, setFinalDegree] = useState<DegreeType>('进士')
  const [finalAttributes, setFinalAttributes] = useState<Attributes | null>(null)
  const [loadSaveData, setLoadSaveData] = useState<SaveData | null>(null)

  const [hasAnySave, setHasAnySave] = useState(false)
  const [autosavePreview, setAutosavePreview] = useState<ReturnType<typeof getAutosavePreview>>(null)
  
  // 通知弹窗状态
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    message: string;
    subMessage: string;
  }>({ isOpen: false, message: '', subMessage: '' })

  // 存档槽位弹窗状态
  const [isSaveSlotsOpen, setIsSaveSlotsOpen] = useState(false)
  const [saveSlotsMode, setSaveSlotsMode] = useState<'save' | 'load'>('load')

  // 成就面板状态
  const [isAchievementPanelOpen, setIsAchievementPanelOpen] = useState(false)

  // 结局图鉴状态
  const [isCodexOpen, setIsCodexOpen] = useState(false)
  
  // 教程弹窗状态
  const [showTutorial, setShowTutorial] = useState(false)

  useEffect(() => {
    // 刷新存档槽位列表
    const slots = getAllSaveSlots()
    setHasAnySave(slots.some(s => s.preview))
    setAutosavePreview(getAutosavePreview())
  }, [])

  // 监听从 GameScreen 发来的加载存档事件
  useEffect(() => {
    const handleLoadSaveEvent = (e: CustomEvent<SaveData>) => {
      const saveData = e.detail
      if (saveData && saveData.character && saveData.gameState) {
        setLoadSaveData(saveData)
        setSelectedOrigin(saveData.origin || '寒门')
        if (saveData.degree) setFinalDegree(saveData.degree)
        setPhase('playing')
      }
    }

    window.addEventListener('loadSave', handleLoadSaveEvent as EventListener)
    return () => {
      window.removeEventListener('loadSave', handleLoadSaveEvent as EventListener)
    }
  }, [])

  const handleStart = () => {
    setLoadSaveData(null)
    // 新游戏开始时清掉旧的自动存档，避免下次 start 时继承上次的 character/事件进度
    deleteAutosave()
    setAutosavePreview(null)
    setPhase('name-input')
  }

  const handleNameConfirm = (result: NameInputResult) => {
    setPlayerName(result.name)
    setPlayerCourtesyName(result.courtesyName)
    setPlayerHometown(result.hometown)
    setPlayerCustomAge(result.age)
    setPhase('origin-select')
  }

  const handleOriginSelect = (origin: OriginType) => {
    setSelectedOrigin(origin)
    const originData = origins[origin]
    setFinalDegree((originData.initialDegree as DegreeType) || '进士')
    setFinalAttributes(originData.initialAttributes)
    setPhase('playing')
  }

  const handleOpenLoad = () => {
    setSaveSlotsMode('load')
    setIsSaveSlotsOpen(true)
  }

  // 加载自动存档（"继续上次游戏"按钮）
  const handleLoadAutosave = () => {
    const data = getAutosavePreview()
    if (!data) return
    // 重新读取 autosave 原始数据
    const raw = localStorage.getItem('chongzhen_autosave')
    if (!raw) return
    try {
      const saveData = JSON.parse(raw) as SaveData
      if (saveData && saveData.character && saveData.gameState) {
        setLoadSaveData(saveData)
        setSelectedOrigin(saveData.origin || '寒门')
        if (saveData.degree) setFinalDegree(saveData.degree)
        setPhase('playing')
        // 读 autosave 时恢复成就
        setAchievementData(saveData.achievements || { unlocked: [], unlockTimes: {} })
      }
    } catch {
      // ignore
    }
  }

  const handleSelectSaveSlot = (slotId: number) => {
    const slots = getAllSaveSlots()
    const slot = slots.find(s => s.id === slotId)
    if (slot?.data) {
      setLoadSaveData(slot.data)
      setSelectedOrigin(slot.data.origin || '寒门')
      if (slot.data.degree) setFinalDegree(slot.data.degree)
      setIsSaveSlotsOpen(false)
      setPhase('playing')
      // 读槽位存档时恢复成就
      setAchievementData(slot.data.achievements || { unlocked: [], unlockTimes: {} })
    }
  }

  const handleReturnToMenu = () => {
    setLoadSaveData(null)
    setPhase('title')
    // 刷新存档列表
    const slots = getAllSaveSlots()
    setHasAnySave(slots.some(s => s.preview))
    // 刷新自动存档预览
    setAutosavePreview(getAutosavePreview())
  }

  return (
    <BGMProvider>
      <div className="app">
        {phase === 'title' && (
        <div className="title-screen paper-bg">
          <BGMFixedButton />
          {/* 6 层背景 - 完全照搬参考站 */}
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
              <button
                className="title-btn"
                onClick={handleStart}
              >
                开 始 仕 途
              </button>

              {hasAnySave && (
                <button
                  className="title-btn"
                  onClick={handleOpenLoad}
                >
                  读 取 存 档
                </button>
              )}

              {/* 继续游戏（自动存档）- 跟其他按钮并排 */}
              {autosavePreview && (
                <button
                  className="title-btn title-btn--autosave"
                  onClick={handleLoadAutosave}
                  title={`自动存档 · ${autosavePreview.playerName} · ${autosavePreview.year}年${autosavePreview.month}月`}
                >
                  <span className="btn-icon">⏱</span> 继 续 游 戏
                </button>
              )}
            </div>
          </div>

          {/* 成就 + 图鉴 + 帮助 挪到右下角 */}
          <div className="title-corner-buttons">
            <button
              className="title-follow-btn"
              onClick={() => setIsAchievementPanelOpen(true)}
            >
              🏆 成 就
            </button>
            <button
              className="title-follow-btn"
              onClick={() => setIsCodexOpen(true)}
            >
              📖 局 鉴
            </button>
            <button
              className="title-follow-btn"
              onClick={() => setShowTutorial(true)}
            >
              ❓ 帮 助
            </button>
          </div>

          <p className="title-version-topleft">v0.3.0 Alpha</p>
        </div>
      )}
      
      {phase === 'name-input' && (
        <div className="setup-screen">
          <NameInput onConfirm={handleNameConfirm} />
          <div className="setup-actions">
            <button 
              className="back-btn"
              onClick={() => setPhase('title')}
            >
              ← 返回
            </button>
          </div>
        </div>
      )}
      
      {phase === 'origin-select' && (
        <div className="setup-screen">
          <OriginSelect onSelect={handleOriginSelect} />
          <div className="setup-actions">
            <button 
              className="back-btn"
              onClick={() => setPhase('name-input')}
            >
              ← 返回
            </button>
          </div>
        </div>
      )}
      
      {phase === 'playing' && selectedOrigin && (finalAttributes || loadSaveData) && (
        <GameScreen
          origin={selectedOrigin}
          degree={finalDegree || loadSaveData?.character?.degree}
          bonusAttributes={finalAttributes || { 财帛: 0, 文韬: 0, 理政: 0, 武略: 0, 体质: 50 }}
          playerName={playerName || (loadSaveData?.character?.name || '')}
          playerCourtesyName={playerCourtesyName || (loadSaveData?.character?.courtesyName || '')}
          playerHometown={playerHometown || (loadSaveData?.character?.hometown || '')}
          playerCustomAge={playerCustomAge ?? (loadSaveData?.character?.age || null)}
          loadSaveData={loadSaveData ?? undefined}
          difficulty="normal"
          onReturnToMenu={handleReturnToMenu}
        />
      )}
      
      {/* 存档槽位选择弹窗 */}
      <Suspense fallback={null}>
        <SaveSlotsModal
          isOpen={isSaveSlotsOpen}
          mode={saveSlotsMode}
          onSelect={handleSelectSaveSlot}
          onClose={() => setIsSaveSlotsOpen(false)}
        />
      </Suspense>

      {/* 通知弹窗 */}
      <SaveNotification
        isOpen={notification.isOpen}
        onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
        message={notification.message}
        subMessage={notification.subMessage}
      />

      {/* 成就面板 */}
      <Suspense fallback={null}>
        <AchievementPanel
          isOpen={isAchievementPanelOpen}
          onClose={() => setIsAchievementPanelOpen(false)}
        />
      </Suspense>

      <Suspense fallback={null}>
        <EndingCodex
          isOpen={isCodexOpen}
          onClose={() => setIsCodexOpen(false)}
        />
      </Suspense>
      
      {/* 教程弹窗 */}
      <Suspense fallback={null}>
        <TutorialModal
          isOpen={showTutorial}
          onClose={() => setShowTutorial(false)}
          onComplete={() => {
            localStorage.setItem('chongzhen_tutorial_seen', 'true')
            setShowTutorial(false)
          }}
        />
      </Suspense>
    </div>
    </BGMProvider>
  )
}

export default App
