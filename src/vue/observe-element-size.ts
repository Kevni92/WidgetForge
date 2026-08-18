import type { WindowSize } from '../core/window-geometry'

export type ElementSizeListener = (size: WindowSize) => void

export function observeElementSize(element: HTMLElement, listener: ElementSizeListener): () => void {
  let lastWidth = -1
  let lastHeight = -1
  let disposed = false

  const deliver = (width: number, height: number): void => {
    if (disposed || !element.isConnected) return
    if (globalThis.getComputedStyle?.(element).display === 'none') return

    const roundedWidth = Math.round(width)
    const roundedHeight = Math.round(height)
    if (roundedWidth <= 0 || roundedHeight <= 0) return
    if (roundedWidth === lastWidth && roundedHeight === lastHeight) return

    lastWidth = roundedWidth
    lastHeight = roundedHeight
    listener({ width: roundedWidth, height: roundedHeight })
  }

  const initial = element.getBoundingClientRect()
  deliver(initial.width, initial.height)

  if (typeof ResizeObserver === 'undefined') {
    return () => { disposed = true }
  }

  const observer = new ResizeObserver((entries) => {
    const entry = entries.find((candidate) => candidate.target === element) ?? entries[0]
    if (!entry) return
    deliver(entry.contentRect.width, entry.contentRect.height)
  })
  observer.observe(element)

  return () => {
    if (disposed) return
    disposed = true
    observer.disconnect()
  }
}
