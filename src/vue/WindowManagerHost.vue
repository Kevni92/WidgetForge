<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, toRaw } from 'vue'
import type { WidgetRegistry } from '../core/widget-registry'
import type { WindowSize } from '../core/window-geometry'
import type { WindowManager, WindowState } from '../core/window-manager'
import { observeElementSize } from './observe-element-size'
import WindowFrame from './WindowFrame.vue'

interface WindowManagerHostProps {
  manager: WindowManager
  registry: WidgetRegistry
}

const props = defineProps<WindowManagerHostProps>()
const manager = toRaw(props.manager)
const hostElement = ref<HTMLElement | null>(null)
const containerSize = shallowRef<WindowSize>({ width: 0, height: 0 })
const windows = shallowRef<readonly WindowState[]>(manager.list())
let disposeSizeObserver: (() => void) | null = null

const unsubscribe = manager.subscribe((change) => {
  windows.value = change.windows
  if (change.kind === 'open' && containerSize.value.width > 0 && containerSize.value.height > 0) {
    manager.constrainToContainer(change.instanceId, containerSize.value)
  }
})

onMounted(() => {
  if (!hostElement.value) return

  disposeSizeObserver = observeElementSize(hostElement.value, (size) => {
    containerSize.value = size
    for (const window of manager.list()) {
      manager.constrainToContainer(window.instanceId, size)
    }
  })
})

onBeforeUnmount(() => {
  disposeSizeObserver?.()
  disposeSizeObserver = null
  unsubscribe()
})
</script>

<template>
  <div ref="hostElement" class="wf-window-manager-host">
    <WindowFrame
      v-for="window in windows"
      :key="window.instanceId"
      :window="window"
      :manager="manager"
      :registry="registry"
      :container-size="containerSize"
      :lifecycle="manager.getLifecycle(window.instanceId)"
    />
  </div>
</template>

<style scoped>
.wf-window-manager-host {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
