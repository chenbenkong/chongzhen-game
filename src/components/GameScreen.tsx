import { lazy, Suspense, memo, useMemo } from 'react'
import { OriginType, DegreeType, Attributes } from '../types/game'
import { SaveData } from '../types/save'
import { DifficultyLevel } from '../types/difficulty'
import { useGameEngine, RANKS } from '../hooks/useGameEngine'
import StatusBar from './StatusBar'
import AttributePanel from './AttributePanel'
import StatusPanel from './StatusPanel'
import EventDisplay from './EventDisplay'
import ActionBar from './ActionBar'
import GameOverScreen from './GameOverScreen'
import CheatMode from './CheatMode'
import LifeReview from './LifeReview'
import DeathEnding from './DeathEnding'
import SaveNotification from './SaveNotification'
import SaveSlotsModal from './SaveSlotsModal'

import AchievementPanel from './AchievementPanel'
import TutorialModal from './TutorialModal'
import StorylineBar from './StorylineBar'
import ResignConfirmDialog from './ResignConfirmDialog'

import './GameScreen.css'

const AIAdvisor = lazy(() => import('./AIAdvisor'))
const ImageGenerator = lazy(() => import('./ImageGenerator'))

interface GameScreenProps {
  origin: OriginType
  degree: DegreeType
  bonusAttributes: Attributes
  playerName?: string
  playerCourtesyName?: string
  playerHometown?: string
  playerCustomAge?: number | null
  loadSaveData?: SaveData
  difficulty: DifficultyLevel
  onReturnToMenu?: () => void
}

