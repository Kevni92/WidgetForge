<script setup lang="ts">
import { markRaw, onBeforeUnmount, ref, toRaw } from 'vue'
import type { WidgetRegistry } from '../core/widget-registry'
import {
  moveWindow,
  resizeWindow,
  type ResizeHandle,
  type WindowGeometry,
  type WindowSize,
} from '../core/window-geometry'
import type { WindowManager, WindowState } from '../core/window-manager'
import WindowShell from './WindowShell.vue'

interface WindowFrameProps {
  window: WindowState
  manager: WindowManager
  registry: WidgetRegistry
  containerSize: WindowSize
}

interface InteractionSession {
  pointerId: number | undefined
  captureTarget: HTMLElement
  startX: number
  startY: number
  startGeometry: WindowGeometry
  handle: ResizeHandle | null
}

const props = defineProps<WindowFrameProps>()
const manager = toRaw(props.manager)
const lifecycle = markRaw(manager.getLifecycle(props.window.instanceId))
const interactionKind = ref<'move' | 'resize' | null>(null)
let disposeInteraction: (() => void) | null = null

const resizeHandles: readonly ResizeHandle[] = [
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]

function effectiveContainerSize(): WindowSize {
  if (props.containerSize.width > 0 && props.containerSize.height > 0) return props.containerSize
  return { width: 1_000_000, height: 1_000_000 }
}

function frameStyle(): Record<string, string> {
  const { geometry, zIndex, mode } = props.window
  return {
    left: `${geometry.position.x}px`,
    top: `${geometry.position.y}px`,
    width: `${geometry.size.width}px`,
    height: mode === 'minimized' ? 'var(--wf-size-titlebar-height)' : `${geometry.size.height}px`,
    zIndex: `calc(var(--wf-layer-window) + ${zIndex})`,
  }
}

function finishInteraction(): void {
  disposeInteraction?.()
}

function startInteraction(event: PointerEvent): void {
  if (props.window.mode === 'minimized') return

  const target = event.target
  if (!(target instanceof HTMLElement)) return
  if (target.closest('button, input, select, textarea, a')) return

  const resizeElement = target.closest<HTMLElement>('[data-window-resize-handle]')
  const dragElement = target.closest<HTMLElement>('[data-window-drag-handle]')
  if (!resizeElement && !dragElement) return

  const handle = resizeElement?.dataset.windowResizeHandle as ResizeHandle | undefined
  if (resizeElement && !handle) return

  event.preventDefault()
  finishInteraction()
  manager.focus(props.window.instanceId, 'user')

  const session: InteractionSession = {
    pointerId: typeof event.pointerId === 'number' ? event.pointerId : undefined,
    captureTarget: target,
    startX: event.clientX,
    startY: event.clientY,
    startGeometry: {
      position: { ...props.window.geometry.position },
      size: { ...props.window.geometry.size },
    },
    handle: handle ?? null,
  }

  interactionKind.value = session.handle ? 'resize' : 'move'

  if (session.pointerId !== undefined && typeof session.captureTarget.setPointerCapture === 'function') {
    try {
      session.captureTarget.setPointerCapture(session.pointerId)
    } catch {
      // Pointer capture is an enhancement; global listeners keep the session functional.
    }
  }

  const pointerMatches = (pointerEvent: PointerEvent): boolean =>
    session.pointerId === undefined || typeof pointerEvent.pointerId !== 'number' || pointerEvent.pointerId === session.pointerId

  const onPointerMove = (pointerEvent: PointerEvent): void => {
    if (!pointerMatches(pointerEvent)) return
    const delta = {
      x: pointerEvent.clientX - session.startX,
      y: pointerEvent.clientY - session.startY,
    }
    const geometry = session.handle
      ? resizeWindow(
          session.startGeometry,
          session.handle,
          delta,
          props.window.constraints,
          effectiveContainerSize(),
        )
      : moveWindow(session.startGeometry, delta, effectiveContainerSize())

    manager.setGeometry(props.window.instanceId, geometry, 'user')
  }

  const cleanup = (): void => {
    globalThis.window.removeEventListener('pointermove', onPointerMove)
    globalThis.window.removeEventListener('pointerup', onPointerEnd)
    globalThis.window.removeEventListener('pointercancel', onPointerEnd)

    if (session.pointerId !== undefined && typeof session.captureTarget.releasePointerCapture === 'function') {
      try {
        session.captureTarget.releasePointerCapture(session.pointerId)
      } catch {
        // The browser may already have released capture.
      }
    }

    if (disposeInteraction === cleanup) disposeInteraction = null
    interactionKind.value = null
  }

  const onPointerEnd = (pointerEvent: PointerEvent): void => {
    if (!pointerMatches(pointerEvent)) return
    cleanup()
  }

  disposeInteraction = cleanup
  globalThis.window.addEventListener('pointermove', onPointerMove)
  globalThis.window.addEventListener('pointerup', onPointerEnd)
  globalThis.window.addEventListener('pointercancel', onPointerEnd)
}

