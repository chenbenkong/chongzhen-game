import { Component, ErrorInfo, ReactNode } from 'react'
import './ErrorBoundary.css'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('【游戏错误捕获】', error, errorInfo)
    this.setState({ errorInfo })
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      }
      const logs = JSON.parse(localStorage.getItem('chongzhen_error_logs') || '[]')
      logs.push(errorLog)
      if (logs.length > 10) logs.shift()
      localStorage.setItem('chongzhen_error_logs', JSON.stringify(logs))
    } catch (e) {}
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleClearSave = (): void => {
    if (window.confirm('确定要清除所有游戏存档吗？此操作不可恢复。')) {
      try {
        localStorage.removeItem('chongzhen_save')
        localStorage.removeItem('chongzhen_error_logs')
        window.location.reload()
      } catch (e) {
        window.location.reload()
      }
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-container">
            <div className="error-icon">!</div>
            <h1 className="error-title">游戏遇到了一些问题</h1>
            <p className="error-message">{this.state.error?.message || '未知错误'}</p>
            <details className="error-details">
              <summary>查看技术详情</summary>
              <pre>{this.state.error?.stack}</pre>
              {this.state.errorInfo && <pre>{this.state.errorInfo.componentStack}</pre>}
            </details>
            <div className="error-actions">
              <button className="error-btn primary" onClick={this.handleReset}>继续游戏</button>
              <button className="error-btn" onClick={() => window.location.reload()}>重新加载</button>
              <button className="error-btn danger" onClick={this.handleClearSave}>清除存档</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
