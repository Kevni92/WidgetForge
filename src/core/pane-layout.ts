import { InvalidPaneOperationError, type PaneId, type PaneSizeMode, type SplitPane } from './pane'

const MIN_WEIGHT = 0.000001

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export interface PaneSplitLayoutItem {
  readonly paneId: PaneId
  readonly mode: PaneSizeMode
  readonly size: number
  readonly collapsed: boolean
}

export interface PaneSplitLayout {
  readonly items: readonly PaneSplitLayoutItem[]
  readonly totalSize: number
  readonly overflow: number
}

export type PaneIntrinsicSizes = Readonly<Record<PaneId, number>>

function modeFor(split: SplitPane, index: number): PaneSizeMode {
  return split.children[index]?.settings?.sizeMode ?? 'flex'
}

function minimumFor(split: SplitPane, index: number): number {
  return Math.max(0, split.children[index]?.settings?.minSize ?? 0)
}

function maximumFor(split: SplitPane, index: number): number {
  return split.children[index]?.settings?.maxSize ?? Number.POSITIVE_INFINITY
}

function desiredFor(split: SplitPane, index: number, intrinsicSizes: PaneIntrinsicSizes): number {
  const child = split.children[index]
  if (!child) return 0
  const minimum = minimumFor(split, index)
  const maximum = maximumFor(split, index)
  const mode = modeFor(split, index)
  if (mode === 'fixed') return clamp(child.settings?.size ?? minimum, minimum, maximum)
  if (mode === 'content') return clamp(intrinsicSizes[child.id] ?? minimum, minimum, maximum)
  return minimum
}

/**
 * Resolves the one-dimensional child extents of a SplitPane. `availablePx`
 * describes the content area and therefore excludes divider thickness.
 * Explicitly collapsed panes consume zero pixels. If minimum sizes alone do
 * not fit, minimums are preserved and the excess is reported as `overflow`.
 */
export function calculatePaneSplitLayout(
  split: SplitPane,
  availablePx: number,
  intrinsicSizes: PaneIntrinsicSizes = {},
): PaneSplitLayout {
  if (!Number.isFinite(availablePx) || availablePx < 0) {
    throw new InvalidPaneOperationError('pane layout extent must be a finite non-negative number')
  }

  const sizes = split.children.map((child, index) => child.settings?.collapsed ? 0 : desiredFor(split, index, intrinsicSizes))
  const minimums = split.children.map((child, index) => child.settings?.collapsed ? 0 : minimumFor(split, index))
  const minimumTotal = minimums.reduce((sum, value) => sum + value, 0)

  if (minimumTotal > availablePx) {
    const items = split.children.map((child, index) => ({
      paneId: child.id,
      mode: modeFor(split, index),
      size: minimums[index] ?? 0,
      collapsed: Boolean(child.settings?.collapsed),
    }))
    return { items, totalSize: minimumTotal, overflow: minimumTotal - availablePx }
  }

  let total = sizes.reduce((sum, value) => sum + value, 0)
  if (total > availablePx) {
    for (const mode of ['content', 'fixed'] as const) {
      for (let index = split.children.length - 1; index >= 0 && total > availablePx; index -= 1) {
        if (modeFor(split, index) !== mode) continue
        const current = sizes[index] ?? 0
        const minimum = minimums[index] ?? 0
        const shrink = Math.min(current - minimum, total - availablePx)
        if (shrink <= 0) continue
        sizes[index] = current - shrink
        total -= shrink
      }
    }
  }

  let remaining = Math.max(0, availablePx - total)
  const active = new Set(split.children.map((_, index) => index).filter((index) => {
    const child = split.children[index]
    return child !== undefined && !child.settings?.collapsed && modeFor(split, index) === 'flex' && maximumFor(split, index) > (sizes[index] ?? 0)
  }))

  while (remaining > 0.000001 && active.size > 0) {
    let weightTotal = 0
    for (const index of active) {
      const grow = split.children[index]?.settings?.grow ?? 1
      weightTotal += (split.weights[index] ?? 1) * grow
    }
    if (weightTotal <= 0) break
    let distributed = 0
    for (const index of [...active]) {
      const current = sizes[index] ?? 0
      const grow = split.children[index]?.settings?.grow ?? 1
      const share = remaining * (((split.weights[index] ?? 1) * grow) / weightTotal)
      const next = Math.min(maximumFor(split, index), current + share)
      const delta = next - current
      sizes[index] = next
      distributed += delta
      if (next >= maximumFor(split, index) - 0.000001) active.delete(index)
    }
    if (distributed <= 0.000001) break
    remaining -= distributed
  }

  total = sizes.reduce((sum, value) => sum + value, 0)
  const items = split.children.map((child, index) => ({
    paneId: child.id,
    mode: modeFor(split, index),
    size: sizes[index] ?? 0,
    collapsed: Boolean(child.settings?.collapsed),
  }))
  return { items, totalSize: total, overflow: Math.max(0, total - availablePx) }
}

