import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { observeElementSize } from '../src/vue/observe-element-size'

class FakeResizeObserver {
  static current: FakeResizeObserver | null = null
  disconnected = false
  private readonly callback: ResizeObserverCallback

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    FakeResizeObserver.current = this
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void { this.disconnected = true }

  emit(target: Element, width: number, height: number): void {
    const entry = {
      target,
      contentRect: { width, height },
    } as ResizeObserverEntry
    this.callback([entry], this as unknown as ResizeObserver)
  }
}

const originalResizeObserver = globalThis.ResizeObserver

beforeEach(() => {
  FakeResizeObserver.current = null
  globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver
})

afterEach(() => {
  globalThis.ResizeObserver = originalResizeObserver
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('observeElementSize', () => {
  it('rounds and deduplicates measurements, ignores hidden/detached elements and cleans up', () => {
    const element = document.createElement('div')
    document.body.appendChild(element)
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ width: 100.4, height: 50.4 } as DOMRect)

    const sizes: Array<{ width: number; height: number }> = []
    const dispose = observeElementSize(element, (size) => sizes.push(size))
    const observer = FakeResizeObserver.current
    expect(observer).not.toBeNull()

    observer?.emit(element, 100.49, 50.49)
    observer?.emit(element, 100.6, 50.4)
    expect(sizes).toEqual([
      { width: 100, height: 50 },
      { width: 101, height: 50 },
    ])

    element.style.display = 'none'
    observer?.emit(element, 120, 70)
    expect(sizes).toHaveLength(2)

    element.style.display = ''
    element.remove()
    observer?.emit(element, 130, 80)
    expect(sizes).toHaveLength(2)

    dispose()
    expect(observer?.disconnected).toBe(true)
  })
})
