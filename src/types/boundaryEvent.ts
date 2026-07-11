import { GameEvent } from './event'
import { FactionState } from './game'

export interface BoundaryEventCheckParams {
  attributes: Record<string, number>
  gameState?: Record<string, number>
  hidden?: Record<string, number>
  faction?: FactionState
  flags?: string[]
}

export interface BoundaryEvent {
  id: string
  priority: number
  check: (params: BoundaryEventCheckParams) => boolean
  event: GameEvent
  type: 'ending' | 'crisis'
}

export type BoundaryEventRegistry = Record<string, BoundaryEvent>
