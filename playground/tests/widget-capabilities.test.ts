import { describe, expect, it } from 'vitest'
import { playgroundWidgetRegistry } from '../src/playground-widgets'

describe('playground widget capabilities', () => {
  it('demonstrates distinct floating, docked and compact-capable profiles', () => {
    expect(playgroundWidgetRegistry.getCapabilities('market.ticker')).toMatchObject({ multipleInstances: false, dockable: true, tabCompatible: true, supportsCompactMode: false })
    expect(playgroundWidgetRegistry.getCapabilities('demo.live-metric')).toMatchObject({ multipleInstances: true, dockable: true, tabCompatible: true, supportsCompactMode: true })
    expect(playgroundWidgetRegistry.getCapabilities('demo.alerts')).toMatchObject({ multipleInstances: false, dockable: false, tabCompatible: false, supportsCompactMode: false })
    expect(playgroundWidgetRegistry.getCapabilities('demo.workspace-topbar')).toMatchObject({ dockable: true, tabCompatible: false })
  })
})
