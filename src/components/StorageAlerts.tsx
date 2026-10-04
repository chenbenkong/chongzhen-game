import { useStorageAlerts } from '../hooks/useStorageAlerts'
import './StorageAlerts.css'

/**
 * 本地存储故障提示浮层。
 *
 * 由 {@link useStorageAlerts} 驱动，数据源是 save.ts 派发的
 * STORAGE_ERROR_EVENT / STORAGE_READ_ERROR_EVENT。
 * 挂在 App 顶层，所以标题屏与游戏内都会覆盖到 ——
 * "读档失败"恰恰发生在标题屏，此时玩家最需要知道发生了什么。
 *
 * 刻意用非阻塞浮层：不用模态框，避免在推进月份的关键时刻打断操作。
 */
export default function StorageAlerts() {
  const alerts = useStorageAlerts()
  if (alerts.length === 0) return null

  return (
    <div className="storage-alerts" role="status" aria-live="assertive">
      {alerts.map(a => (
        <div key={a.id} className={`storage-alert storage-alert--${a.tone}`}>
          <div className="storage-alert__icon" aria-hidden="true">
            {a.tone === 'error' ? '！' : '？'}
          </div>
          <div className="storage-alert__body">
            <div className="storage-alert__message">{a.message}</div>
            {a.subMessage && <div className="storage-alert__sub">{a.subMessage}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}