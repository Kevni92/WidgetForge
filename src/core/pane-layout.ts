import { InvalidPaneOperationError, type SplitPane } from './pane'

const MIN_WEIGHT = 0.000001

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
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
