import { useState } from 'react'
import './TutorialModal.css'

interface TutorialModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

const tutorialSteps = [
  {
    title: '欢迎来到明末官场！',
    content: '你是一位刚刚踏入仕途的年轻人，在这个风雨飘摇的时代，你的每一个选择都将影响你的命运。',
    icon: '📜'
  },
  {
    title: '属性系统',
    content: '你的能力由五个属性决定：\n\n💰 财帛 - 财富积累能力\n📚 文韬 - 文化与智慧\n📋 理政 - 政务处理能力\n⚔️ 武略 - 军事与谋略\n❤️ 体质 - 健康状况',
    icon: '📊'
  },
  {
    title: '五方态度',
    content: '除了个人属性，你还需要维护五方关系：\n\n👑 圣眷 - 皇帝的信任\n💬 清议 - 士林舆论\n🤝 中官 - 宦官关系\n🏛️ 士绅 - 地方势力\n❤️ 民望 - 百姓口碑',
    icon: '👥'
  },
  {
    title: '政绩与升官',
    content: '通过做出正确的选择积累政绩分，政绩分达到一定程度时就会升官！\n\n更高的官职意味着更大的权力，但也伴随着更大的风险。',
    icon: '🎯'
  },
  {
    title: '保存进度',
    content: '记得随时保存你的游戏进度！你可以在三个存档槽位中保存不同的游戏历程。\n\n点击右上角的"存档"按钮即可保存。',
    icon: '💾'
  },
  {
    title: '成就系统',
    content: '在游戏过程中完成特定目标可以解锁成就！\n\n在主菜单或游戏内点击"成就"按钮查看你的成就收藏。',
    icon: '🏆'
  },
  {
    title: '准备好了吗？',
    content: '记住，这是一个艰难的时代。每一个决定都需要深思熟虑。\n\n祝你仕途顺利！',
    icon: '🚀'
  }
]

export default function TutorialModal({ isOpen, onClose, onComplete }: TutorialModalProps) {
  const [currentStep, setCurrentStep] = useState(0)

  if (!isOpen) return null

  const currentStepData = tutorialSteps[currentStep]
  const isLastStep = currentStep === tutorialSteps.length - 1

  const handleNext = () => {
    if (isLastStep) {
      onComplete()
    } else {
      setCurrentStep(prev => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-modal">
        <button className="tutorial-close" onClick={onClose}>×</button>
        
        <div className="tutorial-content">
          <div className="tutorial-icon">{currentStepData.icon}</div>
          <h2 className="tutorial-title">{currentStepData.title}</h2>
          <p className="tutorial-text">
            {currentStepData.content.split('\n').map((line, i) => (
              <span key={i}>
                {line}
                {i < currentStepData.content.split('\n').length - 1 && <br />}
              </span>
            ))}
          </p>
        </div>

        <div className="tutorial-progress">
          {tutorialSteps.map((_, i) => (
            <div 
              key={i} 
              className={`progress-dot ${i <= currentStep ? 'active' : ''}`}
            />
          ))}
        </div>

        <div className="tutorial-actions">
          {currentStep > 0 && (
            <button className="tutorial-btn secondary" onClick={handlePrev}>
              上一步
            </button>
          )}
          <button className="tutorial-btn primary" onClick={handleNext}>
            {isLastStep ? '开始游戏' : '下一步'}
          </button>
        </div>

        <div className="tutorial-skip">
          <button onClick={onComplete}>跳过教程</button>
        </div>
      </div>
    </div>
  )
}
