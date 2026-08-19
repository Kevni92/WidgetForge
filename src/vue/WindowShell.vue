<script setup lang="ts">
import { computed, markRaw, ref, toRaw } from 'vue'
import { createWidgetPane, type PaneNode } from '../core/pane'
import type { WidgetId } from '../core/widget'
import type { WidgetLifecycleController } from '../core/widget-lifecycle'
import type { WidgetRegistry } from '../core/widget-registry'
import type { WindowChromeMode, WindowHeaderAction, WindowHeaderMode, WindowRole } from '../core/window-options'
import type { WindowSnapZone } from '../core/window-snap'
import PaneHost from './PaneHost.vue'
import WindowSnapLayoutPicker from './WindowSnapLayoutPicker.vue'

interface WindowShellEvent { instanceId: string }
interface WindowShellProps {
  registry: WidgetRegistry
  pane?: PaneNode
  widgetId?: WidgetId
  instanceId: string
  parameters?: Readonly<Record<string, string | number | boolean>>
  title?: string
  focused?: boolean
  closable?: boolean
  minimizable?: boolean
  maximizable?: boolean
  minimized?: boolean
  maximized?: boolean
  movable?: boolean
  header?: WindowHeaderMode
  chrome?: WindowChromeMode
  glass?: boolean
  icon?: string
  badge?: string
  status?: string
  headerActions?: readonly WindowHeaderAction[]
  windowRole?: WindowRole
  lifecycle?: WidgetLifecycleController | undefined
  layoutLocked?: boolean
}

const props = withDefaults(defineProps<WindowShellProps>(), {
  parameters: () => ({}),
  focused: false,
  closable: true,
  minimizable: true,
  maximizable: true,
  minimized: false,
  maximized: false,
  movable: true,
  header: 'always',
  chrome: 'default',
  glass: false,
  headerActions: () => [],
  windowRole: 'normal',
  layoutLocked: false,
})
const emit = defineEmits<{
  focus: [event: WindowShellEvent]
  close: [event: WindowShellEvent]
  minimize: [event: WindowShellEvent]
  maximize: [event: WindowShellEvent]
  restore: [event: WindowShellEvent]
  snap: [zone: WindowSnapZone]
  headerAction: [action: WindowHeaderAction]
  'update:pane': [pane: PaneNode]
}>()
const layoutPickerOpen = ref(false)
const hovered = ref(false)
const contentPane = computed<PaneNode | null>(() => {
  if (props.pane) return props.pane
  if (!props.widgetId) return null
  return createWidgetPane({ id: `${props.instanceId}.root`, widgetId: props.widgetId, instanceId: props.instanceId, parameters: props.parameters })
})
const showHeader = computed(() => props.header === 'always' || (props.header === 'focused' && props.focused) || (props.header === 'hover' && hovered.value))
const leftHeaderActions = computed(() => props.headerActions.filter((action) => action.side === 'left'))
const rightHeaderActions = computed(() => props.headerActions.filter((action) => action.side === 'right'))
const resolvedTitle = computed(() => {
  if (props.title) return props.title
  const pane = contentPane.value
  if (!pane) return 'Window'
  if (pane.kind !== 'widget') return 'Workspace'
  try { return markRaw(toRaw(props.registry)).get(pane.widgetId).title } catch { return pane.widgetId }
})
const ariaRole = computed(() => props.windowRole === 'modal' ? 'dialog' : 'region')
function requestFocus(): void { emit('focus', { instanceId: props.instanceId }) }
function requestClose(): void { layoutPickerOpen.value = false; emit('close', { instanceId: props.instanceId }) }
function toggleMinimized(): void { layoutPickerOpen.value = false; const event = { instanceId: props.instanceId }; if (props.minimized) emit('restore', event); else emit('minimize', event) }
function toggleLayoutPicker(): void { if (props.layoutLocked) return; if (props.maximized) { emit('restore', { instanceId: props.instanceId }); return } layoutPickerOpen.value = !layoutPickerOpen.value }
function openLayoutPicker(): void { if (!props.layoutLocked && !props.maximized) layoutPickerOpen.value = true }
function selectLayout(layout: WindowSnapZone | 'maximize'): void { layoutPickerOpen.value = false; if (layout === 'maximize') emit('maximize', { instanceId: props.instanceId }); else emit('snap', layout) }
function closePicker(): void { layoutPickerOpen.value = false }
function requestHeaderAction(action: WindowHeaderAction): void { if (!action.disabled) emit('headerAction', { ...action }) }
function setHovered(value: boolean): void { hovered.value = value; if (!value && props.header === 'hover') layoutPickerOpen.value = false }
</script>

