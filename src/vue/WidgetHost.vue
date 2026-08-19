<script setup lang="ts">
import { computed, inject, markRaw, onBeforeUnmount, onMounted, provide, shallowRef, toRaw, watch } from 'vue'
import type { WidgetId } from '../core/widget'
import { cloneWidgetAction, validateWidgetAction, WidgetActionDefinitionError, WidgetActionExecutionError, type WidgetAction, type WidgetActionBinding, type WidgetActionExecutionContext, type WidgetActionHandler, type WidgetActionStatePatch } from '../core/widget-actions'
import { createWidgetLifecycle, type WidgetLifecycleController } from '../core/widget-lifecycle'
import { createWidgetViewStateStore, type WidgetViewStateDefinition, type WidgetViewStateValue } from '../core/widget-view-state'
import type { ResolvedWidget, WidgetRegistry } from '../core/widget-registry'
import { widgetActionExecutorKey } from './widget-action-execution'
import { widgetContextKey, type WidgetActionContext, type WidgetContext } from './widget-context'
import { widgetNavigationKey } from './widget-navigation'
import { widgetViewStateContextKey, widgetViewStateHostKey, type WidgetViewStateContext } from './widget-view-state'

interface WidgetHostProps {
  registry: WidgetRegistry
  widgetId: WidgetId
  parameters?: Readonly<Record<string, unknown>>
  instanceId?: string
  lifecycle?: WidgetLifecycleController | undefined
}
interface RuntimeAction { readonly action: WidgetAction; readonly handler?: WidgetActionHandler | undefined }

const emit = defineEmits<{ actionsChange: [bindings: readonly WidgetActionBinding[]] }>()
let nextGeneratedInstanceId = 0
function createGeneratedInstanceId(): string { nextGeneratedInstanceId += 1; return `wf-widget-${nextGeneratedInstanceId}` }

const props = withDefaults(defineProps<WidgetHostProps>(), { parameters: () => ({}) })
const generatedInstanceId = createGeneratedInstanceId()
const instanceId = props.instanceId ?? generatedInstanceId
const externalLifecycle = props.lifecycle ? markRaw(toRaw(props.lifecycle)) : null
const lifecycleController = externalLifecycle ?? markRaw(createWidgetLifecycle(instanceId))
const navigator = inject(widgetNavigationKey, null)
const actionExecutor = inject(widgetActionExecutorKey, null)
const viewStateHost = inject(widgetViewStateHostKey, null)
const runtimeActions = shallowRef<readonly RuntimeAction[]>([])
const actionState = shallowRef<Readonly<Record<string, WidgetActionStatePatch>>>({})

const resolution = computed<{ resolved: ResolvedWidget | null; error: string | null }>(() => {
  try {
    const registry = markRaw(toRaw(props.registry))
    return { resolved: registry.resolve(props.widgetId, props.parameters), error: null }
  } catch (error) {
    return { resolved: null, error: error instanceof Error ? error.message : 'Unable to resolve widget' }
  }
})
const widgetId = computed(() => props.widgetId)
const contextParameters = computed<Readonly<Record<string, unknown>>>(() => resolution.value.resolved?.parameters ?? {})
const component = computed(() => resolution.value.resolved?.manifest.component ?? null)
const manifestActions = computed<readonly WidgetAction[]>(() => resolution.value.resolved?.manifest.actions ?? [])
const actionItems = computed<readonly WidgetAction[]>(() => {
  const combined = [...manifestActions.value, ...runtimeActions.value.map((entry) => entry.action)]
  return combined.map((action) => cloneWidgetAction({ ...action, ...(actionState.value[action.id] ?? {}) } as WidgetAction))
})

const viewStateDefinition: WidgetViewStateDefinition | null = (() => {
  try { return markRaw(toRaw(props.registry)).get(props.widgetId).viewState ?? null }
  catch { return null }
})()
if (viewStateDefinition) {
  const store = viewStateHost?.store ?? createWidgetViewStateStore()
  const scopeId = viewStateHost?.scopeId.value ?? 'default'
  const handle = store.bind(scopeId, instanceId, props.widgetId, viewStateDefinition)
  const context: WidgetViewStateContext<WidgetViewStateValue> = { ...handle, definition: viewStateDefinition }
  provide(widgetViewStateContextKey, context)
}

