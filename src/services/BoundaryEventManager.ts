import { BoundaryEvent, BoundaryEventCheckParams, BoundaryEventRegistry } from '../types/boundaryEvent'

export class BoundaryEventManager {
  private events: BoundaryEventRegistry = {}

  register(event: BoundaryEvent): void {
    this.events[event.id] = event
  }

  registerBatch(events: BoundaryEvent[]): void {
    events.forEach(event => this.register(event))
  }

  check(params: BoundaryEventCheckParams): BoundaryEvent | null {
    const sortedEvents = Object.values(this.events)
      .sort((a, b) => a.priority - b.priority)

    for (const event of sortedEvents) {
      if (event.check(params)) {
        return event
      }
    }
    return null
  }

  checkByType(params: BoundaryEventCheckParams, type: 'ending' | 'crisis'): BoundaryEvent | null {
    const sortedEvents = Object.values(this.events)
      .filter(event => event.type === type)
      .sort((a, b) => a.priority - b.priority)

    for (const event of sortedEvents) {
      if (event.check(params)) {
        return event
      }
    }
    return null
  }

  getAll(): BoundaryEventRegistry {
    return { ...this.events }
  }

  get(id: string): BoundaryEvent | undefined {
    return this.events[id]
  }
}

export const boundaryEventManager = new BoundaryEventManager()