function focusWindow(): void {
  manager.focus(props.window.instanceId, 'user')
}

function closeWindow(): void {
  finishInteraction()
  manager.close(props.window.instanceId, 'user')
}

function minimizeWindow(): void {
  finishInteraction()
  manager.minimize(props.window.instanceId, 'user')
}

function restoreWindow(): void {
  manager.restore(props.window.instanceId, 'user')
}

onBeforeUnmount(finishInteraction)
</script>

<template>
  <div
    class="wf-window-frame"
    :class="{
      'wf-window-frame--interacting': interactionKind,
      'wf-window-frame--minimized': window.mode === 'minimized',
    }"
    :data-window-instance-id="window.instanceId"
    :data-window-z-index="window.zIndex"
    :data-window-mode="window.mode"
    :data-window-interaction="interactionKind ?? 'none'"
    :style="frameStyle()"
    @pointerdown.capture="startInteraction"
  >
    <WindowShell
      :registry="registry"
      :widget-id="window.widgetId"
      :instance-id="window.instanceId"
      :parameters="window.parameters"
      :title="window.title"
      :focused="window.focused"
      :minimized="window.mode === 'minimized'"
      :lifecycle="lifecycle"
      @focus="focusWindow"
      @close="closeWindow"
      @minimize="minimizeWindow"
      @restore="restoreWindow"
    />

    <template v-if="window.mode === 'normal'">
      <div
        v-for="handle in resizeHandles"
        :key="handle"
        class="wf-window-frame__resize-handle"
        :class="`wf-window-frame__resize-handle--${handle}`"
        :data-window-resize-handle="handle"
        aria-hidden="true"
      />
    </template>
  </div>
</template>

<style scoped>
.wf-window-frame {
  position: absolute;
  min-width: 0;
  min-height: 0;
  touch-action: none;
}

.wf-window-frame :deep(.wf-window-shell) {
  width: 100%;
  height: 100%;
}

.wf-window-frame :deep([data-window-drag-handle]) {
  cursor: move;
}

.wf-window-frame--minimized :deep([data-window-drag-handle]) {
  cursor: default;
}

.wf-window-frame__resize-handle {
  position: absolute;
  z-index: 2;
  touch-action: none;
}

.wf-window-frame__resize-handle--top,
.wf-window-frame__resize-handle--bottom {
  right: 8px;
  left: 8px;
  height: 8px;
  cursor: ns-resize;
}

.wf-window-frame__resize-handle--top { top: -4px; }
.wf-window-frame__resize-handle--bottom { bottom: -4px; }

.wf-window-frame__resize-handle--left,
.wf-window-frame__resize-handle--right {
  top: 8px;
  bottom: 8px;
  width: 8px;
  cursor: ew-resize;
}

.wf-window-frame__resize-handle--left { left: -4px; }
.wf-window-frame__resize-handle--right { right: -4px; }

.wf-window-frame__resize-handle--top-left,
.wf-window-frame__resize-handle--top-right,
.wf-window-frame__resize-handle--bottom-left,
.wf-window-frame__resize-handle--bottom-right {
  width: 12px;
  height: 12px;
}

.wf-window-frame__resize-handle--top-left { top: -5px; left: -5px; cursor: nwse-resize; }
.wf-window-frame__resize-handle--top-right { top: -5px; right: -5px; cursor: nesw-resize; }
.wf-window-frame__resize-handle--bottom-left { bottom: -5px; left: -5px; cursor: nesw-resize; }
.wf-window-frame__resize-handle--bottom-right { right: -5px; bottom: -5px; cursor: nwse-resize; }
</style>
