import { describe, expect, it } from 'vitest'
import { advanceEconomy, colonyIds, initialEconomySnapshot } from '../src/economic-domain'

describe('playground economy domain',()=>{
  it('keeps three locations coherent and advances deterministically',()=>{
    const initial=initialEconomySnapshot(),first=advanceEconomy(initial,1),again=advanceEconomy(initial,1)
    expect(Object.keys(initial.locations)).toEqual([...colonyIds])
    expect(first).toEqual(again)
    expect(first.cycle).toBe(initial.cycle+1)
    expect(first.locations['ARC-01'].production[0]?.product).toBe('Ferrite')
    expect(first.locations['ARC-02'].inventory.some((item)=>item.name==='Titanium')).toBe(true)
    expect(first.locations['ARC-03'].orders.some((order)=>order.commodity==='Electronics')).toBe(true)
  })
})
