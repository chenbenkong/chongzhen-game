/**
 * 统一 SVG 图标组件
 * 风格：线描，金色 stroke，仿古铜印/卷轴。
 * 替代原有 emoji，避免不同设备/平台渲染差异。
 *
 * 用法：<Icon name="scroll" size={20} />
 */

import { memo, CSSProperties } from 'react'

export type IconName =
  // 通用
  | 'scroll'      // 卷轴
  | 'check'       // 对勾
  | 'cross'       // 叉号
  | 'warning'     // 警告
  | 'flower'      // 花
  | 'star'        // 实心星
  | 'starOutline' // 空心星
  | 'shuffle'     // 交叉
  | 'pin'         // 图钉
  | 'sparkle'     // 四角星
  | 'sparkleDim'  // 空心四角星
  // 人生时间线
  | 'birth'       // 出生
  | 'exam'        // 考试
  | 'promotion'   // 升
  | 'demotion'    // 降
  | 'document'    // 公文
  | 'sword'       // 剑
  | 'coffin'      // 棺
  | 'marriage'    // 婚姻
  | 'handshake'   // 握手

interface IconProps {
  name: IconName
  size?: number
  className?: string
  /** 覆盖默认色，未传则用 currentColor */
  color?: string
  strokeWidth?: number
  title?: string
  style?: CSSProperties
}

const ICONS: Record<IconName, JSX.Element> = {
  // 卷轴：两条竖线 + 中间卷曲
  scroll: (
    <g>
      <path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M18 8a2 2 0 0 0 0-4" />
      <path d="M6 8a2 2 0 0 1 0-4" />
      <path d="M18 20a2 2 0 0 0 0-4" />
      <path d="M6 20a2 2 0 0 1 0-4" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </g>
  ),
  // 对勾
  check: (
    <polyline points="4 12 10 18 20 6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  // 叉
  cross: (
    <g strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </g>
  ),
  // 警告：三角 + 感叹号
  warning: (
    <g>
      <path d="M12 3 L22 20 L2 20 Z" fill="none" strokeLinejoin="round" />
      <line x1="12" y1="10" x2="12" y2="15" strokeLinecap="round" />
      <circle cx="12" cy="18" r="0.5" fill="currentColor" stroke="none" />
    </g>
  ),
  // 花（四瓣）
  flower: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12 C9 9 6 9 6 12 C6 15 9 15 12 12" />
      <path d="M12 12 C15 9 18 9 18 12 C18 15 15 15 12 12" />
      <path d="M12 12 C9 15 6 15 6 12 C6 9 9 9 12 12" />
      <path d="M12 12 C15 15 18 15 18 12 C18 9 15 9 12 12" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </g>
  ),
  // 实心星
  star: (
    <polygon
      points="12,2 14.6,9.2 22,9.6 16.2,14.4 18.2,22 12,17.8 5.8,22 7.8,14.4 2,9.6 9.4,9.2"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
  ),
  // 空心星
  starOutline: (
    <polygon
      points="12,2 14.6,9.2 22,9.6 16.2,14.4 18.2,22 12,17.8 5.8,22 7.8,14.4 2,9.6 9.4,9.2"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
    />
  ),
  // 双向交叉箭头
  shuffle: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </g>
  ),
  // 图钉
  pin: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 L12 11" />
      <circle cx="12" cy="14" r="2" />
      <path d="M9 14 L8 22 L12 19 L16 22 L15 14" />
    </g>
  ),
  // 四角星
  sparkle: (
    <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" fill="currentColor" />
  ),
  sparkleDim: (
    <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z" fill="none" strokeLinejoin="round" />
  ),
  // 出生：襁褓/葫芦
  birth: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 22 L8 9 C8 6 10 4 12 4 C14 4 16 6 16 9 L16 22" />
      <circle cx="12" cy="11" r="2.5" />
      <path d="M9 22 L15 22" />
    </g>
  ),
  // 考试：卷轴 + 笔
  exam: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5" />
      <line x1="8" y1="9" x2="15" y2="9" />
      <line x1="8" y1="13" x2="15" y2="13" />
      <path d="M16 17 L20 21" />
    </g>
  ),
  // 升：上箭头
  promotion: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="4" />
      <polyline points="5 11 12 4 19 11" />
    </g>
  ),
  // 降：下箭头
  demotion: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="4" x2="12" y2="20" />
      <polyline points="5 13 12 20 19 13" />
    </g>
  ),
  // 公文
  document: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h9l4 4v14H6z" />
      <polyline points="15 3 15 7 19 7" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </g>
  ),
  // 剑
  sword: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <line x1="14" y1="3" x2="14" y2="18" />
      <path d="M11 18 L17 18 L18 21 L10 21 Z" fill="currentColor" />
      <line x1="10" y1="14" x2="18" y2="14" />
    </g>
  ),
  // 棺
  coffin: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3 L15 3 L17 7 L17 17 L15 21 L9 21 L7 17 L7 7 Z" />
      <line x1="10" y1="11" x2="14" y2="11" />
      <line x1="10" y1="15" x2="14" y2="15" />
    </g>
  ),
  // 婚：双环
  marriage: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="14" r="5" />
      <circle cx="15" cy="14" r="5" />
      <line x1="12" y1="4" x2="12" y2="8" />
      <line x1="11" y1="5" x2="13" y2="5" />
    </g>
  ),
  // 握手
  handshake: (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12 L7 8 L11 10 L13 8 L17 10 L21 12" />
      <path d="M3 12 L7 16 L11 14 L13 16 L17 14 L21 12" />
    </g>
  ),
}

function Icon({ name, size = 18, className, color, strokeWidth = 1.5, title, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {ICONS[name]}
    </svg>
  )
}

export default memo(Icon)
