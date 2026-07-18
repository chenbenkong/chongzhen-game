import { useState, useEffect, lazy, Suspense, useCallback } from 'react'
import './App.css'
import NameInput, { NameInputResult } from './components/NameInput'
import OriginSelect from './components/OriginSelect'
import TitleScreen from './components/TitleScreen'
import GameScreen from './components/GameScreen'
import SaveNotification from './components/SaveNotification'
import { BGMProvider } from './components/BGMContext'
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

  const handleStart = useCallback(() => {
    setLoadSaveData(null)
    // 新游戏开始时清掉旧的自动存档，避免下次 start 时继承上次的 character/事件进度
    deleteAutosave()
    setPhase('name-input')
  }, [])

  const handleNameConfirm = useCallback((result: NameInputResult) => {
    setPlayerName(result.name)
    setPlayerCourtesyName(result.courtesyName)
    setPlayerHometown(result.hometown)
    setPlayerCustomAge(result.age)
    setPhase('origin-select')
  }, [])

  const handleOriginSelect = useCallback((origin: OriginType) => {
    setSelectedOrigin(origin)
    const originData = origins[origin]
    setFinalDegree((originData.initialDegree as DegreeType) || '进士')
    setFinalAttributes(originData.initialAttributes)
    setPhase('playing')
  }, [])

  const handleOpenLoad = useCallback(() => {
    setSaveSlotsMode('load')
    setIsSaveSlotsOpen(true)
  }, [])

  // 加载自动存档（"继续上次游戏"按钮）
  const handleLoadAutosave = useCallback(() => {
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
  }, [])

  const handleSelectSaveSlot = useCallback((slotId: number) => {
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
  }, [])

  const handleReturnToMenu = useCallback(() => {
    setLoadSaveData(null)
    setPhase('title')
  }, [])

  return (
    <BGMProvider>
      <div className="app">
        {phase === 'title' && (
          <TitleScreen
            onStart={handleStart}
            onContinueAutosave={handleLoadAutosave}
            onOpenLoad={handleOpenLoad}
            onOpenAchievements={() => setIsAchievementPanelOpen(true)}
            onOpenCodex={() => setIsCodexOpen(true)}
            onOpenTutorial={() => setShowTutorial(true)}
            loadSaveData={loadSaveData ?? undefined}
          />
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