<template>
  <section
    class="wf-window-shell"
    :class="[
      `wf-window-shell--role-${windowRole}`,
      `wf-window-shell--chrome-${chrome}`,
      {
        'wf-window-shell--focused': focused,
        'wf-window-shell--minimized': minimized,
        'wf-window-shell--maximized': maximized,
        'wf-window-shell--headerless': !showHeader,
        'wf-window-shell--glass': glass,
      },
    ]"
    :data-window-instance-id="instanceId"
    :data-focused="focused ? 'true' : 'false'"
    :data-window-role="windowRole"
    :data-window-mode="minimized ? 'minimized' : maximized ? 'maximized' : 'normal'"
    :data-window-header="header"
    :data-window-chrome="chrome"
    :data-window-glass="glass || undefined"
    :role="ariaRole"
    :aria-modal="windowRole === 'modal' ? 'true' : undefined"
    :aria-label="resolvedTitle"
    :aria-expanded="minimized ? 'false' : 'true'"
    @mouseenter="setHovered(true)"
    @mouseleave="setHovered(false)"
    @pointerdown="requestFocus"
  >
    <header v-if="showHeader" class="wf-window-shell__titlebar" :data-window-drag-handle="movable && !maximized ? '' : undefined">
      <div class="wf-window-shell__leading">
        <button
          v-for="action in leftHeaderActions"
          :key="action.id"
          class="wf-window-shell__header-action"
          type="button"
          :data-window-header-action="action.id"
          :aria-label="action.label"
          :title="action.tooltip ?? action.label"
          :disabled="action.disabled"
          @pointerdown.stop
          @click.stop="requestHeaderAction(action)"
        >{{ action.icon ?? action.label }}</button>
        <span v-if="icon" class="wf-window-shell__icon" aria-hidden="true">{{ icon }}</span>
        <div class="wf-window-shell__title"><slot name="title" :title="resolvedTitle">{{ resolvedTitle }}</slot></div>
        <span v-if="badge" class="wf-window-shell__badge">{{ badge }}</span>
      </div>
      <div class="wf-window-shell__actions">
        <span v-if="status" class="wf-window-shell__status">{{ status }}</span>
        <button
          v-for="action in rightHeaderActions"
          :key="action.id"
          class="wf-window-shell__header-action"
          type="button"
          :data-window-header-action="action.id"
          :aria-label="action.label"
          :title="action.tooltip ?? action.label"
          :disabled="action.disabled"
          @pointerdown.stop
          @click.stop="requestHeaderAction(action)"
        >{{ action.icon ?? action.label }}</button>
        <slot name="actions" />
        <button v-if="minimizable" class="wf-window-shell__minimize" type="button" :aria-label="minimized ? 'Restore window' : 'Minimize window'" @pointerdown.stop @click.stop="toggleMinimized">{{ minimized ? '□' : '−' }}</button>
        <div v-if="maximizable && !minimized" class="wf-window-shell__layout-action" @mouseenter="openLayoutPicker">
          <button class="wf-window-shell__maximize" type="button" :aria-label="maximized ? 'Restore window' : 'Window layouts'" :aria-expanded="layoutPickerOpen" @pointerdown.stop @focus="openLayoutPicker" @click.stop="toggleLayoutPicker">{{ maximized ? '❐' : '□' }}</button>
          <WindowSnapLayoutPicker v-if="layoutPickerOpen" @select="selectLayout" @close="closePicker" />
        </div>
        <button v-if="closable" class="wf-window-shell__close" type="button" aria-label="Close window" @pointerdown.stop @click.stop="requestClose">×</button>
      </div>
    </header>
    <div v-show="!minimized" class="wf-window-shell__content" :aria-hidden="minimized ? 'true' : undefined">
      <slot><PaneHost v-if="contentPane" :pane="contentPane" :registry="registry" :lifecycle="lifecycle" :layout-locked="layoutLocked" @update:pane="emit('update:pane', $event)" /></slot>
    </div>
  </section>
