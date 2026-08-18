import type { WidgetId } from './widget'

export type PaneId = string
export type PaneAxis = 'horizontal' | 'vertical'
export type PaneOverflow = 'auto' | 'hidden' | 'visible'
export type PaneBackground = 'transparent' | 'canvas' | 'surface' | 'surface-raised'
export type PaneParameterValue = string | number | boolean
export type PaneParameters = Readonly<Record<string, PaneParameterValue>>
export type PaneSplitEdge = 'left' | 'right' | 'top' | 'bottom'

export interface PaneSettings {
  readonly resizable?: boolean
  readonly minSize?: number
  readonly maxSize?: number
  readonly grow?: number
  readonly background?: PaneBackground
  readonly backgroundColor?: string
  readonly overflow?: PaneOverflow
}

export interface WidgetPane {
  readonly kind: 'widget'
  readonly id: PaneId
  readonly widgetId: WidgetId
  readonly instanceId: string
  readonly parameters: PaneParameters
  readonly settings?: PaneSettings
}

export interface SplitPane {
  readonly kind: 'split'
  readonly id: PaneId
  readonly axis: PaneAxis
  readonly children: readonly PaneNode[]
  readonly weights: readonly number[]
  readonly settings?: PaneSettings
}

export type PaneNode = WidgetPane | SplitPane

export interface CreateWidgetPaneOptions {
  id: PaneId
  widgetId: WidgetId
  instanceId?: string
  parameters?: PaneParameters
  settings?: PaneSettings
}

export interface CreateSplitPaneOptions {
  id: PaneId
  axis: PaneAxis
  children: readonly PaneNode[]
  weights?: readonly number[]
  settings?: PaneSettings
}

export class PaneDefinitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaneDefinitionError'
  }
}

export class UnknownPaneError extends Error {
  constructor(public readonly paneId: PaneId) {
    super(`unknown pane "${paneId}"`)
    this.name = 'UnknownPaneError'
  }
}

export class InvalidPaneOperationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidPaneOperationError'
  }
}

function cloneSettings(settings?: PaneSettings): PaneSettings | undefined {
  return settings ? { ...settings } : undefined
}

function validateId(id: string, label: string): void {
  if (!id.trim()) throw new PaneDefinitionError(`${label} must not be empty`)
}

function validateSettings(settings?: PaneSettings): void {
  if (!settings) return

  for (const [name, value] of [
    ['minSize', settings.minSize],
    ['maxSize', settings.maxSize],
    ['grow', settings.grow],
  ] as const) {
    if (value === undefined) continue
    if (!Number.isFinite(value) || value < 0) {
      throw new PaneDefinitionError(`pane setting ${name} must be a finite non-negative number`)
    }
  }

  if (settings.minSize !== undefined && settings.maxSize !== undefined && settings.minSize > settings.maxSize) {
    throw new PaneDefinitionError('pane minSize must not exceed maxSize')
  }
  if (settings.backgroundColor !== undefined && !settings.backgroundColor.trim()) {
    throw new PaneDefinitionError('pane backgroundColor must not be empty')
  }
}

function validateParameters(parameters: PaneParameters): void {
  for (const [name, value] of Object.entries(parameters)) {
    if (!name.trim()) throw new PaneDefinitionError('pane parameter names must not be empty')
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new PaneDefinitionError(`pane parameter "${name}" must be finite`)
    }
  }
}

function validateWeights(children: readonly PaneNode[], weights: readonly number[]): void {
  if (weights.length !== children.length) {
    throw new PaneDefinitionError('split pane weights must match the number of children')
  }
  if (weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) {
    throw new PaneDefinitionError('split pane weights must be finite positive numbers')
  }
}

export function createWidgetPane(options: CreateWidgetPaneOptions): WidgetPane {
  validateId(options.id, 'pane id')
  validateId(options.widgetId, 'widget id')
  const instanceId = options.instanceId ?? options.id
  validateId(instanceId, 'widget instance id')
  const parameters = { ...(options.parameters ?? {}) }
  validateParameters(parameters)
  validateSettings(options.settings)

  return {
    kind: 'widget',
    id: options.id,
    widgetId: options.widgetId,
    instanceId,
    parameters,
    ...(options.settings ? { settings: cloneSettings(options.settings) } : {}),
  }
}

export function createSplitPane(options: CreateSplitPaneOptions): SplitPane {
  validateId(options.id, 'pane id')
  if (options.children.length < 2) throw new PaneDefinitionError('split pane requires at least two children')
  const weights = [...(options.weights ?? options.children.map(() => 1))]
  validateWeights(options.children, weights)
  validateSettings(options.settings)

  const pane: SplitPane = {
    kind: 'split',
    id: options.id,
    axis: options.axis,
    children: options.children.map(clonePaneTree),
    weights,
    ...(options.settings ? { settings: cloneSettings(options.settings) } : {}),
  }
  validatePaneTree(pane)
  return pane
}

export function clonePaneTree<T extends PaneNode>(pane: T): T {
  if (pane.kind === 'widget') {
    return {
      ...pane,
      parameters: { ...pane.parameters },
      ...(pane.settings ? { settings: cloneSettings(pane.settings) } : {}),
    } as T
  }

  return {
    ...pane,
    children: pane.children.map(clonePaneTree),
    weights: [...pane.weights],
    ...(pane.settings ? { settings: cloneSettings(pane.settings) } : {}),
  } as T
}

