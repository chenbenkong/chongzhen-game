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
  const [on, setOn] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(BGM_KEY)
      return saved === null ? true : saved === '1'
    } catch {
      return true
    }
  })
  const [status, setStatus] = useState<BGMCtx['status']>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  // 初始化 audio（整个应用一份单例）
  useEffect(() => {
    // 关键修复：用 import.meta.env.BASE_URL 拼接，兼容 GitHub Pages 子路径部署
    // 不写死 '/' 前缀，否则部署到 https://x.github.io/y/ 时会请求 https://x.github.io/bgm.mp3（404）
    const base = import.meta.env.BASE_URL || '/'
    const src = base.endsWith('/') ? `${base}bgm.mp3` : `${base}/bgm.mp3`

    const a = new Audio()
    a.loop = true
    a.volume = 0.4
    a.preload = 'auto'
    a.src = src
    audioRef.current = a
    setStatus('loading')

    // 成功加载
    const onCanPlay = () => {
      setStatus('ready')
      setErrorMessage('')
    }
    // 加载/解码失败（最常见原因：路径 404 或音频格式不被支持）
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
  useEffect(() => {
    try { localStorage.setItem(BGM_KEY, on ? '1' : '0') } catch {}
    const a = audioRef.current
    if (!a) return
    if (on) {
      const tryPlay = () => {
        a.play().catch(err => {
          // autoplay 被拒 / 资源 404 等
          if (status !== 'error') {
            setErrorMessage(`播放失败：${err?.message || '未知原因'}（可能需要先点击页面任意位置）`)
          }
        })
      }
      tryPlay()
    } else {
      a.pause()
    }
  }, [on, status])

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
