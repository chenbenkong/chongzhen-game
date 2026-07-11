import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const BGM_KEY = 'chongzhen_bgm_on'

interface BGMCtx {
  on: boolean
  toggle: () => void
}

const BGMContext = createContext<BGMCtx | null>(null)

export function useBGM(): BGMCtx {
  const ctx = useContext(BGMContext)
  if (!ctx) throw new Error('useBGM must be used within BGMProvider')
  return ctx
}

export function BGMProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [on, setOn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(BGM_KEY)
      return saved === null ? true : saved === '1'
    } catch {
      return true
    }
  })

  // 初始化 audio（整个应用一份单例）
  useEffect(() => {
    const a = new Audio('/bgm.mp3')
    a.loop = true
    a.volume = 0.4
    a.preload = 'auto'
    audioRef.current = a
    return () => {
      a.pause()
      a.src = ''
    }
  }, [])

  // 同步 on -> play/pause + 持久化
  useEffect(() => {
    try { localStorage.setItem(BGM_KEY, on ? '1' : '0') } catch {}
    const a = audioRef.current
    if (!a) return
    if (on) {
      a.play().catch(() => {
        // 浏览器要求用户交互后才能 autoplay，等首次点击
        const retry = () => {
          a.play().catch(() => {})
          document.removeEventListener('click', retry)
          document.removeEventListener('keydown', retry)
        }
        document.addEventListener('click', retry, { once: true })
        document.addEventListener('keydown', retry, { once: true })
      })
    } else {
      a.pause()
    }
  }, [on])

  const toggle = () => setOn(v => !v)

  return <BGMContext.Provider value={{ on, toggle }}>{children}</BGMContext.Provider>
}
