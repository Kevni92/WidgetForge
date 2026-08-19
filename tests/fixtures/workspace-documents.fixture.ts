export const workspaceV1Fixture = {
  version: 1,
  windows: [
    {
      instanceId: 'legacy-alpha',
      widgetId: 'fixture.alpha',
      parameters: { planet: 'ARC-01' },
      geometry: { position: { x: 24, y: 36 }, size: { width: 360, height: 220 } },
      mode: 'normal',
      focused: true,
      zIndex: 0,
    },
    {
      instanceId: 'legacy-beta',
      widgetId: 'fixture.beta',
      parameters: {},
      geometry: { position: { x: 420, y: 80 }, size: { width: 300, height: 180 } },
      mode: 'minimized',
      focused: false,
      zIndex: 1,
    },
  ],
  extensionData: { marker: 'preserve-me' },
} as const

export const workspaceV2Fixture = {
  version: 2,
  windows: [
    {
      instanceId: 'v2-alpha',
      title: 'Fixture Alpha',
      rootPane: { kind: 'widget', id: 'v2-alpha.root', widgetId: 'fixture.alpha', instanceId: 'v2-alpha', parameters: { planet: 'ARC-02' } },
      geometry: { position: { x: 40, y: 50 }, size: { width: 380, height: 240 } },
      constraints: { minSize: { width: 160, height: 96 }, maxSize: null },
      options: { role: 'normal', layer: 'normal', movable: true, resizable: true, minimizable: true, maximizable: true, closable: true, opacity: 1, header: 'always', chrome: 'default', glass: false, headerActions: [] },
      snap: null,
      restoreGeometry: null,
      mode: 'normal',
      focused: true,
      zIndex: 0,
    },
  ],
  extensionData: { marker: 'preserve-v2' },
} as const