</template>

<style scoped>
.wf-window-shell{display:flex;min-width:0;min-height:0;flex-direction:column;overflow:visible;color:var(--wf-color-text);background:var(--wf-color-surface);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-md);box-shadow:var(--wf-shadow-md);font-family:var(--wf-font-family)}
.wf-window-shell--focused{border-color:var(--wf-color-focus)}
.wf-window-shell--maximized{border-radius:0}
.wf-window-shell--role-utility{box-shadow:var(--wf-shadow-sm)}
.wf-window-shell--role-overlay{background:var(--wf-color-surface-raised);box-shadow:var(--wf-shadow-sm)}
.wf-window-shell--role-modal{box-shadow:var(--wf-shadow-lg)}
.wf-window-shell--chrome-borderless{border-color:transparent}
.wf-window-shell--chrome-none{border-color:transparent;border-radius:0;box-shadow:none}
.wf-window-shell--glass{background:color-mix(in srgb,var(--wf-color-surface) 78%,transparent);backdrop-filter:blur(10px)}
.wf-window-shell__titlebar{display:flex;min-height:var(--wf-size-titlebar-height);align-items:center;justify-content:space-between;gap:var(--wf-space-sm);padding:0 var(--wf-space-sm) 0 var(--wf-space-md);background:var(--wf-color-surface-raised);border-bottom:1px solid var(--wf-color-border);user-select:none}
.wf-window-shell--glass .wf-window-shell__titlebar{background:color-mix(in srgb,var(--wf-color-surface-raised) 78%,transparent)}
.wf-window-shell--chrome-borderless .wf-window-shell__titlebar,.wf-window-shell--chrome-none .wf-window-shell__titlebar{border-bottom-color:transparent}
.wf-window-shell--minimized .wf-window-shell__titlebar{border-bottom:0}
.wf-window-shell__leading,.wf-window-shell__actions{display:flex;min-width:0;align-items:center;gap:var(--wf-space-xs)}
.wf-window-shell__leading{flex:1}
.wf-window-shell__title{min-width:0;overflow:hidden;font-size:var(--wf-font-size-sm);font-weight:var(--wf-font-weight-medium);text-overflow:ellipsis;white-space:nowrap}
.wf-window-shell__icon{flex:0 0 auto;color:var(--wf-color-accent)}
.wf-window-shell__badge{flex:0 0 auto;padding:1px var(--wf-space-xs);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);color:var(--wf-color-accent);font-size:var(--wf-font-size-xs)}
.wf-window-shell__status{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);white-space:nowrap}
.wf-window-shell__actions{position:relative}
.wf-window-shell__layout-action{position:relative}
.wf-window-shell__header-action,.wf-window-shell__minimize,.wf-window-shell__maximize,.wf-window-shell__close{min-width:var(--wf-size-control-height);height:var(--wf-size-control-height);padding:0 var(--wf-space-xs);color:var(--wf-color-text-muted);background:transparent;border:0;border-radius:var(--wf-radius-sm);font:inherit;cursor:pointer}
.wf-window-shell__header-action:hover:not(:disabled),.wf-window-shell__minimize:hover,.wf-window-shell__maximize:hover,.wf-window-shell__close:hover{color:var(--wf-color-text);background:var(--wf-color-hover)}
.wf-window-shell__header-action:focus-visible,.wf-window-shell__minimize:focus-visible,.wf-window-shell__maximize:focus-visible,.wf-window-shell__close:focus-visible{outline:2px solid var(--wf-color-focus);outline-offset:-2px}
.wf-window-shell__header-action:disabled{cursor:default;opacity:.5}
.wf-window-shell__content{min-width:0;min-height:0;flex:1;padding:var(--wf-space-md);overflow:hidden}
.wf-window-shell__content :deep(.wf-pane-host){width:100%;height:100%}
</style>
