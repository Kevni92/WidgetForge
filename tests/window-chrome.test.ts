import { describe, expect, it } from 'vitest'
import { createWindowOptions, WindowOptionsError } from '../src/core/window-options'

describe('advanced window chrome options', () => {
  it('normalizes serializable icons, badges, status and declarative actions', () => {
    const options = createWindowOptions({
      header: 'hover', chrome: 'borderless', glass: true, icon: ' ◈ ', badge: ' LIVE ', status: ' SYNC ',
      headerActions: [
        { id: 'refresh', label: 'Refresh', side: 'left', icon: '↻', tooltip: 'Refresh data', actionRef: 'demo.refresh' },
        { id: 'pin', label: 'Pin', disabled: true },
      ],
    })
    expect(options).toMatchObject({ header: 'hover', chrome: 'borderless', glass: true, icon: '◈', badge: 'LIVE', status: 'SYNC' })
    expect(options.headerActions).toEqual([
      { id: 'refresh', label: 'Refresh', side: 'left', icon: '↻', tooltip: 'Refresh data', actionRef: 'demo.refresh' },
      { id: 'pin', label: 'Pin', side: 'right', disabled: true },
    ])
    expect(JSON.parse(JSON.stringify(options.headerActions))).toEqual(options.headerActions)
  })

  it('rejects invalid chrome and duplicate action ids', () => {
    expect(() => createWindowOptions({ chrome: 'invalid' as 'default' })).toThrow(WindowOptionsError)
    expect(() => createWindowOptions({ headerActions: [{ id: 'same', label: 'A' }, { id: 'same', label: 'B' }] })).toThrow(WindowOptionsError)
  })
})
