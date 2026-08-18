import { dataKeyId, type DataKey, type DataObserver, type DataProvider, type DataUnsubscribe } from './data-client'

export interface MockDataResourceDefinition<T> {
  readonly key: DataKey<T>
  readonly initial: T
  readonly intervalMs?: number
  readonly update?: (current: T, tick: number) => T
}

interface MockDataResourceRuntime<T> {
  readonly key: DataKey<T>
  value: T
  tick: number
  readonly intervalMs: number | null
  readonly update: ((current: T, tick: number) => T) | null
  readonly observers: Set<DataObserver<T>>
  timer: ReturnType<typeof setInterval> | null
}

export class DuplicateMockDataResourceError extends Error {
  constructor(public readonly resourceId: string) {
    super(`mock data resource ${resourceId} is already registered`)
    this.name = 'DuplicateMockDataResourceError'
  }
}

export class UnknownMockDataResourceError extends Error {
  constructor(public readonly resourceId: string) {
    super(`unknown mock data resource ${resourceId}`)
    this.name = 'UnknownMockDataResourceError'
  }
}

export class MockDataProvider implements DataProvider {
  private readonly resources = new Map<string, MockDataResourceRuntime<unknown>>()

  register<T>(definition: MockDataResourceDefinition<T>): void {
    const resourceId = dataKeyId(definition.key)
    if (this.resources.has(resourceId)) throw new DuplicateMockDataResourceError(resourceId)

    const intervalMs = definition.intervalMs ?? null
    if (intervalMs !== null && (!Number.isFinite(intervalMs) || intervalMs <= 0)) {
      throw new RangeError('mock data intervalMs must be a finite positive number')
    }
    if (intervalMs !== null && !definition.update) {
      throw new TypeError('mock data resources with intervalMs require an update function')
    }

    const runtime: MockDataResourceRuntime<T> = {
      key: definition.key,
      value: definition.initial,
      tick: 0,
      intervalMs,
      update: definition.update ?? null,
      observers: new Set<DataObserver<T>>(),
      timer: null,
    }
    this.resources.set(resourceId, runtime as MockDataResourceRuntime<unknown>)
  }

  subscribe<T>(key: DataKey<T>, observer: DataObserver<T>): DataUnsubscribe {
    const resourceId = dataKeyId(key)
    const runtime = this.resources.get(resourceId) as MockDataResourceRuntime<T> | undefined
    if (!runtime) {
      observer.error(new UnknownMockDataResourceError(resourceId))
      return () => {}
    }

    runtime.observers.add(observer)
    observer.next(runtime.value)
    this.startTimer(runtime)

    let active = true
    return () => {
      if (!active) return
      active = false
      runtime.observers.delete(observer)
      if (runtime.observers.size === 0) this.stopTimer(runtime)
    }
  }

  set<T>(key: DataKey<T>, value: T): void {
    const runtime = this.getRuntime(key)
    runtime.value = value
    this.emitValue(runtime)
  }

  advance<T>(key: DataKey<T>): T {
    const runtime = this.getRuntime(key)
    if (!runtime.update) return runtime.value

    runtime.tick += 1
    runtime.value = runtime.update(runtime.value, runtime.tick)
    this.emitValue(runtime)
    return runtime.value
  }

  fail(key: DataKey, error: unknown): void {
    const runtime = this.getRuntime(key)
    for (const observer of [...runtime.observers]) observer.error(error)
  }

  recover(key: DataKey): void {
    const runtime = this.getRuntime(key)
    for (const observer of [...runtime.observers]) {
      observer.loading()
      observer.next(runtime.value)
    }
  }

  private getRuntime<T>(key: DataKey<T>): MockDataResourceRuntime<T> {
    const resourceId = dataKeyId(key)
    const runtime = this.resources.get(resourceId) as MockDataResourceRuntime<T> | undefined
    if (!runtime) throw new UnknownMockDataResourceError(resourceId)
    return runtime
  }

  private emitValue<T>(runtime: MockDataResourceRuntime<T>): void {
    for (const observer of [...runtime.observers]) observer.next(runtime.value)
  }

  private startTimer<T>(runtime: MockDataResourceRuntime<T>): void {
    if (runtime.timer || runtime.intervalMs === null || !runtime.update || runtime.observers.size === 0) return
    runtime.timer = setInterval(() => this.advance(runtime.key), runtime.intervalMs)
  }

  private stopTimer<T>(runtime: MockDataResourceRuntime<T>): void {
    if (!runtime.timer) return
    clearInterval(runtime.timer)
    runtime.timer = null
  }
}

export function createMockDataProvider(): MockDataProvider {
  return new MockDataProvider()
}
