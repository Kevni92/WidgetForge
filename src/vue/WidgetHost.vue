<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, provide, toRaw } from 'vue'
import type { WidgetId } from '../core/widget'
import { createWidgetLifecycle, type WidgetLifecycleController } from '../core/widget-lifecycle'
import type { ResolvedWidget, WidgetRegistry } from '../core/widget-registry'
import { widgetContextKey, type WidgetContext } from './widget-context'

interface WidgetHostProps {
  registry: WidgetRegistry
  widgetId: WidgetId
  parameters?: Readonly<Record<string, unknown>>
  instanceId?: string
  lifecycle?: WidgetLifecycleController
}

let nextGeneratedInstanceId = 0

function createGeneratedInstanceId(): string {
  nextGeneratedInstanceId += 1
  return `wf-widget-${nextGeneratedInstanceId}`
}

const props = withDefaults(defineProps<WidgetHostProps>(), {
  parameters: () => ({}),
})

const generatedInstanceId = createGeneratedInstanceId()
const instanceId = props.instanceId ?? generatedInstanceId
const externalLifecycle = props.lifecycle ? markRaw(toRaw(props.lifecycle)) : null
const lifecycleController = externalLifecycle ?? markRaw(createWidgetLifecycle(instanceId))

const resolution = computed<{ resolved: ResolvedWidget | null; error: string | null }>(() => {
  try {
    const registry = markRaw(toRaw(props.registry))
    return {
      resolved: registry.resolve(props.widgetId, props.parameters),
      error: null,
    }
  } catch (error) {
    return {
      resolved: null,
      error: error instanceof Error ? error.message : 'Unable to resolve widget',
    }
  }
})

const widgetId = computed(() => props.widgetId)
const contextParameters = computed<Readonly<Record<string, unknown>>>(
  () => resolution.value.resolved?.parameters ?? {},
)
const component = computed(() => resolution.value.resolved?.manifest.component ?? null)

const context: WidgetContext = {
  instanceId,
  widgetId,
  parameters: contextParameters,
  lifecycle: lifecycleController,
}

provide(widgetContextKey, context)

onMounted(() => {
  if (!externalLifecycle) lifecycleController.activate()
  lifecycleController.mount()
})

onBeforeUnmount(() => {
  lifecycleController.unmount()

  if (externalLifecycle) {
    if (lifecycleController.state === 'closed') lifecycleController.destroy()
    return
  }

  lifecycleController.close()
  lifecycleController.destroy()
})
</script>

<template>
  <div class="wf-widget-host" :data-widget-instance-id="instanceId" :data-widget-id="widgetId">
    <component :is="component" v-if="component" :key="instanceId" />
    <div v-else class="wf-widget-host__error" role="alert">
      {{ resolution.error }}
    </div>
  </div>
</template>

<style scoped>
.wf-widget-host {
  min-width: 0;
  min-height: 0;
}

.wf-widget-host__error {
  padding: var(--wf-space-md);
  color: var(--wf-color-danger);
  background: var(--wf-color-surface-raised);
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-sm);
  font-family: var(--wf-font-family);
  font-size: var(--wf-font-size-sm);
}
</style>
