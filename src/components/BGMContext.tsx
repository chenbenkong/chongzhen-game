import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

const BGM_KEY = 'chongzhen_bgm_on'

interface BGMCtx {
  on: boolean
  toggle: () => void
  /** 加载状态：'idle' | 'loading' | 'ready' | 'error' */
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** 加载/播放错误信息（用于 UI 提示） */
  errorMessage: string
}

const BGMContext = createContext<BGMCtx | null>(null)

export function useBGM(): BGMCtx {
  const ctx = useContext(BGMContext)
  if (!ctx) throw new Error('useBGM must be used within BGMProvider')
  return ctx
}

export function BGMProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // 默认关，避免浏览器 autoplay 策略导致用户迷惑（以为点不动）
  const [on, setOn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(BGM_KEY)
      // 老用户保留上次选择；新用户默认关
      return saved === '1'
    } catch {
      return false
    }
  })
  const [status, setStatus] = useState<BGMCtx['status']>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  // 初始化 audio（整个应用一份单例）
  useEffect(() => {
    const base = import.meta.env.BASE_URL || '/'
    const src = base.endsWith('/') ? `${base}bgm.mp3` : `${base}/bgm.mp3`

    const a = new Audio()
    a.loop = true
    a.volume = 0.4
    a.preload = 'auto'
    a.src = src
    audioRef.current = a
    setStatus('loading')

    const onCanPlay = () => {
      setStatus('ready')
      setErrorMessage('')
      // 重要：canplay 不再自动 play，等用户点击
    }
    const onError = () => {
      setStatus('error')
      setErrorMessage(`背景音乐加载失败：${src}`)
      // eslint-disable-next-line no-console
      console.error('[BGM] audio error:', { src, code: a.error?.code, message: a.error?.message })
    }
    a.addEventListener('canplay', onCanPlay)
    a.addEventListener('error', onError)

    return () => {
      a.pause()
      a.removeEventListener('canplay', onCanPlay)
      a.removeEventListener('error', onError)
      a.removeAttribute('src')
      a.load()
    }
  }, [])

  // 同步 on -> play/pause + 持久化
  // 关键：依赖项只有 [on]，不能加 status！否则 audio 加载完成时 status 变化会触发 play，
  // 而此时没有用户交互，play() 会被 autoplay 策略拒掉，反而把状态搞乱。
  useEffect(() => {
    try { localStorage.setItem(BGM_KEY, on ? '1' : '0') } catch {}
    const a = audioRef.current
    if (!a) return
    if (on) {
      a.play().catch(err => {
        // autoplay 被拒 / 资源 404 等
        const reason = err?.name === 'NotAllowedError' ? '请先点击页面任意位置' : (err?.message || '未知原因')
        setErrorMessage(`播放未启动：${reason}`)
        // eslint-disable-next-line no-console
        console.warn('[BGM] play() rejected:', err)
      })
    } else {
      a.pause()
      setErrorMessage('')
    }
  }, [on])

  // 一次性：捕获用户首次交互（点击/按键）后，如果 on=true 但音频 paused，重试 play
  useEffect(() => {
    if (!on) return
    const a = audioRef.current
    if (!a) return
    const handler = () => {
      // 触发后，如果还是 paused 状态，尝试再 play
      if (a.paused) {
        a.play().then(() => setErrorMessage('')).catch(err => {
          // eslint-disable-next-line no-console
          console.warn('[BGM] retry after interaction failed:', err)
        })
      }
    }
    // 只监听一次（首次交互）
    document.addEventListener('click', handler, { once: true, capture: true })
    document.addEventListener('keydown', handler, { once: true, capture: true })
    return () => {
      document.removeEventListener('click', handler, { capture: true })
      document.removeEventListener('keydown', handler, { capture: true })
    }
  }, [on])

  const toggle = () => {
    // 如果是错误状态，再次 toggle 触发重试：重新设置 src 强制重新加载
    if (status === 'error' && audioRef.current) {
      const a = audioRef.current
      const base = import.meta.env.BASE_URL || '/'
      const src = base.endsWith('/') ? `${base}bgm.mp3` : `${base}/bgm.mp3`
      a.src = src
      a.load()
      setStatus('loading')
      setErrorMessage('')
    }
    setOn(v => !v)
  }

  return (
    <BGMContext.Provider value={{ on, toggle, status, errorMessage }}>
      {children}
    </BGMContext.Provider>
  )
}
