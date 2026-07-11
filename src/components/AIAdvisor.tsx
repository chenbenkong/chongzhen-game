import { useState, useRef, useEffect, useCallback } from 'react'
import { streamChat, getApiKey, setApiKey, hasApiKey, type ChatMessage, type GameContext } from '../services/aiService'
import './AIAdvisor.css'

interface AIAdvisorProps {
  isOpen: boolean
  onClose: () => void
  gameContext: GameContext
}

interface DisplayMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function AIAdvisor({ isOpen, onClose, gameContext }: AIAdvisorProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [error, setError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [keyConfigured, setKeyConfigured] = useState(hasApiKey())
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 自动滚动到底部
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText, scrollToBottom])

  // 打开时检查 API Key
  useEffect(() => {
    if (isOpen && !keyConfigured) {
      setShowSettings(true)
    }
  }, [isOpen, keyConfigured])

  // 保存 API Key
  const handleSaveKey = () => {
    setApiKey(apiKeyInput.trim())
    setKeyConfigured(apiKeyInput.trim().length > 0)
    if (apiKeyInput.trim()) {
      setShowSettings(false)
      setError('')
    }
  }

  // 发送消息
  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || isStreaming) return

    if (!keyConfigured) {
      setShowSettings(true)
      return
    }

    const userMessage: DisplayMessage = { role: 'user', content }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setError('')
    setIsStreaming(true)
    setStreamingText('')

    const chatHistory: ChatMessage[] = newMessages.map(m => ({
      role: m.role,
      content: m.content
    }))

    abortRef.current = new AbortController()

    try {
      let accumulated = ''
      for await (const chunk of streamChat(chatHistory, gameContext, abortRef.current.signal)) {
        accumulated += chunk
        setStreamingText(accumulated)
      }

      setMessages(prev => [...prev, { role: 'assistant', content: accumulated }])
      setStreamingText('')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // 用户取消，保留已生成内容
        if (streamingText) {
          setMessages(prev => [...prev, { role: 'assistant', content: streamingText }])
          setStreamingText('')
        }
      } else {
        const msg = err instanceof Error ? err.message : '请求失败'
        // 友好化常见错误
        let displayMsg = msg
        if (msg.includes('upstream error') || msg.includes('(500)')) {
          displayMsg = 'API 服务暂时繁忙，请稍后重试（已自动重试 3 次）'
        } else if (msg.includes('(401)') || msg.includes('(403)')) {
          displayMsg = 'API Key 无效或已过期，请点击 ⚙ 重新设置'
        } else if (msg.includes('(429)')) {
          displayMsg = '请求过于频繁，请稍候片刻'
        } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          displayMsg = '网络连接失败，请检查网络后重试'
        }
        setError(displayMsg)
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  // 停止生成
  const handleStop = () => {
    abortRef.current?.abort()
  }

  // 快捷提问
  const quickQuestions: string[] = []
  if (gameContext.currentEventTitle) {
    quickQuestions.push('此事件当如何应对？')
    quickQuestions.push('各选项利弊如何？')
  }
  if (gameContext.gameState['圣眷'] < 30) {
    quickQuestions.push('圣眷日衰，如何挽回圣心？')
  }
  if (gameContext.gameState['民望'] < 30) {
    quickQuestions.push('民望不佳，当如何收拢人心？')
  }
  if (gameContext.gameState['国势'] < 30) {
    quickQuestions.push('国势倾颓，大人有何良策？')
  }
  if (quickQuestions.length === 0) {
    quickQuestions.push('当下局势如何？')
    quickQuestions.push('今后当如何筹谋？')
  }

  // 快捷键 Enter 发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <div className="ai-advisor-overlay" onClick={onClose}>
      <div className="ai-advisor-panel" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <div className="ai-header">
          <div className="ai-header-title">
            <span className="ai-header-icon">策</span>
            <span>谋士对谈</span>
          </div>
          <div className="ai-header-actions">
            <button
              className="ai-header-btn"
              onClick={() => setShowSettings(!showSettings)}
              title="设置 API Key"
            >
              ⚙
            </button>
            <button className="ai-header-btn" onClick={onClose} title="关闭">
              ✕
            </button>
          </div>
        </div>

        {/* 设置面板 */}
        {showSettings && (
          <div className="ai-settings">
            <div className="ai-settings-label">Agnes 2.0 Flash API Key</div>
            <div className="ai-settings-input-row">
              <input
                type="password"
                className="ai-settings-input"
                placeholder="sk-..."
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
              />
              <button className="ai-settings-save" onClick={handleSaveKey}>保存</button>
            </div>
            <div className="ai-settings-hint">
              {keyConfigured
                ? '已配置密钥，可正常对谈'
                : '请输入 API Key 后保存。密钥仅存储在本地浏览器中。'}
            </div>
          </div>
        )}

        {/* 消息区 */}
        <div className="ai-messages">
          {messages.length === 0 && !streamingText && (
            <div className="ai-welcome">
              <div className="ai-welcome-icon">策</div>
              <div className="ai-welcome-text">
                {keyConfigured
                  ? `${gameContext.playerName}大人，但有所问，学生知无不言。`
                  : '请先配置 API Key，方可对谈。'}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`ai-msg ${msg.role}`}>
              <div className="ai-msg-avatar">
                {msg.role === 'user' ? gameContext.playerName.charAt(0) || '某' : '策'}
              </div>
              <div className="ai-msg-content">{msg.content}</div>
            </div>
          ))}

          {streamingText && (
            <div className="ai-msg assistant">
              <div className="ai-msg-avatar">策</div>
              <div className="ai-msg-content">
                {streamingText}
                <span className="ai-cursor">▋</span>
              </div>
            </div>
          )}

          {error && (
            <div className="ai-error">{error}</div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 快捷提问 */}
        {!isStreaming && keyConfigured && (
          <div className="ai-quick-questions">
            {quickQuestions.map((q, i) => (
              <button
                key={i}
                className="ai-quick-btn"
                onClick={() => handleSend(q)}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* 输入区 */}
        <div className="ai-input-area">
          <textarea
            ref={inputRef}
            className="ai-input"
            placeholder={keyConfigured ? '询问谋士...' : '请先配置 API Key'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming || !keyConfigured}
            rows={1}
          />
          {isStreaming ? (
            <button className="ai-send-btn stop" onClick={handleStop}>
              停止
            </button>
          ) : (
            <button
              className="ai-send-btn"
              onClick={() => handleSend()}
              disabled={!input.trim() || !keyConfigured}
            >
              发送
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
