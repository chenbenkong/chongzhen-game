import { useState, useRef, useEffect, useCallback, memo } from 'react'
import {
  generateImage,
  enhancePrompt,
  hasImageApiKey,
  type ImageSize,
  type ImageRatio,
  type ImageGenResult
} from '../services/imageService'
import './ImageGenerator.css'

interface ImageGeneratorProps {
  isOpen: boolean
  onClose: () => void
  /** 上下文：用于自动生成场景 prompt */
  context: {
    playerName: string
    playerCourtesyName: string
    hometown: string
    age: number
    origin: string
    rank: string
    degree: string
    year: number
    month: number
    currentEventTitle?: string
    currentEventDescription?: string
    currentChoices?: string[]
  }
}

interface HistoryItem {
  id: string
  prompt: string
  url?: string
  b64Json?: string
  size: ImageSize
  ratio: ImageRatio
  createdAt: number
}

const RATIO_PRESETS: { value: ImageRatio; label: string; sub: string }[] = [
  { value: '16:9', label: '横卷', sub: '16:9 场景' },
  { value: '9:16', label: '立轴', sub: '9:16 人物' },
  { value: '1:1', label: '方幅', sub: '1:1 章回' },
  { value: '3:4', label: '肖像', sub: '3:4 立绘' },
  { value: '4:3', label: '宽幅', sub: '4:3 写实' }
]

const SIZE_PRESETS: { value: ImageSize; label: string; sub: string }[] = [
  { value: '1K', label: '1K', sub: '1024' },
  { value: '2K', label: '2K', sub: '2048' },
  { value: '3K', label: '3K', sub: '3072' }
]

