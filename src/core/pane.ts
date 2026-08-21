import type { WidgetId } from './widget'
import { createLayoutSurfaceStyle, type LayoutSurfaceStyle } from './layout-surface-style'

export type PaneId = string
export type PaneAxis = 'horizontal' | 'vertical'
export type PaneOverflow = 'auto' | 'hidden' | 'visible'
export type PaneBackground = 'transparent' | 'canvas' | 'surface' | 'surface-raised'
export type PaneParameterValue = string | number | boolean
export type PaneParameters = Readonly<Record<string, PaneParameterValue>>
export type PaneSplitEdge = 'left' | 'right' | 'top' | 'bottom'
export type PaneSizeMode = 'flex' | 'fixed' | 'content'

/** Reserved framework widget identity for an empty command-launcher window. */
export const COMMAND_LAUNCHER_WIDGET_ID = '@widgetforge/command-launcher' as const

export interface PaneSettings {
  readonly resizable?: boolean
  readonly minSize?: number
  readonly maxSize?: number
  readonly grow?: number
  readonly sizeMode?: PaneSizeMode
  readonly size?: number
  readonly collapsible?: boolean
  readonly collapsed?: boolean
  readonly locked?: boolean
  readonly background?: PaneBackground
  readonly backgroundColor?: string
  readonly surfaceStyle?: LayoutSurfaceStyle
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

export interface TabPane {
  readonly kind: 'tabs'
  readonly id: PaneId
  readonly children: readonly PaneNode[]
  readonly activeId: PaneId
  readonly settings?: PaneSettings
}

export interface StackPane {
  readonly kind: 'stack'
  readonly id: PaneId
  readonly children: readonly PaneNode[]
  readonly settings?: PaneSettings
}

export type PaneNode = WidgetPane | SplitPane | TabPane | StackPane

export interface CreateWidgetPaneOptions {
  id: PaneId
  widgetId: WidgetId
  instanceId?: string
  parameters?: PaneParameters
  settings?: PaneSettings
}

export type CommandLauncherPane = WidgetPane & { readonly widgetId: typeof COMMAND_LAUNCHER_WIDGET_ID }

export interface CreateCommandLauncherPaneOptions {
  readonly id: PaneId
  readonly instanceId?: string
  readonly settings?: PaneSettings
}

export interface CreateSplitPaneOptions {
  id: PaneId
  axis: PaneAxis
  children: readonly PaneNode[]
  weights?: readonly number[]
  settings?: PaneSettings
}

export interface CreateTabPaneOptions {
  id: PaneId
  children: readonly PaneNode[]
  activeId?: PaneId
  settings?: PaneSettings
}

export interface CreateStackPaneOptions {
  id: PaneId
  children: readonly PaneNode[]
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

function cloneSettings(settings: PaneSettings): PaneSettings {
  return { ...settings, ...(settings.surfaceStyle ? { surfaceStyle: createLayoutSurfaceStyle(settings.surfaceStyle) } : {}) }
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
    ['size', settings.size],
  ] as const) {
    if (value === undefined) continue
    if (!Number.isFinite(value) || value < 0) {
      throw new PaneDefinitionError(`pane setting ${name} must be a finite non-negative number`)
    }
  }
  if (settings.minSize !== undefined && settings.maxSize !== undefined && settings.minSize > settings.maxSize) {
    throw new PaneDefinitionError('pane minSize must not exceed maxSize')
  }
  if (settings.sizeMode === 'fixed' && settings.size === undefined) {
    throw new PaneDefinitionError('fixed pane size mode requires a size')
  }
  if (settings.size !== undefined && settings.sizeMode !== 'fixed') {
    throw new PaneDefinitionError('pane size is only valid for fixed size mode')
  }
  if (settings.collapsed && !settings.collapsible) {
    throw new PaneDefinitionError('collapsed panes must be collapsible')
  }
  if (settings.backgroundColor !== undefined && !settings.backgroundColor.trim()) {
    throw new PaneDefinitionError('pane backgroundColor must not be empty')
  }
  if (settings.surfaceStyle) {
    try { createLayoutSurfaceStyle(settings.surfaceStyle) } catch (error) {
      throw new PaneDefinitionError(error instanceof Error ? error.message : 'invalid pane surface style')
    }
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

function validateAxis(axis: PaneAxis): void {
  if (axis !== 'horizontal' && axis !== 'vertical') throw new PaneDefinitionError(`invalid split pane axis "${String(axis)}"`)
}

function validateTabChildren(children: readonly PaneNode[], activeId: PaneId): void {
  if (children.length < 2) throw new PaneDefinitionError('tab pane requires at least two children')
  if (!children.some((child) => child.id === activeId)) {
    throw new PaneDefinitionError(`active tab "${activeId}" must reference a direct tab child`)
  }
}

function assertUnlocked(pane: PaneNode, operation: string): void {
  if (pane.settings?.locked) throw new InvalidPaneOperationError(`${operation} is not allowed for locked pane "${pane.id}"`)
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
    kind: 'widget', id: options.id, widgetId: options.widgetId, instanceId, parameters,
    ...(options.settings ? { settings: cloneSettings(options.settings) } : {}),
  }
}

export function createCommandLauncherPane(options: CreateCommandLauncherPaneOptions): CommandLauncherPane {
  return createWidgetPane({
    id: options.id,
    widgetId: COMMAND_LAUNCHER_WIDGET_ID,
    instanceId: options.instanceId ?? `${options.id}.launcher`,
    ...(options.settings ? { settings: options.settings } : {}),
  }) as CommandLauncherPane
}

export function isCommandLauncherPane(pane: PaneNode | undefined): pane is CommandLauncherPane {
  return pane?.kind === 'widget' && pane.widgetId === COMMAND_LAUNCHER_WIDGET_ID
}

export function createSplitPane(options: CreateSplitPaneOptions): SplitPane {
  validateId(options.id, 'pane id')
  validateAxis(options.axis)
  if (options.children.length < 2) throw new PaneDefinitionError('split pane requires at least two children')
  const weights = [...(options.weights ?? options.children.map(() => 1))]
  validateWeights(options.children, weights)
  validateSettings(options.settings)
  const pane: SplitPane = {
    kind: 'split', id: options.id, axis: options.axis, children: options.children.map(clonePaneTree), weights,
    ...(options.settings ? { settings: cloneSettings(options.settings) } : {}),
  }
  validatePaneTree(pane)
  return pane
}

export function createTabPane(options: CreateTabPaneOptions): TabPane {
  validateId(options.id, 'pane id')
  const children = options.children.map(clonePaneTree)
  const activeId = options.activeId ?? children[0]?.id ?? ''
  validateId(activeId, 'active tab id')
  validateTabChildren(children, activeId)
  validateSettings(options.settings)
  const pane: TabPane = {
    kind: 'tabs', id: options.id, children, activeId,
    ...(options.settings ? { settings: cloneSettings(options.settings) } : {}),
  }
  validatePaneTree(pane)
  return pane
}

export function createStackPane(options: CreateStackPaneOptions): StackPane {
  validateId(options.id, 'pane id')
  if (options.children.length < 1) throw new PaneDefinitionError('stack pane requires at least one child')
  validateSettings(options.settings)
  const pane: StackPane = {
    kind: 'stack', id: options.id, children: options.children.map(clonePaneTree),
    ...(options.settings ? { settings: cloneSettings(options.settings) } : {}),
  }
  validatePaneTree(pane)
  return pane
}

export function clonePaneTree<T extends PaneNode>(pane: T): T {
  if (pane.kind === 'widget') {
    return { ...pane, parameters: { ...pane.parameters }, ...(pane.settings ? { settings: cloneSettings(pane.settings) } : {}) } as T
  }
  if (pane.kind === 'split') {
    return { ...pane, children: pane.children.map(clonePaneTree), weights: [...pane.weights], ...(pane.settings ? { settings: cloneSettings(pane.settings) } : {}) } as T
  }
  return { ...pane, children: pane.children.map(clonePaneTree), ...(pane.settings ? { settings: cloneSettings(pane.settings) } : {}) } as T
}

export function validatePaneTree(root: PaneNode): void {
  const seen = new Set<PaneId>()
  const seenWidgetInstances = new Set<string>()
  function visit(pane: PaneNode): void {
    validateId(pane.id, 'pane id')
    if (seen.has(pane.id)) throw new PaneDefinitionError(`duplicate pane id "${pane.id}"`)
    seen.add(pane.id)
    validateSettings(pane.settings)
    if (pane.kind === 'widget') {
      validateId(pane.widgetId, 'widget id')
      validateId(pane.instanceId, 'widget instance id')
      if (seenWidgetInstances.has(pane.instanceId)) throw new PaneDefinitionError(`duplicate widget instance id "${pane.instanceId}"`)
      seenWidgetInstances.add(pane.instanceId)
      validateParameters(pane.parameters)
      return
    }
    if (pane.kind === 'split') {
      validateAxis(pane.axis)
      if (pane.children.length < 2) throw new PaneDefinitionError('split pane requires at least two children')
      validateWeights(pane.children, pane.weights)
    } else if (pane.kind === 'tabs') {
      validateTabChildren(pane.children, pane.activeId)
    } else if (pane.children.length < 1) {
      throw new PaneDefinitionError('stack pane requires at least one child')
    }
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
    if (current.kind === 'split') return { ...current, children: current.children.map(replace), weights: [...current.weights], ...(current.settings ? { settings: cloneSettings(current.settings) } : {}) }
    return { ...current, children: current.children.map(replace), ...(current.settings ? { settings: cloneSettings(current.settings) } : {}) }
  }
  const result = replace(root)
  validatePaneTree(result)
  return result
}

export interface RemovePaneResult { readonly root: PaneNode | null; readonly removed: PaneNode }

export function removePane(root: PaneNode, paneId: PaneId): RemovePaneResult {
  const target = findPane(root, paneId)
  if (!target) throw new UnknownPaneError(paneId)
  assertUnlocked(target, 'remove pane')
  if (root.id === paneId) return { root: null, removed: clonePaneTree(root) }
  function remove(current: PaneNode): PaneNode | null {
    if (current.id === paneId) return null
    if (current.kind === 'widget') return clonePaneTree(current)
    const kept: PaneNode[] = []
    const keptIndices: number[] = []
    current.children.forEach((child, index) => {
      const next = remove(child)
      if (!next) return
      kept.push(next)
      keptIndices.push(index)
    })
    if (kept.length === 0) return null
    if (kept.length === 1) return kept[0] ?? null
    if (current.kind === 'split') return { ...current, children: kept, weights: keptIndices.map((index) => current.weights[index] ?? 1), ...(current.settings ? { settings: cloneSettings(current.settings) } : {}) }
    if (current.kind === 'tabs') return { ...current, children: kept, activeId: kept.some((child) => child.id === current.activeId) ? current.activeId : (kept[0]?.id ?? current.activeId), ...(current.settings ? { settings: cloneSettings(current.settings) } : {}) }
    return { ...current, children: kept, ...(current.settings ? { settings: cloneSettings(current.settings) } : {}) }
  }
  const nextRoot = remove(root)
  if (!nextRoot) throw new InvalidPaneOperationError('removing a nested pane produced an empty tree')
  validatePaneTree(nextRoot)
  return { root: nextRoot, removed: clonePaneTree(target) }
}

export function splitPaneAt(root: PaneNode, targetId: PaneId, incoming: PaneNode, edge: PaneSplitEdge, splitId: PaneId): PaneNode {
  const target = findPane(root, targetId)
  if (!target) throw new UnknownPaneError(targetId)
  assertUnlocked(target, 'split pane')
  if (containsPane(incoming, targetId)) throw new InvalidPaneOperationError('incoming pane must not contain the target pane')
  const axis: PaneAxis = edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical'
  const incomingFirst = edge === 'left' || edge === 'top'
  return replacePane(root, targetId, createSplitPane({ id: splitId, axis, children: incomingFirst ? [incoming, target] : [target, incoming] }))
}

export function tabPaneAt(root: PaneNode, targetId: PaneId, incoming: PaneNode, tabId: PaneId): PaneNode {
  const target = findPane(root, targetId)
  if (!target) throw new UnknownPaneError(targetId)
  assertUnlocked(target, 'tab pane')
  if (containsPane(incoming, targetId)) throw new InvalidPaneOperationError('incoming pane must not contain the target pane')
  if (target.kind === 'tabs') {
    const next = createTabPane({ id: target.id, children: [...target.children, incoming], activeId: incoming.id, ...(target.settings ? { settings: target.settings } : {}) })
    return replacePane(root, targetId, next)
  }
  return replacePane(root, targetId, createTabPane({ id: tabId, children: [target, incoming], activeId: incoming.id }))
}

export function movePane(root: PaneNode, sourceId: PaneId, targetId: PaneId, edge: PaneSplitEdge, splitId: PaneId): PaneNode {
  if (sourceId === targetId) throw new InvalidPaneOperationError('source and target pane must differ')
  const source = findPane(root, sourceId), target = findPane(root, targetId)
  if (!source) throw new UnknownPaneError(sourceId)
  if (!target) throw new UnknownPaneError(targetId)
  assertUnlocked(source, 'move pane')
  assertUnlocked(target, 'move pane')
  if (source.id === root.id) throw new InvalidPaneOperationError('the root pane cannot be moved inside itself')
  if (containsPane(source, targetId)) throw new InvalidPaneOperationError('a pane cannot be moved into one of its descendants')
  const removed = removePane(root, sourceId)
  if (!removed.root || !containsPane(removed.root, targetId)) throw new InvalidPaneOperationError('target pane is not available after removing the source')
  return splitPaneAt(removed.root, targetId, removed.removed, edge, splitId)
}

export function movePaneToTabs(root: PaneNode, sourceId: PaneId, targetId: PaneId, tabId: PaneId): PaneNode {
  if (sourceId === targetId) throw new InvalidPaneOperationError('source and target pane must differ')
  const source = findPane(root, sourceId), target = findPane(root, targetId)
  if (!source) throw new UnknownPaneError(sourceId)
  if (!target) throw new UnknownPaneError(targetId)
  assertUnlocked(source, 'move pane')
  assertUnlocked(target, 'move pane')
  if (source.id === root.id) throw new InvalidPaneOperationError('the root pane cannot be moved inside itself')
  if (containsPane(source, targetId)) throw new InvalidPaneOperationError('a pane cannot be moved into one of its descendants')
  const removed = removePane(root, sourceId)
  if (!removed.root || !containsPane(removed.root, targetId)) throw new InvalidPaneOperationError('target pane is not available after removing the source')
  return tabPaneAt(removed.root, targetId, removed.removed, tabId)
}

export function setSplitWeights(root: PaneNode, splitId: PaneId, weights: readonly number[]): PaneNode {
  const pane = findPane(root, splitId)
  if (!pane) throw new UnknownPaneError(splitId)
  if (pane.kind !== 'split') throw new InvalidPaneOperationError(`pane "${splitId}" is not a split pane`)
  assertUnlocked(pane, 'resize split')
  validateWeights(pane.children, weights)
  return replacePane(root, splitId, { ...pane, weights: [...weights] })
}

export function setActiveTab(root: PaneNode, tabPaneId: PaneId, activeId: PaneId): PaneNode {
  const pane = findPane(root, tabPaneId)
  if (!pane) throw new UnknownPaneError(tabPaneId)
  if (pane.kind !== 'tabs') throw new InvalidPaneOperationError(`pane "${tabPaneId}" is not a tab pane`)
  if (!pane.children.some((child) => child.id === activeId)) throw new InvalidPaneOperationError(`pane "${activeId}" is not a direct tab of "${tabPaneId}"`)
  if (pane.activeId === activeId) return clonePaneTree(root)
  return replacePane(root, tabPaneId, { ...pane, activeId })
}

export function reorderTab(root: PaneNode, tabPaneId: PaneId, sourceId: PaneId, targetIndex: number): PaneNode {
  const pane = findPane(root, tabPaneId)
  if (!pane) throw new UnknownPaneError(tabPaneId)
  if (pane.kind !== 'tabs') throw new InvalidPaneOperationError(`pane "${tabPaneId}" is not a tab pane`)
  if (pane.settings?.locked) throw new InvalidPaneOperationError(`tab pane "${tabPaneId}" is locked`)
  const sourceIndex = pane.children.findIndex((child) => child.id === sourceId)
  if (sourceIndex < 0) throw new InvalidPaneOperationError(`pane "${sourceId}" is not a direct tab of "${tabPaneId}"`)
  const source = pane.children[sourceIndex]
  if (source) assertUnlocked(source, 'reorder tab')
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= pane.children.length) throw new InvalidPaneOperationError('target tab index is out of range')
  const children = [...pane.children]
  const [moved] = children.splice(sourceIndex, 1)
  if (!moved) throw new InvalidPaneOperationError('tab reorder source disappeared')
  children.splice(targetIndex, 0, moved)
  return replacePane(root, tabPaneId, { ...pane, children })
}

export function setPaneCollapsed(root: PaneNode, paneId: PaneId, collapsed: boolean): PaneNode {
  const pane = findPane(root, paneId)
  if (!pane) throw new UnknownPaneError(paneId)
  assertUnlocked(pane, 'collapse pane')
  if (!pane.settings?.collapsible) throw new InvalidPaneOperationError(`pane "${paneId}" is not collapsible`)
  if (Boolean(pane.settings.collapsed) === collapsed) return clonePaneTree(root)
  return replacePane(root, paneId, { ...pane, settings: { ...pane.settings, collapsed } })
}

export function setPaneSurfaceStyle(root: PaneNode, paneId: PaneId, surfaceStyle: LayoutSurfaceStyle | undefined): PaneNode {
  const pane = findPane(root, paneId)
  if (!pane) throw new UnknownPaneError(paneId)
  assertUnlocked(pane, 'style pane')
  const settings = { ...(pane.settings ?? {}), ...(surfaceStyle ? { surfaceStyle: createLayoutSurfaceStyle(surfaceStyle) } : {}) }
  if (!surfaceStyle) delete settings.surfaceStyle
  return replacePane(root, paneId, { ...pane, ...(Object.keys(settings).length > 0 ? { settings } : {}) })
}
