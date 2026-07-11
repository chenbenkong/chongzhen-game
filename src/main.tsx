import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { setupLongTaskObserver } from './utils/performance'
import './index.css'
import './theme.css'

// 启动性能监控
setupLongTaskObserver()

// 移除加载占位
const removeLoader = (): void => {
  window.dispatchEvent(new Event('app-ready'))
}

// 全局未捕获错误处理
window.addEventListener('error', (e) => {
  console.error('[全局错误]', e.error || e.message)
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('[Promise 未捕获错误]', e.reason)
})

// 防止页面被嵌入 iframe（点击劫持保护）
if (window.self !== window.top && window.top) {
  try {
    window.top.location.href = window.self.location.href
  } catch (e) {
    // 跨域限制
  }
}

// 启动应用
const root = document.getElementById('root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
  // 应用挂载后移除加载占位
  setTimeout(removeLoader, 100)
}
