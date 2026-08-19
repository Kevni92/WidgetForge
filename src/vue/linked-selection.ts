import { computed, type ComputedRef } from 'vue'
import type { SelectionKey } from '../core/selection'
import type { WidgetViewStateValue } from '../core/widget-view-state'
import { useSelection } from './selection-context'
import { useWidgetViewState } from './widget-view-state'

export interface LinkedSelectionViewState<TSelection extends WidgetViewStateValue> {
  readonly followSelection: boolean
  readonly pinnedSelection: TSelection | null
}

export interface LinkedSelectionAdapter<
  TSelection extends WidgetViewStateValue,
  TViewState extends WidgetViewStateValue,
> {
  read(state: TViewState): LinkedSelectionViewState<TSelection>
  write(state: TViewState, linked: LinkedSelectionViewState<TSelection>): TViewState
}

export interface LinkedSelectionBinding<TSelection extends WidgetViewStateValue> {
  readonly selection: ComputedRef<TSelection | null>
  readonly globalSelection: ComputedRef<TSelection | null>
  readonly following: ComputedRef<boolean>
  follow(): void
  pin(value?: TSelection | null): void
}

export function useLinkedSelection<
  TSelection extends WidgetViewStateValue,
  TViewState extends WidgetViewStateValue,
>(key: SelectionKey<TSelection>, adapter: LinkedSelectionAdapter<TSelection, TViewState>): LinkedSelectionBinding<TSelection> {
  const source = useSelection(key)
  const viewState = useWidgetViewState<TViewState>()
  const linked = computed(() => adapter.read(viewState.state.value))
  const following = computed(() => linked.value.followSelection)
  const globalSelection = computed<TSelection | null>(() => source.value.value)
  const selection = computed<TSelection | null>(() => following.value ? globalSelection.value : linked.value.pinnedSelection)
  const write = (next: LinkedSelectionViewState<TSelection>): void => viewState.update((state) => adapter.write(state, next))

  return {
    selection,
    globalSelection,
    following,
    follow: () => write({ ...linked.value, followSelection: true }),
    pin: (value = globalSelection.value) => write({ followSelection: false, pinnedSelection: value }),
  }
}
