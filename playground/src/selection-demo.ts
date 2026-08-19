import { createSelectionKey } from 'widgetforge'

export const colonySelectionKey = createSelectionKey<string>('colony', 'operations')
export const colonyOptions = ['ARC-01', 'ARC-02', 'ARC-03'] as const
