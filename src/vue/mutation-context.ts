import { inject, onUnmounted, provide, type InjectionKey } from 'vue'
import type {
  MutationClient,
  MutationDefinition,
  MutationHandle,
  MutationInvocationContext,
  MutationStateRef,
} from '../data/mutation-client'

const mutationClientKey: InjectionKey<MutationClient> = Symbol('WidgetForgeMutationClient')

export class MutationClientUnavailableError extends Error {
  constructor() {
    super('WidgetForge mutation client is not available in the current Vue context')
    this.name = 'MutationClientUnavailableError'
  }
}

export interface MutationBinding<Input, Result> {
  readonly definition: MutationDefinition<Input, Result>
  readonly state: MutationStateRef<Result>
  execute(input: Input, context?: MutationInvocationContext): Promise<Result>
  reset(): void
}

export function provideMutationClient(client: MutationClient): void {
  provide(mutationClientKey, client)
}

export function useMutationClient(): MutationClient {
  const client = inject(mutationClientKey)
  if (!client) throw new MutationClientUnavailableError()
  return client
}

export function useMutation<Input, Result>(definition: MutationDefinition<Input, Result>): MutationBinding<Input, Result> {
  const handle: MutationHandle<Input, Result> = useMutationClient().createHandle(definition)
  onUnmounted(handle.release)

  return {
    definition: handle.definition,
    state: handle.state,
    execute: handle.execute,
    reset: handle.reset,
  }
}