function GameScreen(props: GameScreenProps) {
  const {
    character,
    gameState,
    currentEvent,
    pendingEvents,
    eventHistory,
    undoHistory,
    meritScore,
    promotionMessage,
    identityType,
    isGameOver,
    saveNotification,
    resignConfirmModal,
    isCheatModeOpen,
    isSaveSlotsOpen,
    saveSlotsMode,
    isAchievementPanelOpen,
    showTutorial,
    showHelp,
    showAIAdvisor,
    showImageGenerator,
    lifeRecords,
    isLifeReviewOpen,
    deathEndingState,
    biography,
    isProcessing,
    openCheatMode,
    closeCheatMode,
    openAchievementPanel,
    closeAchievementPanel,
    openHelp,
    closeHelp,
    openAIAdvisor,
    closeAIAdvisor,
    openImageGenerator,
    closeImageGenerator,
    openLifeReview,
    closeLifeReview,
    closeTutorial,
    completeTutorial,
    closeSaveNotification,
    closeSaveSlots,
    closeDeathEnding,
    handleChoice,
    handleNextMonth,
    handleContinue,
    handleUndo,
    handleSave,
    handleSaveToSlot,
    handleLoadFromSlot,
    handleLoadAutosave,
    handleRestart,
    handleReturnToMenu,
    handleGameOver,
    handleDeathEnding,
    confirmResign,
    cancelResign,
    getCurrentStoryline,
    generateLifeSummary
  } = useGameEngine(props)

  const currentStorylineKey = useMemo(() => getCurrentStoryline(), [getCurrentStoryline])

  const saveSlotsCurrentData = useMemo(() => ({
    name: character.name || '无名氏',
    year: gameState.currentYear,
    month: gameState.currentMonth,
    rank: character.rank,
    title: identityType === 'official' ? '官员' : identityType === 'civilian' ? '平民' : '其他'
  }), [character.name, character.rank, gameState.currentYear, gameState.currentMonth, identityType])

  const aiAdvisorContext = useMemo(() => ({
    year: gameState.currentYear,
    month: gameState.currentMonth,
    turn: gameState.turn,
    playerName: character.name || '某',
    courtesyName: character.courtesyName || '',
    hometown: character.hometown || '',
    age: character.age,
    origin: character.origin,
    rank: character.rank,
    degree: character.degree,
    attributes: { ...character.attributes },
    hidden: { ...character.hidden },
    gameState: {
      圣眷: gameState.圣眷,
      中官: gameState.中官,
      清议: gameState.清议,
      士绅: gameState.士绅,
      民望: gameState.民望,
      国势: gameState.国势
    },
    currentEventTitle: currentEvent?.title,
    currentEventDescription: currentEvent?.description,
    currentChoices: currentEvent?.choices?.map(c => c.text),
    recentRecords: lifeRecords.slice(-5).map(r => `崇祯${r.year}年${r.month}月：${r.title}`)
  }), [character, gameState, currentEvent, lifeRecords])

  const imageGeneratorContext = useMemo(() => ({
    playerName: character.name || '某',
    playerCourtesyName: character.courtesyName || '',
    hometown: character.hometown || '',
    age: character.age,
    origin: character.origin,
    rank: character.rank,
    degree: character.degree,
    year: gameState.currentYear,
    month: gameState.currentMonth,
    currentEventId: currentEvent?.id,
    currentEventTitle: currentEvent?.title,
    currentEventDescription: currentEvent?.description,
    currentChoices: currentEvent?.choices?.map(c => c.text)
  }), [character, gameState.currentYear, gameState.currentMonth, currentEvent])

  const lifeSummary = useMemo(() => generateLifeSummary(), [generateLifeSummary])

  const identityPanelClass = `identity-panel identity-panel--${
    identityType === 'official' ? 'official' :
    identityType === 'rebel' ? 'rebel' :
    identityType === 'exiled' ? 'exiled' : 'other'
  }`

  const identityTitle = identityType === 'official' ? '官 职' :
    identityType === 'rebel' ? '反 贼 身 份' :
    identityType === 'exiled' ? '罪 臣 身 份' :
    identityType === 'retired' ? '归 隐 身 份' : '民 间 身 份'

  const identityDesc = identityType === 'official'
    ? `朝廷命官，当前政绩分${meritScore}，下一级需${RANKS.find(r => r.minScore > meritScore)?.minScore || '已达最高'}分`
    : identityType === 'rebel'
    ? '占山为王，与朝廷为敌'
    : identityType === 'exiled'
    ? '革职查办，待罪之身'
    : identityType === 'retired'
    ? '辞官归隐，不问世事'
    : '一介布衣，无权无势'

  return (
    <div className="game-screen">
      {isGameOver && (
        <GameOverScreen
          endingEvent={currentEvent}
          character={character}
          gameState={gameState}
          biography={biography}
          onRestart={handleRestart}
          onReturnToMenu={handleReturnToMenu}
          onViewLifeReview={openLifeReview}
        />
      )}

      {promotionMessage && (
        <div className={`promotion-toast ${promotionMessage.includes('恭喜') ? 'promotion-toast--promote' : 'promotion-toast--demote'}`}>
          {promotionMessage}
        </div>
      )}

      <StatusBar
        character={character}
        gameState={gameState}
        degree={props.degree}
        onCheatClick={openCheatMode}
      />

      <StorylineBar
        currentStorylineKey={currentStorylineKey}
        eventCount={eventHistory.length}
      />

      <CheatMode
        isOpen={isCheatModeOpen}
        onClose={closeCheatMode}
        currentGameState={{
          currentYear: gameState.currentYear,
          currentMonth: gameState.currentMonth,
          turn: 0,
          eventHistory: []
        }}
        currentCharacter={character}
        currentGameStateValues={gameState}
      />

      <div className="game-main">
        <aside className="sidebar">
          <AttributePanel
            attributes={character.attributes}
            hidden={character.hidden}
          />

          <div className={identityPanelClass}>
            <h4>{identityTitle}</h4>
            <div className="identity-rank">
              {character.rank}
            </div>
            <div className="identity-desc">
              {identityDesc}
            </div>
          </div>
        </aside>

        <main className="main-content">
          <EventDisplay
            event={currentEvent}
            character={character}
            gameState={gameState}
            onChoice={handleChoice}
            onContinue={handleContinue}
            onUndo={handleUndo}
            onGameOver={handleGameOver}
            onDeathEnding={handleDeathEnding}
            onGenerateImageForEvent={openImageGenerator}
            canUndo={undoHistory.length > 0}
            isProcessing={isProcessing}
            pendingCount={pendingEvents.length}
          />
        </main>

        <aside className="right-sidebar">
          <StatusPanel gameState={gameState} />

          {identityType === 'official' && (
            <div className="merit-panel">
              <h4>政 绩 评 定</h4>
              <div className="merit-score-row">
                <span className="merit-score-label">当前政绩分</span>
                <span className="merit-score-value">{meritScore}</span>
              </div>
              <div className="merit-bar-track">
                <div className="merit-bar-fill" style={{ width: `${Math.min(100, (meritScore / 1100) * 100)}%` }} />
              </div>
              <div className="merit-next">
                下一级需: {RANKS.find(r => r.minScore > meritScore)?.minScore || '已达最高'} 分
              </div>
            </div>
          )}
        </aside>
      </div>

      <ActionBar
        onNextMonth={handleNextMonth}
        onSave={handleSave}
        onOpenAchievements={openAchievementPanel}
        onOpenHelp={openHelp}
        onOpenAIAdvisor={openAIAdvisor}
        onOpenImageGenerator={openImageGenerator}
        onReturnToMenu={handleReturnToMenu}
        turn={gameState.turn}
        canProceed={!currentEvent || isProcessing}
      />

      <ResignConfirmDialog
        open={resignConfirmModal.isOpen}
        choice={resignConfirmModal.choice}
        onConfirm={confirmResign}
        onCancel={cancelResign}
      />

      <DeathEnding
        isOpen={deathEndingState.show}
        endingType={deathEndingState.type}
        title={deathEndingState.title}
        description={deathEndingState.description}
        echo={deathEndingState.echo}
        tags={deathEndingState.tags}
        onClose={() => {
          closeDeathEnding()
          openLifeReview()
        }}
        onRestart={handleRestart}
      />

      <LifeReview
        isOpen={isLifeReviewOpen}
        lifeRecords={lifeRecords}
        lifeSummary={lifeSummary}
        character={character}
        finalGameState={gameState}
        endingEvent={currentEvent ?? undefined}
        onClose={closeLifeReview}
        onRestart={handleRestart}
      />

      <SaveNotification
        isOpen={saveNotification.isOpen}
        onClose={closeSaveNotification}
        message={saveNotification.message}
        subMessage={saveNotification.subMessage}
      />

      <SaveSlotsModal
        isOpen={isSaveSlotsOpen}
        mode={saveSlotsMode}
        currentData={saveSlotsCurrentData}
        onSelect={saveSlotsMode === 'save' ? handleSaveToSlot : handleLoadFromSlot}
        onLoadAutosave={handleLoadAutosave}
        onClose={closeSaveSlots}
      />

      <AchievementPanel
        isOpen={isAchievementPanelOpen}
        onClose={closeAchievementPanel}
      />

      <TutorialModal
        isOpen={showTutorial}
        onClose={closeTutorial}
        onComplete={completeTutorial}
      />

      <TutorialModal
        isOpen={showHelp}
        onClose={closeHelp}
        onComplete={closeHelp}
      />

      <Suspense fallback={null}>
        <AIAdvisor
          isOpen={showAIAdvisor}
          onClose={closeAIAdvisor}
          gameContext={aiAdvisorContext}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ImageGenerator
          isOpen={showImageGenerator}
          onClose={closeImageGenerator}
          context={imageGeneratorContext}
        />
      </Suspense>
    </div>
  )
}

export default memo(GameScreen)