export function resizePaneSplitWeights(
  split: SplitPane,
  dividerIndex: number,
  deltaPx: number,
  availablePx: number,
): readonly number[] {
  if (!Number.isInteger(dividerIndex) || dividerIndex < 0 || dividerIndex >= split.children.length - 1) {
    throw new InvalidPaneOperationError('divider index must reference two adjacent pane children')
  }
  if (!Number.isFinite(deltaPx)) throw new InvalidPaneOperationError('pane resize delta must be finite')
  if (!Number.isFinite(availablePx) || availablePx <= 0) return [...split.weights]

  const firstWeight = split.weights[dividerIndex]
  const secondWeight = split.weights[dividerIndex + 1]
  const firstChild = split.children[dividerIndex]
  const secondChild = split.children[dividerIndex + 1]
  if (firstWeight === undefined || secondWeight === undefined || !firstChild || !secondChild) {
    throw new InvalidPaneOperationError('split pane is missing divider neighbours')
  }
  if (
    split.settings?.locked || split.settings?.resizable === false ||
    firstChild.settings?.locked || secondChild.settings?.locked ||
    firstChild.settings?.resizable === false || secondChild.settings?.resizable === false ||
    (firstChild.settings?.sizeMode ?? 'flex') !== 'flex' ||
    (secondChild.settings?.sizeMode ?? 'flex') !== 'flex' ||
    firstChild.settings?.collapsed || secondChild.settings?.collapsed
  ) return [...split.weights]

  const totalWeight = split.weights.reduce((sum, weight) => sum + weight, 0)
  const pairWeight = firstWeight + secondWeight
  const pairPx = availablePx * (pairWeight / totalWeight)
  if (pairPx <= 0) return [...split.weights]

  const firstPx = pairPx * (firstWeight / pairWeight)
  const firstMin = Math.max(0, firstChild.settings?.minSize ?? 0)
  const firstMax = firstChild.settings?.maxSize ?? Number.POSITIVE_INFINITY
  const secondMin = Math.max(0, secondChild.settings?.minSize ?? 0)
  const secondMax = secondChild.settings?.maxSize ?? Number.POSITIVE_INFINITY
  const minimumFirst = Math.max(firstMin, pairPx - secondMax, pairPx * MIN_WEIGHT)
  const maximumFirst = Math.min(firstMax, pairPx - secondMin, pairPx * (1 - MIN_WEIGHT))
  if (minimumFirst > maximumFirst) return [...split.weights]

  const nextFirstPx = clamp(firstPx + deltaPx, minimumFirst, maximumFirst)
  const nextFirstWeight = pairWeight * (nextFirstPx / pairPx)
  const nextSecondWeight = pairWeight - nextFirstWeight
  const weights = [...split.weights]
  weights[dividerIndex] = nextFirstWeight
  weights[dividerIndex + 1] = nextSecondWeight
  return weights
}
