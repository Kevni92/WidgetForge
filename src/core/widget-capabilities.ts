import { validatePaneTree, type PaneNode } from './pane'
import type { WidgetRegistry } from './widget-registry'

export type WidgetCapabilityName = 'multipleInstances' | 'dockable' | 'tabCompatible'

export class WidgetCapabilityError extends Error {
  constructor(
    public readonly widgetId: string,
    public readonly capability: WidgetCapabilityName,
    public readonly operation: string,
  ) {
    super(`widget "${widgetId}" does not support ${operation} (${capability}=false)`)
    this.name = 'WidgetCapabilityError'
  }
}

export interface PaneCapabilityPolicy {
  readonly dockHost?: boolean
  readonly tabHosted?: boolean
}

export function assertPaneCapabilities(
  registry: WidgetRegistry,
  pane: PaneNode,
  policy: PaneCapabilityPolicy = {},
): void {
  validatePaneTree(pane)
  const visit = (node: PaneNode, tabHosted: boolean): void => {
    if (node.kind === 'widget') {
      const capabilities = registry.getCapabilities(node.widgetId)
      if (policy.dockHost && !capabilities.dockable) throw new WidgetCapabilityError(node.widgetId, 'dockable', 'dock hosting')
      if (tabHosted && !capabilities.tabCompatible) throw new WidgetCapabilityError(node.widgetId, 'tabCompatible', 'tab hosting')
      return
    }
    const nextTabHosted = tabHosted || node.kind === 'tabs'
    for (const child of node.children) visit(child, nextTabHosted)
  }
  visit(pane, policy.tabHosted ?? false)
}

export function paneIsDockable(registry: WidgetRegistry, pane: PaneNode): boolean {
  try { assertPaneCapabilities(registry, pane, { dockHost: true }); return true } catch (error) { if (error instanceof WidgetCapabilityError) return false; throw error }
}

export function paneIsTabCompatible(registry: WidgetRegistry, pane: PaneNode): boolean {
  try { assertPaneCapabilities(registry, pane, { tabHosted: true }); return true } catch (error) { if (error instanceof WidgetCapabilityError) return false; throw error }
}
