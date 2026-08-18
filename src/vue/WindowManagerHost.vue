<script setup lang="ts">
import { onBeforeUnmount, shallowRef, toRaw } from 'vue'
import type { WidgetRegistry } from '../core/widget-registry'
import type { WindowManager, WindowState } from '../core/window-manager'
import WindowShell from './WindowShell.vue'

interface WindowManagerHostProps {
  manager: WindowManager
  registry: WidgetRegistry
}

const props = defineProps<WindowManagerHostProps>()
const manager = toRaw(props.manager)
const windows = shallowRef<readonly WindowState[]>(manager.list())

const unsubscribe = manager.subscribe((change) => {
  windows.value = change.windows
})

onBeforeUnmount(unsubscribe)

function focusWindow(instanceId: string): void {
  manager.focus(instanceId, 'user')
}

function closeWindow(instanceId: string): void {
  manager.close(instanceId, 'user')
}

function windowStyle(window: WindowState): Record<string, string> {
  return {
    zIndex: `calc(var(--wf-layer-window) + ${window.zIndex})`,
  }
}
</script>

<template>
  <div class="wf-window-manager-host">
    <div
      v-for="window in windows"
      :key="window.instanceId"
      class="wf-window-manager-host__item"
      :data-window-instance-id="window.instanceId"
      :data-window-z-index="window.zIndex"
      :style="windowStyle(window)"
    >
      <WindowShell
        :registry="registry"
        :widget-id="window.widgetId"
        :instance-id="window.instanceId"
        :parameters="window.parameters"
        :title="window.title"
        :focused="window.focused"
        @focus="focusWindow($event.instanceId)"
        @close="closeWindow($event.instanceId)"
      />
    </div>
  </div>
</template>

<style scoped>
.wf-window-manager-host {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  gap: var(--wf-space-lg);
  position: relative;
}

.wf-window-manager-host__item {
  min-width: 0;
  position: relative;
}
</style>
