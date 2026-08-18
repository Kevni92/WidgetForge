<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRaw } from 'vue'
import { replacePane, type PaneNode, type SplitPane } from '../core/pane'
import { resizePaneSplitWeights } from '../core/pane-layout'
import type { WidgetLifecycleController } from '../core/widget-lifecycle'
import type { WidgetRegistry } from '../core/widget-registry'
import WidgetHost from './WidgetHost.vue'

defineOptions({ name: 'PaneHost' })

interface PaneHostProps {
  pane: PaneNode
  registry: WidgetRegistry
  lifecycle?: WidgetLifecycleController | undefined
}

const props = defineProps<PaneHostProps>()
const emit = defineEmits<{
  'update:pane': [pane: PaneNode]
}>()

const registry = toRaw(props.registry)
const rootElement = ref<HTMLElement | null>(null)
let disposeResize: (() => void) | null = null

const backgroundClass = computed(() => {
  const background = props.pane.settings?.background ?? 'transparent'
  return `wf-pane-host--background-${background}`
})

const paneStyle = computed<Record<string, string>>(() => ({
  overflow: props.pane.settings?.overflow ?? 'hidden',
  ...(props.pane.settings?.backgroundColor ? { backgroundColor: props.pane.settings.backgroundColor } : {}),
}))

function splitDirection(split: SplitPane): string {
  return split.axis === 'horizontal' ? 'row' : 'column'
}

function childStyle(split: SplitPane, index: number): Record<string, string> {
  const child = split.children[index]
  const weight = split.weights[index] ?? 1
  const style: Record<string, string> = {
    flexGrow: String(weight),
    flexBasis: '0',
    minWidth: '0',
    minHeight: '0',
  }
  if (!child) return style

  const minSize = child.settings?.minSize
  const maxSize = child.settings?.maxSize
  if (split.axis === 'horizontal') {
    if (minSize !== undefined) style.minWidth = `${minSize}px`
    if (maxSize !== undefined) style.maxWidth = `${maxSize}px`
  } else {
    if (minSize !== undefined) style.minHeight = `${minSize}px`
    if (maxSize !== undefined) style.maxHeight = `${maxSize}px`
  }
  return style
}

function dividerResizable(split: SplitPane, index: number): boolean {
  if (split.settings?.resizable === false) return false
  return split.children[index]?.settings?.resizable !== false
    && split.children[index + 1]?.settings?.resizable !== false
}

function updateChild(childId: string, pane: PaneNode): void {
  emit('update:pane', replacePane(props.pane, childId, pane))
}

function finishResize(): void {
  disposeResize?.()
}

function startResize(event: PointerEvent, split: SplitPane, dividerIndex: number): void {
  if (!dividerResizable(split, dividerIndex) || event.button !== 0) return
  const host = rootElement.value
  const target = event.currentTarget
  if (!host || !(target instanceof HTMLElement)) return

  event.preventDefault()
  finishResize()

  const pointerId = typeof event.pointerId === 'number' ? event.pointerId : undefined
  const startCoordinate = split.axis === 'horizontal' ? event.clientX : event.clientY
  const rect = host.getBoundingClientRect()
  const availablePx = split.axis === 'horizontal' ? rect.width : rect.height
  const startSplit = split

  if (pointerId !== undefined && typeof target.setPointerCapture === 'function') {
    try {
      target.setPointerCapture(pointerId)
    } catch {
      // Global listeners keep the resize session functional without pointer capture.
    }
  }

  const matches = (pointerEvent: PointerEvent): boolean =>
    pointerId === undefined || typeof pointerEvent.pointerId !== 'number' || pointerEvent.pointerId === pointerId

  const onPointerMove = (pointerEvent: PointerEvent): void => {
    if (!matches(pointerEvent)) return
    const coordinate = startSplit.axis === 'horizontal' ? pointerEvent.clientX : pointerEvent.clientY
    const weights = resizePaneSplitWeights(startSplit, dividerIndex, coordinate - startCoordinate, availablePx)
    emit('update:pane', { ...startSplit, weights })
  }

  const cleanup = (): void => {
    globalThis.window.removeEventListener('pointermove', onPointerMove)
    globalThis.window.removeEventListener('pointerup', onPointerEnd)
    globalThis.window.removeEventListener('pointercancel', onPointerEnd)
    if (pointerId !== undefined && typeof target.releasePointerCapture === 'function') {
      try {
        target.releasePointerCapture(pointerId)
      } catch {
        // Capture may already be released by the browser.
      }
    }
    if (disposeResize === cleanup) disposeResize = null
  }

  const onPointerEnd = (pointerEvent: PointerEvent): void => {
    if (!matches(pointerEvent)) return
    cleanup()
  }

  disposeResize = cleanup
  globalThis.window.addEventListener('pointermove', onPointerMove)
  globalThis.window.addEventListener('pointerup', onPointerEnd)
  globalThis.window.addEventListener('pointercancel', onPointerEnd)
}

