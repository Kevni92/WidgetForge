import { normalizeWindowGeometry, type WindowGeometry, type WindowSize, type WindowSizeConstraints } from 'widgetforge'

export type ReferenceWindowId = 'market-main' | 'colony-main' | 'alerts-main' | 'telemetry-power' | 'operations-main' | 'economy-flow'
export type ReferenceLayout = Readonly<Record<ReferenceWindowId, WindowGeometry>>

const constraints: Record<ReferenceWindowId, WindowSizeConstraints> = {
  'market-main': { minSize: { width: 420, height: 260 }, maxSize: null },
  'colony-main': { minSize: { width: 320, height: 210 }, maxSize: { width: 900, height: 700 } },
  'alerts-main': { minSize: { width: 330, height: 220 }, maxSize: null },
  'telemetry-power': { minSize: { width: 220, height: 140 }, maxSize: { width: 460, height: 320 } },
  'operations-main': { minSize: { width: 420, height: 220 }, maxSize: null },
  'economy-flow': { minSize: { width: 500, height: 280 }, maxSize: null },
}

function layoutGeometry(id: ReferenceWindowId, geometry: WindowGeometry, container: WindowSize): WindowGeometry {
  return normalizeWindowGeometry(geometry, constraints[id], container)
}

/**
 * Deliberately Playground-specific reference geometry. The framework only
 * receives the resulting window intents and does not know this arrangement.
 */
export function createReferenceLayout(container: WindowSize): ReferenceLayout {
  const width = Math.max(1, Math.round(container.width)), height = Math.max(1, Math.round(container.height))
  const compact = width < 1200
  const wide = width >= 1500
  const marketWidth = wide ? 560 : 420
  const rightWidth = wide || width >= 1400 ? 430 : 330
  const middleX = 16 + marketWidth + 16
  const rightX = Math.max(16, width - rightWidth - 16)
  const middleWidth = Math.min(440, Math.max(320, rightX - middleX - 16))
  const twoColumnWidth = Math.min(440, Math.max(320, width - 476))

  const desired: Record<ReferenceWindowId, WindowGeometry> = compact
    ? {
        'market-main': { position: { x: 16, y: 16 }, size: { width: 420, height: 300 } },
        'colony-main': { position: { x: 460, y: 16 }, size: { width: twoColumnWidth, height: 300 } },
        'alerts-main': { position: { x: 16, y: 340 }, size: { width: 430, height: 260 } },
        'telemetry-power': { position: { x: 460, y: 340 }, size: { width: 220, height: 140 } },
        'operations-main': { position: { x: 460, y: 500 }, size: { width: 420, height: 220 } },
        'economy-flow': { position: { x: 16, y: 500 }, size: { width: 500, height: 280 } },
      }
    : {
        'market-main': { position: { x: 16, y: 16 }, size: { width: marketWidth, height: wide ? 400 : 380 } },
        'colony-main': { position: { x: middleX, y: 16 }, size: { width: middleWidth, height: 330 } },
        'alerts-main': { position: { x: rightX, y: 16 }, size: { width: rightWidth, height: 300 } },
        'telemetry-power': { position: { x: rightX, y: 332 }, size: { width: wide ? 250 : 220, height: 155 } },
        'operations-main': { position: { x: 16, y: 432 }, size: { width: wide ? 590 : 560, height: 270 } },
        'economy-flow': { position: { x: middleX, y: 400 }, size: { width: 640, height: 360 } },
      }

  return Object.fromEntries(Object.entries(desired).map(([id, geometry]) => [
    id,
    layoutGeometry(id as ReferenceWindowId, geometry, { width, height }),
  ])) as ReferenceLayout
}
