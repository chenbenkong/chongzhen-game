import { useState, useEffect, useRef, useCallback } from 'react'
import './DiceAnimation.css'

interface DiceAnimationProps {
  isRolling: boolean
  result: number | null
  success: boolean | null
}

// 汉字数字映射
const CHINESE_NUMBERS: Record<number, string> = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六'
}

export default function DiceAnimation({ isRolling, result, success }: DiceAnimationProps) {
  const [showResult, setShowResult] = useState(false)
  const [displayResult, setDisplayResult] = useState<number | null>(null)
  const [shufflingNumber, setShufflingNumber] = useState<number>(1)
  const prevRollingRef = useRef(false)
  const shuffleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 数字跳动动画
  const startShuffling = useCallback(() => {
    // 清除之前的interval
    if (shuffleIntervalRef.current) {
      clearInterval(shuffleIntervalRef.current)
    }
    
    // 开始数字跳动
    shuffleIntervalRef.current = setInterval(() => {
      setShufflingNumber(Math.floor(Math.random() * 6) + 1)
    }, 80) // 每80ms换一个数字
  }, [])

  const stopShuffling = useCallback(() => {
    if (shuffleIntervalRef.current) {
      clearInterval(shuffleIntervalRef.current)
      shuffleIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    // 从滚动状态变为非滚动状态，显示结果
    if (prevRollingRef.current && !isRolling && result !== null) {
      stopShuffling()
      setDisplayResult(result)
      setShufflingNumber(result)
      setShowResult(true)
    }
    
    // 开始滚动
    if (isRolling) {
      setShowResult(false)
      setDisplayResult(null)
      startShuffling()
    }
    
    prevRollingRef.current = isRolling
  }, [isRolling, result, startShuffling, stopShuffling])

  // 清理effect
  useEffect(() => {
    return () => {
      if (shuffleIntervalRef.current) {
        clearInterval(shuffleIntervalRef.current)
      }
    }
  }, [])

  // 滚动中显示跳动的数字，否则显示结果
  const displayChar = isRolling 
    ? CHINESE_NUMBERS[shufflingNumber]
    : (showResult && displayResult !== null 
        ? CHINESE_NUMBERS[displayResult] 
        : '?')

  return (
    <div className="dice-simple-wrapper">
      <div 
        className={`
          dice-box-simple
          ${isRolling ? 'rolling' : ''} 
          ${showResult ? (success ? 'success' : 'fail') : ''}
        `}
      >
        <span className={`dice-char ${isRolling ? 'shuffling' : ''}`}>
          {displayChar}
        </span>
      </div>
    </div>
  )
}
