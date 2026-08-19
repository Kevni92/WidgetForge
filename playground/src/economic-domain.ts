import { createDataKey, type MockDataProvider } from 'widgetforge'

export const colonyIds = ['ARC-01', 'ARC-02', 'ARC-03'] as const
export type ColonyId = (typeof colonyIds)[number]

export interface ProductionLine { readonly id: string; readonly product: string; readonly rate: number; readonly efficiency: number }
export interface InventoryItem { readonly id: string; readonly name: string; readonly quantity: number; readonly capacity: number }
export interface MarketQuote { readonly id: string; readonly name: string; readonly bid: number; readonly ask: number; readonly volume: number; readonly change: number }
export interface Order { readonly id: string; readonly side: 'BUY' | 'SELL'; readonly commodity: string; readonly quantity: number; readonly price: number; readonly status: 'OPEN' | 'PARTIAL' | 'FILLED' }
export interface ColonyEconomy {
  readonly id: ColonyId
  readonly name: string
  readonly production: readonly ProductionLine[]
  readonly inventory: readonly InventoryItem[]
  readonly market: readonly MarketQuote[]
  readonly orders: readonly Order[]
}
export interface EconomySnapshot { readonly cycle: number; readonly locations: Readonly<Record<ColonyId, ColonyEconomy>> }

export const economyKey = createDataKey<EconomySnapshot>('demo.economy', 'network')

const baseLocations: Readonly<Record<ColonyId, ColonyEconomy>> = {
  'ARC-01': { id: 'ARC-01', name: 'Arcadia Prime', production: [{ id: 'p1', product: 'Ferrite', rate: 42, efficiency: 0.94 }, { id: 'p2', product: 'Fuel Cells', rate: 18, efficiency: 0.88 }], inventory: [{ id: 'i1', name: 'Ferrite', quantity: 640, capacity: 900 }, { id: 'i2', name: 'Fuel Cells', quantity: 220, capacity: 500 }, { id: 'i3', name: 'Food', quantity: 310, capacity: 420 }], market: [{ id: 'm1', name: 'Ferrite', bid: 112.4, ask: 114.1, volume: 8400, change: 1.2 }, { id: 'm2', name: 'Fuel Cells', bid: 286.2, ask: 289.5, volume: 4200, change: -0.4 }, { id: 'm3', name: 'Food', bid: 61.8, ask: 63.2, volume: 9100, change: 0.7 }], orders: [{ id: 'o1', side: 'SELL', commodity: 'Ferrite', quantity: 120, price: 114, status: 'OPEN' }, { id: 'o2', side: 'BUY', commodity: 'Food', quantity: 80, price: 62, status: 'PARTIAL' }] },
  'ARC-02': { id: 'ARC-02', name: 'Borealis Works', production: [{ id: 'p3', product: 'Titanium', rate: 31, efficiency: 0.91 }, { id: 'p4', product: 'Machinery', rate: 9, efficiency: 0.82 }], inventory: [{ id: 'i4', name: 'Titanium', quantity: 480, capacity: 760 }, { id: 'i5', name: 'Machinery', quantity: 96, capacity: 260 }, { id: 'i6', name: 'Fuel Cells', quantity: 180, capacity: 360 }], market: [{ id: 'm4', name: 'Titanium', bid: 174.1, ask: 177, volume: 6100, change: 0.5 }, { id: 'm5', name: 'Machinery', bid: 721, ask: 735, volume: 980, change: 2.1 }, { id: 'm6', name: 'Fuel Cells', bid: 291.4, ask: 294.2, volume: 3800, change: -0.9 }], orders: [{ id: 'o3', side: 'SELL', commodity: 'Titanium', quantity: 90, price: 176.5, status: 'OPEN' }, { id: 'o4', side: 'BUY', commodity: 'Fuel Cells', quantity: 60, price: 292, status: 'OPEN' }] },
  'ARC-03': { id: 'ARC-03', name: 'Cinder Reach', production: [{ id: 'p5', product: 'Cobalt', rate: 24, efficiency: 0.86 }, { id: 'p6', product: 'Electronics', rate: 12, efficiency: 0.9 }], inventory: [{ id: 'i7', name: 'Cobalt', quantity: 350, capacity: 650 }, { id: 'i8', name: 'Electronics', quantity: 140, capacity: 300 }, { id: 'i9', name: 'Food', quantity: 120, capacity: 360 }], market: [{ id: 'm7', name: 'Cobalt', bid: 203.6, ask: 207.4, volume: 5300, change: -1.1 }, { id: 'm8', name: 'Electronics', bid: 488, ask: 496, volume: 2100, change: 1.7 }, { id: 'm9', name: 'Food', bid: 66.3, ask: 68, volume: 7400, change: 0.2 }], orders: [{ id: 'o5', side: 'SELL', commodity: 'Electronics', quantity: 40, price: 495, status: 'PARTIAL' }, { id: 'o6', side: 'BUY', commodity: 'Food', quantity: 140, price: 67, status: 'OPEN' }] },
}

export function initialEconomySnapshot(): EconomySnapshot {
  return { cycle: 28417, locations: baseLocations }
}

function advanceLocation(location: ColonyEconomy, tick: number, locationIndex: number): ColonyEconomy {
  const delta = ((tick + locationIndex) % 3) - 1
  return {
    ...location,
    production: location.production.map((line, index) => ({ ...line, rate: Math.max(1, line.rate + (index === 0 ? delta : -delta) * 0.25) })),
    inventory: location.inventory.map((item, index) => ({ ...item, quantity: Math.max(0, Math.min(item.capacity, item.quantity + (index === 0 ? delta * 2 : delta))) })),
    market: location.market.map((quote, index) => ({ ...quote, bid: quote.bid + delta * 0.08 * (index + 1), ask: quote.ask + delta * 0.08 * (index + 1), volume: Math.max(0, quote.volume + delta * 15) })),
  }
}

export function advanceEconomy(current: EconomySnapshot, tick: number): EconomySnapshot {
  return {
    cycle: current.cycle + 1,
    locations: {
      'ARC-01': advanceLocation(current.locations['ARC-01'], tick, 0),
      'ARC-02': advanceLocation(current.locations['ARC-02'], tick, 1),
      'ARC-03': advanceLocation(current.locations['ARC-03'], tick, 2),
    },
  }
}

export function registerEconomyResources(provider: MockDataProvider): void {
  provider.register({ key: economyKey, initial: initialEconomySnapshot(), intervalMs: 1400, update: advanceEconomy })
}