onBeforeUnmount(finishResize)
</script>

<template>
  <div
    ref="rootElement"
    class="wf-pane-host"
    :class="[backgroundClass, { 'wf-pane-host--split': pane.kind === 'split' }]"
    :data-pane-id="pane.id"
    :data-pane-kind="pane.kind"
    :style="[
      paneStyle,
      pane.kind === 'split' ? { flexDirection: splitDirection(pane) } : {},
    ]"
  >
    <WidgetHost
      v-if="pane.kind === 'widget'"
      class="wf-pane-host__widget"
      :registry="registry"
      :widget-id="pane.widgetId"
      :instance-id="pane.instanceId"
      :parameters="pane.parameters"
      :lifecycle="lifecycle"
    />

    <template v-else>
      <template v-for="(child, index) in pane.children" :key="child.id">
        <div class="wf-pane-host__cell" :style="childStyle(pane, index)">
          <PaneHost
            :pane="child"
            :registry="registry"
            @update:pane="updateChild(child.id, $event)"
          />
        </div>
        <div
          v-if="index < pane.children.length - 1"
          class="wf-pane-host__divider"
          :class="[
            `wf-pane-host__divider--${pane.axis}`,
            { 'wf-pane-host__divider--disabled': !dividerResizable(pane, index) },
          ]"
          :data-pane-divider-index="index"
          :aria-hidden="!dividerResizable(pane, index)"
          @pointerdown="startResize($event, pane, index)"
        />
      </template>
    </template>
  </div>
</template>

<style scoped>
.wf-pane-host {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  color: var(--wf-color-text);
}

.wf-pane-host--split {
  display: flex;
  align-items: stretch;
}

.wf-pane-host--background-transparent { background: transparent; }
.wf-pane-host--background-canvas { background: var(--wf-color-canvas); }
.wf-pane-host--background-surface { background: var(--wf-color-surface); }
.wf-pane-host--background-surface-raised { background: var(--wf-color-surface-raised); }

.wf-pane-host__widget,
.wf-pane-host__cell {
  min-width: 0;
  min-height: 0;
}

.wf-pane-host__widget {
  width: 100%;
  height: 100%;
}

.wf-pane-host__cell {
  position: relative;
  overflow: hidden;
}

.wf-pane-host__divider {
  position: relative;
  z-index: 1;
  flex: 0 0 5px;
  touch-action: none;
  background: transparent;
}

.wf-pane-host__divider::after {
  content: '';
  position: absolute;
  background: var(--wf-color-border);
  opacity: 0.7;
}

.wf-pane-host__divider--horizontal { cursor: ew-resize; }
.wf-pane-host__divider--horizontal::after {
  top: 0;
  bottom: 0;
  left: 2px;
  width: 1px;
}

.wf-pane-host__divider--vertical { cursor: ns-resize; }
.wf-pane-host__divider--vertical::after {
  top: 2px;
  right: 0;
  bottom: auto;
  left: 0;
  height: 1px;
}

.wf-pane-host__divider--disabled {
  cursor: default;
  pointer-events: none;
}
</style>
