import { useEffect, useState } from 'react'
import {
  getAllAchievements,
  Achievement,
  ALL_ACHIEVEMENTS
} from '../types/achievement'
import './AchievementPanel.css'

interface AchievementPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function AchievementPanel({ isOpen, onClose }: AchievementPanelProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all')

  useEffect(() => {
    if (isOpen) {
      refreshAchievements()
    }
  }, [isOpen])

  const refreshAchievements = () => {
    setAchievements(getAllAchievements())
  }

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      career: '仕途',
      attribute: '属性',
      relationship: '关系',
      endgame: '结局',
      special: '特殊'
    }
    return names[category] || category
  }

  const filteredAchievements = achievements.filter(a => {
    if (filter === 'unlocked') return a.unlocked
    if (filter === 'locked') return !a.unlocked
    return true
  })

  const groupedAchievements = filteredAchievements.reduce((acc, a) => {
    const category = getCategoryName(a.category)
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(a)
    return acc
  }, {} as Record<string, Achievement[]>)

  const unlockedCount = achievements.filter(a => a.unlocked).length
  const totalCount = ALL_ACHIEVEMENTS.length

  const formatUnlockTime = (time?: string) => {
    if (!time) return ''
    const date = new Date(time)
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className={`achievement-panel-overlay ${isOpen ? 'visible' : ''}`} onClick={onClose}>
      <div className="achievement-panel" onClick={e => e.stopPropagation()}>
        <div className="achievement-panel-header">
          <h2>🏆 成就系统</h2>
          <div className="achievement-stats">
            已解锁: <span className="highlight">{unlockedCount}/{totalCount}</span>
          </div>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="achievement-filters">
          <button
            className={`filter-button ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            全部
          </button>
          <button
            className={`filter-button ${filter === 'unlocked' ? 'active' : ''}`}
            onClick={() => setFilter('unlocked')}
          >
            已解锁
          </button>
          <button
            className={`filter-button ${filter === 'locked' ? 'active' : ''}`}
            onClick={() => setFilter('locked')}
          >
            未解锁
          </button>
        </div>

        <div className="achievement-list">
          {Object.keys(groupedAchievements).map(category => (
            <div key={category} className="achievement-category">
              <h3 className="category-title">{category}</h3>
              <div className="category-achievements">
                {groupedAchievements[category].map(achievement => (
                  <div
                    key={achievement.id}
                    className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}
                  >
                    <div className="card-icon">{achievement.icon}</div>
                    <div className="card-content">
                      <div className="card-name">{achievement.name}</div>
                      <div className="card-description">{achievement.description}</div>
                      {achievement.unlocked && achievement.unlockTime && (
                        <div className="card-time">
                          {formatUnlockTime(achievement.unlockTime)}
                        </div>
                      )}
                      {!achievement.unlocked && (
                        <div className="card-locked">🔒 未解锁</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {Object.keys(groupedAchievements).length === 0 && (
            <div className="empty-state">
              没有符合条件的成就
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
