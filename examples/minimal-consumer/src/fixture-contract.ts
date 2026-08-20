import { createDataKey, createMutationDefinition } from 'widgetforge'

export const demoResource = createDataKey<{ label: string; value: number }>('example.resource', 'one')
export const demoMutation = createMutationDefinition<{ value: number }, { accepted: boolean }>('example.mutation')
