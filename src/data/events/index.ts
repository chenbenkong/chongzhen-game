import { GameEvent } from '../../types/event'
import { events1628 as historical1628 } from './historical/1628'
import { events1629 as historical1629 } from './historical/1629'
import { events1630 as historical1630 } from './historical/1630'
import { events1631 as historical1631 } from './historical/1631'
import { events1632 as historical1632 } from './historical/1632'
import { events1633 as historical1633 } from './historical/1633'
import { events1634 as historical1634 } from './historical/1634'
import { events1635 as historical1635 } from './historical/1635'
import { events1636 as historical1636 } from './historical/1636'
import { events1637 as historical1637 } from './historical/1637'
import { events1638 as historical1638 } from './historical/1638'
import { events1639 as historical1639 } from './historical/1639'
import { events1640 as historical1640 } from './historical/1640'
import { events1641 as historical1641 } from './historical/1641'
import { events1642 as historical1642 } from './historical/1642'
import { events1643 as historical1643 } from './historical/1643'
import { events1644 as historical1644 } from './historical/1644'
import { figuresEvents as historicalFigures } from './historical/figures'
import { events1628 as transition1628 } from './transition/1628'
import { events1629 as transition1629 } from './transition/1629'
import { events1630 as transition1630 } from './transition/1630'
import { events1631 as transition1631 } from './transition/1631'
import { events1632 as transition1632 } from './transition/1632'
import { events1633 as transition1633 } from './transition/1633'
import { events1634 as transition1634 } from './transition/1634'
import { events1635 as transition1635 } from './transition/1635'
import { events1636 as transition1636 } from './transition/1636'
import { events1637 as transition1637 } from './transition/1637'
import { events1638 as transition1638 } from './transition/1638'
import { events1639 as transition1639 } from './transition/1639'
import { events1640 as transition1640 } from './transition/1640'
import { events1641 as transition1641 } from './transition/1641'
import { events1642 as transition1642 } from './transition/1642'
import { events1643 as transition1643 } from './transition/1643'
import { events1643 as transition1643b } from './transition/1643b'
import { events1644_critical as transition1644Critical } from './transition/1644_critical'
import { eventsRouteGuide as routeGuideEvents } from './transition/route_guide'
import { preludeEvents as transitionPreludes } from './transition/preludes'
import { allGrayChoiceEvents } from './gray'
import { allEndingEvents } from './ending'
import { allEmotionEvents as emotionEvents } from './emotion'
import { originEvents } from './origin'

export const historicalEvents: GameEvent[] = [
  ...historical1628,
  ...historical1629,
  ...historical1630,
  ...historical1631,
  ...historical1632,
  ...historical1633,
  ...historical1634,
  ...historical1635,
  ...historical1636,
  ...historical1637,
  ...historical1638,
  ...historical1639,
  ...historical1640,
  ...historical1641,
  ...historical1642,
  ...historical1643,
  ...historical1644,
  ...historicalFigures
];

export const transitionEvents: GameEvent[] = [
  ...transition1628,
  ...transition1629,
  ...transition1630,
  ...transition1631,
  ...transition1632,
  ...transition1633,
  ...transition1634,
  ...transition1635,
  ...transition1636,
  ...transition1637,
  ...transition1638,
  ...transition1639,
  ...transition1640,
  ...transition1641,
  ...transition1642,
  ...transition1643,
  ...transition1643b,
  ...transition1644Critical,
  ...routeGuideEvents,
  ...transitionPreludes
];

// 随机/支线事件池（结局不在这里 — 结局由 BoundaryEventManager 统一触发）
export const initialEvents: GameEvent[] = [
  ...historicalEvents,
  ...transitionEvents,
  ...emotionEvents,
  ...originEvents
];

// 灰色支线（type='gray'，会进入 findAvailableEvent 走"30% 支线触发窗口"）
export { allGrayChoiceEvents };

// 全部结局（仅用于 EndingCodex / CheatMode 展示/筛选，**不**进入 findAvailableEvent 事件池）
// 真实触发由 BoundaryEventManager 负责（见 data/boundaryEvents.ts）
export { allEndingEvents };

export { emotionEvents };