/** 历史卡片：memo 化避免图片重新加载 */
const HistoryCard = memo(function HistoryCard({
  item,
  onClick
}: {
  item: HistoryItem
  onClick: () => void
}) {
  const src = item.url || (item.b64Json ? `data:image/png;base64,${item.b64Json}` : '')
  return (
    <div className="ig-history-card" onClick={onClick} title="点击查看">
      <img src={src} alt="生成结果" loading="lazy" />
      <div className="ig-history-meta">
        <span className="ig-history-ratio">{item.ratio}</span>
        <span className="ig-history-time">{new Date(item.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  )
})

export default function ImageGenerator({ isOpen, onClose, context }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState<ImageSize>('2K')
  const [ratio, setRatio] = useState<ImageRatio>('16:9')
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [error, setError] = useState('')
  const [current, setCurrent] = useState<ImageGenResult | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [elapsed, setElapsed] = useState(0)

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<number | null>(null)
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null)

  // 加载状态：每秒更新已耗时
  useEffect(() => {
    if (!isGenerating) {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      setElapsed(0)
      return
    }
    const start = Date.now()
    timerRef.current = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000))
    }, 500)
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isGenerating])

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen) {
      // 稍微延迟让滑入动画完成
      setTimeout(() => promptTextareaRef.current?.focus(), 250)
    }
  }, [isOpen])

  // 快捷 prompt 模板
  const buildQuickPrompt = useCallback((kind: 'event' | 'portrait' | 'court' | 'street') => {
    const name = context.playerName || '某'
    const courtesy = context.playerCourtesyName ? `（字${context.playerCourtesyName}）` : ''
    const era = `崇祯${context.year}年${context.month}月`

    switch (kind) {
      case 'event': {
        const title = context.currentEventTitle || '朝堂议事'
        const desc = context.currentEventDescription || ''
        return `${era}，明末，${title}。${desc}。${name}${context.rank ? `（${context.rank}）` : ''}身处其中，神情凝重，背景含明代官衙、案牍、烛光等元素`
      }
      case 'portrait': {
        return `${era}，${name}${courtesy}，${context.age}岁，${context.origin}出身，${context.degree}功名，明代官员装束（乌纱帽、圆领袍、束带、笏板），端坐于书房或衙署内，神情${context.degree === '进士' ? '儒雅自信' : '沉稳内敛'}，精细面部刻画，明代服饰花纹细节`
      }
      case 'court': {
        return `${era}，紫禁城朝会场景，文武百官列队于太和殿前，崇祯帝高坐龙椅，宦官执拂尘侍立，日光穿透云层，气势恢宏，明代宫廷建筑细节，飞檐斗拱，琉璃瓦当`
      }
      case 'street': {
        const hometown = context.hometown || '江南'
        return `${era}，${hometown}城郭街市，商贩叫卖，行人往来，客栈茶楼林立，远处城墙巍峨，街角有告示榜与算命摊，明代市井生活百态，黄昏暖光，烟火气十足`
      }
    }
  }, [context])

  // 一键填入快捷模板
  const fillTemplate = useCallback((kind: 'event' | 'portrait' | 'court' | 'street') => {
    setPrompt(buildQuickPrompt(kind))
    setError('')
  }, [buildQuickPrompt])

  // 开始生成
  const handleGenerate = useCallback(async () => {
    const text = prompt.trim()
    if (!text || isGenerating) return
    if (!hasImageApiKey()) {
      setError('请先配置 API Key（与"谋士对谈"共用）')
      return
    }

    setIsGenerating(true)
    setError('')
    setCurrent(null)
    setProgressText('正在召唤画师……')

    abortRef.current = new AbortController()

    // 阶段提示
    const phaseTimer = window.setTimeout(() => setProgressText('画师构思构图……'), 8_000)
    const phaseTimer2 = window.setTimeout(() => setProgressText('渲染细节中……'), 25_000)

    try {
      const finalPrompt = enhancePrompt(text, {
        era: `明崇祯${context.year}年${context.month}月`,
        style: '中国工笔重彩与电影级古风写实结合'
      })
      const result = await generateImage(
        { prompt: finalPrompt, size, ratio },
        abortRef.current.signal
      )
      setCurrent(result)
      // 推入历史
      setHistory(prev => [{
        id: `img_${Date.now()}`,
        prompt: text,
        url: result.url,
        b64Json: result.b64Json,
        size,
        ratio,
        createdAt: Date.now()
      }, ...prev].slice(0, 12))  // 保留最近 12 张
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('已取消生成')
      } else {
        const msg = err instanceof Error ? err.message : '生成失败'
        let display = msg
        if (msg.includes('(401)') || msg.includes('(403)')) {
          display = 'API Key 无效或已过期，请点击右上角 ⚙ 重新设置（"谋士"中可设置）'
        } else if (msg.includes('(429)')) {
          display = '请求过于频繁，请稍候片刻'
        } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          display = '网络连接失败，请检查网络后重试'
        } else if (msg.includes('超时')) {
          display = '图像生成超时（120s），请稍后重试或降低清晰度'
        }
        setError(display)
      }
    } finally {
      window.clearTimeout(phaseTimer)
      window.clearTimeout(phaseTimer2)
      setIsGenerating(false)
      setProgressText('')
      abortRef.current = null
    }
  }, [prompt, isGenerating, size, ratio, context.year, context.month])

  // 取消生成
  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // 重新生成
  const handleRedo = useCallback(() => {
    handleGenerate()
  }, [handleGenerate])

  // 下载当前图片
  const handleDownload = useCallback(() => {
    if (!current) return
    const src = current.url || (current.b64Json ? `data:image/png;base64,${current.b64Json}` : '')
    if (!src) return
    const a = document.createElement('a')
    a.href = src
    a.download = `崇祯丹青_${Date.now()}.png`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [current])

  // 从历史回看
  const recallFromHistory = useCallback((item: HistoryItem) => {
    setCurrent({ url: item.url, b64Json: item.b64Json })
  }, [])

  if (!isOpen) return null

  const currentSrc = current
    ? (current.url || (current.b64Json ? `data:image/png;base64,${current.b64Json}` : ''))
    : ''

  return (
    <div className="ig-overlay" onClick={onClose}>
      <div className="ig-panel" onClick={e => e.stopPropagation()}>
        <div className="ig-header">
          <div className="ig-header-title">
            <span className="ig-header-icon">绘</span>
            <span>丹青画卷</span>
          </div>
          <div className="ig-header-actions">
            <button className="ig-header-btn" onClick={onClose} title="关闭">
              ✕
            </button>
          </div>
        </div>

        <div className="ig-body">
          {/* 输入区 */}
          <div className="ig-input-section">
            <div className="ig-label">场景描绘</div>
            <textarea
              ref={promptTextareaRef}
              className="ig-prompt-input"
              placeholder="例：崇祯元年元宵夜，金陵秦淮河畔灯火通明，画舫穿梭其间，士子佳人凭栏远望……"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={isGenerating}
              rows={3}
            />
            <div className="ig-template-row">
              <span className="ig-template-label">模板：</span>
              {context.currentEventTitle && (
                <button className="ig-template-btn" onClick={() => fillTemplate('event')} disabled={isGenerating}>
                  当前事件
                </button>
              )}
              <button className="ig-template-btn" onClick={() => fillTemplate('portrait')} disabled={isGenerating}>
                角色立绘
              </button>
              <button className="ig-template-btn" onClick={() => fillTemplate('court')} disabled={isGenerating}>
                紫禁朝会
              </button>
              <button className="ig-template-btn" onClick={() => fillTemplate('street')} disabled={isGenerating}>
                街头巷陌
              </button>
            </div>

            {/* 比例 + 尺寸 */}
            <div className="ig-options">
              <div className="ig-option-group">
                <div className="ig-option-label">画幅</div>
                <div className="ig-ratio-row">
                  {RATIO_PRESETS.map(p => (
                    <button
                      key={p.value}
                      className={`ig-ratio-btn ${ratio === p.value ? 'active' : ''}`}
                      onClick={() => setRatio(p.value)}
                      disabled={isGenerating}
                    >
                      <span className="ig-ratio-label">{p.label}</span>
                      <span className="ig-ratio-sub">{p.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="ig-option-group">
                <div className="ig-option-label">清晰度</div>
                <div className="ig-size-row">
                  {SIZE_PRESETS.map(s => (
                    <button
                      key={s.value}
                      className={`ig-size-btn ${size === s.value ? 'active' : ''}`}
                      onClick={() => setSize(s.value)}
                      disabled={isGenerating}
                    >
                      <span className="ig-size-label">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && <div className="ig-error">{error}</div>}

            {/* 生成按钮 */}
            <div className="ig-action-row">
              {isGenerating ? (
                <button className="ig-generate-btn stop" onClick={handleCancel}>
                  停止生成 · {elapsed}s
                </button>
              ) : (
                <button
                  className="ig-generate-btn"
                  onClick={handleGenerate}
                  disabled={!prompt.trim()}
                >
                  <span className="ig-generate-icon">✦</span>
                  <span>落笔生花</span>
                </button>
              )}
            </div>
          </div>

          {/* 展示区 */}
          <div className="ig-display-section">
            {isGenerating ? (
              <div className="ig-loading">
                <div className="ig-loading-icon">
                  <span className="ig-loading-brush">笔</span>
                </div>
                <div className="ig-loading-text">{progressText}</div>
                <div className="ig-loading-hint">
                  图像生成需 30-120 秒，请耐心等候
                </div>
                <div className="ig-loading-bar">
                  <div className="ig-loading-bar-inner" />
                </div>
              </div>
            ) : current ? (
              <div className="ig-result">
                <div className="ig-result-image-wrap">
                  <img className="ig-result-image" src={currentSrc} alt="AI 生成的明末场景" />
                </div>
                <div className="ig-result-actions">
                  <button className="ig-result-btn" onClick={handleRedo} disabled={!prompt.trim()}>
                    <span>↻</span> 重画一张
                  </button>
                  <button className="ig-result-btn primary" onClick={handleDownload}>
                    <span>↓</span> 保存到本地
                  </button>
                </div>
              </div>
            ) : (
              <div className="ig-empty">
                <div className="ig-empty-icon">绘</div>
                <div className="ig-empty-text">
                  输入场景描述，或选择下方模板
                  <br />
                  画师将依你之言，落笔生花
                </div>
                <div className="ig-empty-tip">
                  提示：详细描述人物、地点、时间、动作、氛围，生成效果更佳
                </div>
              </div>
            )}
          </div>

          {/* 历史记录 */}
          {history.length > 0 && (
            <div className="ig-history-section">
              <div className="ig-history-label">卷轴阁 · 本次会话</div>
              <div className="ig-history-grid">
                {history.map(item => (
                  <HistoryCard key={item.id} item={item} onClick={() => recallFromHistory(item)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
