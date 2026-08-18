<script setup lang="ts">
import { computed, markRaw, toRaw } from 'vue'
import type { WidgetId } from '../core/widget'
import type { WidgetRegistry } from '../core/widget-registry'
import WidgetHost from './WidgetHost.vue'

interface WindowShellEvent {
  instanceId: string
}

interface WindowShellProps {
  registry: WidgetRegistry
  widgetId: WidgetId
  instanceId: string
  parameters?: Readonly<Record<string, unknown>>
  title?: string
  focused?: boolean
  closable?: boolean
}

const props = withDefaults(defineProps<WindowShellProps>(), {
  parameters: () => ({}),
  title: undefined,
  focused: false,
  closable: true,
})

const emit = defineEmits<{
  focus: [event: WindowShellEvent]
  close: [event: WindowShellEvent]
}>()

const resolvedTitle = computed(() => {
  if (props.title) return props.title

  try {
    return markRaw(toRaw(props.registry)).get(props.widgetId).title
  } catch {
    return props.widgetId
  }
})

function requestFocus(): void {
  emit('focus', { instanceId: props.instanceId })
}

function requestClose(): void {
  emit('close', { instanceId: props.instanceId })
}
</script>

<template>
  <section
    class="wf-window-shell"
    :class="{ 'wf-window-shell--focused': focused }"
    :data-window-instance-id="instanceId"
    :data-focused="focused ? 'true' : 'false'"
    role="region"
    :aria-label="resolvedTitle"
    @pointerdown="requestFocus"
  >
    <header class="wf-window-shell__titlebar" data-window-drag-handle>
      <div class="wf-window-shell__title">
        <slot name="title" :title="resolvedTitle">
          {{ resolvedTitle }}
        </slot>
      </div>
      <div class="wf-window-shell__actions">
        <slot name="actions" />
        <button
          v-if="closable"
          class="wf-window-shell__close"
          type="button"
          aria-label="Close window"
          @pointerdown.stop
          @click.stop="requestClose"
        >
          ×
        </button>
      </div>
    </header>

    <div class="wf-window-shell__content">
      <slot>
        <WidgetHost
          :registry="registry"
          :widget-id="widgetId"
          :instance-id="instanceId"
          :parameters="parameters"
        />
      </slot>
    </div>
  </section>
</template>

<style scoped>
.wf-window-shell {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  color: var(--wf-color-text);
  background: var(--wf-color-surface);
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-md);
  box-shadow: var(--wf-shadow-md);
  font-family: var(--wf-font-family);
}

.wf-window-shell--focused {
  border-color: var(--wf-color-focus);
}

.wf-window-shell__titlebar {
  display: flex;
  min-height: var(--wf-size-titlebar-height);
  align-items: center;
  justify-content: space-between;
  gap: var(--wf-space-sm);
  padding: 0 var(--wf-space-sm) 0 var(--wf-space-md);
  background: var(--wf-color-surface-raised);
  border-bottom: 1px solid var(--wf-color-border);
  user-select: none;
}

.wf-window-shell__title {
  min-width: 0;
  overflow: hidden;
  font-size: var(--wf-font-size-sm);
  font-weight: var(--wf-font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wf-window-shell__actions {
  display: flex;
  align-items: center;
  gap: var(--wf-space-xs);
}

.wf-window-shell__close {
  width: var(--wf-size-control-height);
  height: var(--wf-size-control-height);
  padding: 0;
  color: var(--wf-color-text-muted);
  background: transparent;
  border: 0;
  border-radius: var(--wf-radius-sm);
  font: inherit;
  cursor: pointer;
}

.wf-window-shell__close:hover {
  color: var(--wf-color-text);
  background: var(--wf-color-hover);
}

.wf-window-shell__close:focus-visible {
  outline: 2px solid var(--wf-color-focus);
  outline-offset: -2px;
}

.wf-window-shell__content {
  min-width: 0;
  min-height: 0;
  flex: 1;
  padding: var(--wf-space-md);
}
</style>