export function validatePaneTree(root: PaneNode): void {
  const seen = new Set<PaneId>()

  function visit(pane: PaneNode): void {
    validateId(pane.id, 'pane id')
    if (seen.has(pane.id)) throw new PaneDefinitionError(`duplicate pane id "${pane.id}"`)
    seen.add(pane.id)
    validateSettings(pane.settings)

    if (pane.kind === 'widget') {
      validateId(pane.widgetId, 'widget id')
      validateId(pane.instanceId, 'widget instance id')
      validateParameters(pane.parameters)
      return
    }

    if (pane.children.length < 2) throw new PaneDefinitionError('split pane requires at least two children')
    validateWeights(pane.children, pane.weights)
    for (const child of pane.children) visit(child)
  }

  visit(root)
}

export function findPane(root: PaneNode, paneId: PaneId): PaneNode | undefined {
  if (root.id === paneId) return root
  if (root.kind === 'widget') return undefined
  for (const child of root.children) {
    const match = findPane(child, paneId)
    if (match) return match
  }
  return undefined
}

export function containsPane(root: PaneNode, paneId: PaneId): boolean {
  return findPane(root, paneId) !== undefined
}

export function replacePane(root: PaneNode, paneId: PaneId, replacement: PaneNode): PaneNode {
  if (!containsPane(root, paneId)) throw new UnknownPaneError(paneId)

  function replace(current: PaneNode): PaneNode {
    if (current.id === paneId) return clonePaneTree(replacement)
    if (current.kind === 'widget') return clonePaneTree(current)
    return {
      ...current,
      children: current.children.map(replace),
      weights: [...current.weights],
      ...(current.settings ? { settings: cloneSettings(current.settings) } : {}),
    }
  }

  const result = replace(root)
  validatePaneTree(result)
  return result
}

export interface RemovePaneResult {
  readonly root: PaneNode | null
  readonly removed: PaneNode
}

export function removePane(root: PaneNode, paneId: PaneId): RemovePaneResult {
  const target = findPane(root, paneId)
  if (!target) throw new UnknownPaneError(paneId)
  if (root.id === paneId) return { root: null, removed: clonePaneTree(root) }

  function remove(current: PaneNode): PaneNode | null {
    if (current.id === paneId) return null
    if (current.kind === 'widget') return clonePaneTree(current)

    const kept: PaneNode[] = []
    const weights: number[] = []
    current.children.forEach((child, index) => {
      const next = remove(child)
      if (!next) return
      kept.push(next)
      weights.push(current.weights[index] ?? 1)
    })

    if (kept.length === 0) return null
    if (kept.length === 1) return kept[0] ?? null
    return {
      ...current,
      children: kept,
      weights,
      ...(current.settings ? { settings: cloneSettings(current.settings) } : {}),
    }
  }

  const nextRoot = remove(root)
  if (!nextRoot) throw new InvalidPaneOperationError('removing a nested pane produced an empty tree')
  validatePaneTree(nextRoot)
  return { root: nextRoot, removed: clonePaneTree(target) }
}

export function splitPaneAt(
  root: PaneNode,
  targetId: PaneId,
  incoming: PaneNode,
  edge: PaneSplitEdge,
  splitId: PaneId,
): PaneNode {
  const target = findPane(root, targetId)
  if (!target) throw new UnknownPaneError(targetId)
  if (containsPane(incoming, targetId)) {
    throw new InvalidPaneOperationError('incoming pane must not contain the target pane')
  }

  const axis: PaneAxis = edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical'
  const incomingFirst = edge === 'left' || edge === 'top'
  const split = createSplitPane({
    id: splitId,
    axis,
    children: incomingFirst ? [incoming, target] : [target, incoming],
  })
  return replacePane(root, targetId, split)
}

export function movePane(
  root: PaneNode,
  sourceId: PaneId,
  targetId: PaneId,
  edge: PaneSplitEdge,
  splitId: PaneId,
): PaneNode {
  if (sourceId === targetId) throw new InvalidPaneOperationError('source and target pane must differ')
  const source = findPane(root, sourceId)
  const target = findPane(root, targetId)
  if (!source) throw new UnknownPaneError(sourceId)
  if (!target) throw new UnknownPaneError(targetId)
  if (source.id === root.id) throw new InvalidPaneOperationError('the root pane cannot be moved inside itself')
  if (containsPane(source, targetId)) {
    throw new InvalidPaneOperationError('a pane cannot be moved into one of its descendants')
  }

  const removed = removePane(root, sourceId)
  if (!removed.root || !containsPane(removed.root, targetId)) {
    throw new InvalidPaneOperationError('target pane is not available after removing the source')
  }
  return splitPaneAt(removed.root, targetId, removed.removed, edge, splitId)
}

export function setSplitWeights(root: PaneNode, splitId: PaneId, weights: readonly number[]): PaneNode {
  const pane = findPane(root, splitId)
  if (!pane) throw new UnknownPaneError(splitId)
  if (pane.kind !== 'split') throw new InvalidPaneOperationError(`pane "${splitId}" is not a split pane`)
  validateWeights(pane.children, weights)
  return replacePane(root, splitId, { ...pane, weights: [...weights] })
}
