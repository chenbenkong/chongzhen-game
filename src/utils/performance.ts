// 长任务检测
export function setupLongTaskObserver(): void {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn(`[长任务] ${entry.duration.toFixed(0)}ms`)
        }
      }
    })
    observer.observe({ entryTypes: ['longtask'] })
  } catch (e) {}
}