function hasAction(actionId: string): boolean { return actionItems.value.some((action) => action.id === actionId) }
function registerAction(action: WidgetAction, handler?: WidgetActionHandler): () => void {
  validateWidgetAction(action)
  if (hasAction(action.id)) throw new WidgetActionDefinitionError(`duplicate widget action id "${action.id}"`)
  const entry: RuntimeAction = { action: cloneWidgetAction(action), ...(handler ? { handler } : {}) }
  runtimeActions.value = [...runtimeActions.value, entry]
  return () => { runtimeActions.value = runtimeActions.value.filter((candidate) => candidate !== entry) }
}
function setActionState(actionId: string, patch: WidgetActionStatePatch): void {
  if (!hasAction(actionId)) throw new WidgetActionExecutionError(`unknown widget action "${actionId}"`)
  actionState.value = { ...actionState.value, [actionId]: { ...(actionState.value[actionId] ?? {}), ...patch } }
}
function executionContext(): WidgetActionExecutionContext { return { instanceId, widgetId: widgetId.value, parameters: contextParameters.value } }
function executeAction(actionId: string): void {
  const action = actionItems.value.find((candidate) => candidate.id === actionId)
  if (!action) throw new WidgetActionExecutionError(`unknown widget action "${actionId}"`)
  if (action.disabled || action.visible === false) return
  const runtime = runtimeActions.value.find((candidate) => candidate.action.id === actionId)
  const context = executionContext()
  if (runtime?.handler) { runtime.handler(context); return }
  const target = action.target
  if (!target) throw new WidgetActionExecutionError(`widget action "${actionId}" has no execution target or handler`)
  if (target.kind === 'navigation') {
    if (!navigator) throw new WidgetActionExecutionError(`widget action "${actionId}" requires widget navigation`)
    navigator.navigate(target.intent); return
  }
  if (target.kind === 'command') {
    if (!actionExecutor?.executeCommand) throw new WidgetActionExecutionError(`widget action "${actionId}" requires a command executor`)
    actionExecutor.executeCommand(target.command, context); return
  }
  if (!actionExecutor?.executeCallback) throw new WidgetActionExecutionError(`widget action "${actionId}" requires a callback executor`)
  actionExecutor.executeCallback(target.ref, context)
}
const actions: WidgetActionContext = { items: actionItems, register: registerAction, setState: setActionState, execute: executeAction }
const context: WidgetContext = { instanceId, widgetId, parameters: contextParameters, lifecycle: lifecycleController, actions }
const actionBindings = computed<readonly WidgetActionBinding[]>(() => actionItems.value.map((action) => ({ action, execute: () => executeAction(action.id) })))

provide(widgetContextKey, context)
watch(actionBindings, (bindings) => emit('actionsChange', bindings), { immediate: true })

onMounted(() => { if (!externalLifecycle) lifecycleController.activate(); lifecycleController.mount() })
onBeforeUnmount(() => {
  emit('actionsChange', [])
  lifecycleController.unmount()
  if (externalLifecycle) { if (lifecycleController.state === 'closed') lifecycleController.destroy(); return }
  lifecycleController.close(); lifecycleController.destroy()
})
</script>

<template>
  <div class="wf-widget-host" :data-widget-instance-id="instanceId" :data-widget-id="widgetId">
    <component :is="component" v-if="component" :key="instanceId" />
    <div v-else class="wf-widget-host__error" role="alert">{{ resolution.error }}</div>
  </div>
</template>

<style scoped>
.wf-widget-host{min-width:0;min-height:0}.wf-widget-host__error{padding:var(--wf-space-md);color:var(--wf-color-danger);background:var(--wf-color-surface-raised);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);font-family:var(--wf-font-family);font-size:var(--wf-font-size-sm)}
</style>
