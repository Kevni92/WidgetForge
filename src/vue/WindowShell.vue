<script setup lang="ts">
import { computed, markRaw, ref, shallowRef, toRaw } from 'vue'
import { createWidgetPane, type PaneNode } from '../core/pane'
import type { WidgetId } from '../core/widget'
import type { WidgetActionBinding } from '../core/widget-actions'
import type { WidgetLifecycleController } from '../core/widget-lifecycle'
import type { WidgetRegistry } from '../core/widget-registry'
import type { CommandRegistry } from '../core/commands'
import type { WidgetNavigationContext, WidgetNavigator } from '../core/navigation'
import type { DockPosition } from '../core/dock-manager'
import type { WindowChromeMode, WindowHeaderAction, WindowHeaderActionInput, WindowHeaderMode, WindowRole } from '../core/window-options'
import type { WindowSnapZone } from '../core/window-snap'
import type { WindowLayoutRuleState, WindowLayoutSurfaceState } from '../core/window-layout'
import PaneHost from './PaneHost.vue'
import CommandLauncher from './CommandLauncher.vue'
import WidgetActionToolbar from './WidgetActionToolbar.vue'
import WindowDockPicker from './WindowDockPicker.vue'

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
  windowLocked?: boolean
  movable?: boolean
  header?: WindowHeaderMode
  chrome?: WindowChromeMode
  glass?: boolean
  icon?: string | undefined
  badge?: string | undefined
  status?: string | undefined
  headerActions?: readonly WindowHeaderActionInput[]
  windowRole?: WindowRole
  lifecycle?: WidgetLifecycleController | undefined
  layoutLocked?: boolean
  editMode?: boolean
  layoutSurface?: WindowLayoutSurfaceState | undefined
  layoutRule?: WindowLayoutRuleState | undefined
  snapZone?: WindowSnapZone | null | undefined
  paneDragEnabled?: (paneId: string) => boolean
  dockable?: boolean
  commandRegistry?: CommandRegistry | undefined
  launcherNavigator?: WidgetNavigator | undefined
  launcherContext?: WidgetNavigationContext | undefined
  launcherPlaceholder?: string | undefined
  launcherSubmitLabel?: string | undefined
  onLauncherClose?: (() => void) | undefined
}

const props = withDefaults(defineProps<WindowShellProps>(), {
  parameters: () => ({}), focused: false, closable: true, minimizable: true, maximizable: true,
  minimized: false, maximized: false, windowLocked: false, movable: true, header: 'always', chrome: 'default', glass: false,
  headerActions: () => [], windowRole: 'normal', layoutLocked: false, editMode: false, paneDragEnabled: () => true, dockable: false,
})
const emit = defineEmits<{
  focus: [event: WindowShellEvent]
  close: [event: WindowShellEvent]
  minimize: [event: WindowShellEvent]
  maximize: [event: WindowShellEvent]
  restore: [event: WindowShellEvent]
  lock: [event: WindowShellEvent]
  snap: [zone: WindowSnapZone]
  headerAction: [action: WindowHeaderAction]
  'update:pane': [pane: PaneNode]
  dock: [position: DockPosition]
}>()
const dockPickerOpen = ref(false)
const hovered = ref(false)
const widgetActions = shallowRef<readonly WidgetActionBinding[]>([])
const contentPane = computed<PaneNode | null>(() => {
  if (props.pane) return props.pane
  if (!props.widgetId) return null
  return createWidgetPane({ id: `${props.instanceId}.root`, widgetId: props.widgetId, instanceId: props.instanceId, parameters: props.parameters })
})
const isLauncher = computed(() => contentPane.value?.kind === 'widget' && contentPane.value.widgetId === '@widgetforge/command-launcher')
const showHeader = computed(() => props.header === 'always' || (props.header === 'focused' && props.focused) || (props.header === 'hover' && hovered.value))
const normalizedHeaderActions = computed<readonly WindowHeaderAction[]>(() => props.headerActions.map((action) => ({ ...action, side: action.side ?? 'right' })))
const leftHeaderActions = computed(() => normalizedHeaderActions.value.filter((action) => action.side === 'left'))
const rightHeaderActions = computed(() => normalizedHeaderActions.value.filter((action) => action.side === 'right'))
const hasVisibleWidgetActions = computed(() => contentPane.value?.kind === 'widget' && widgetActions.value.some((binding) => binding.action.visible !== false))
const resolvedTitle = computed(() => {
  if (props.title) return props.title
  const pane = contentPane.value
  if (!pane) return 'Window'
  if (pane.kind !== 'widget') return 'Workspace'
  try { return markRaw(toRaw(props.registry)).get(pane.widgetId).title } catch { return pane.widgetId }
})
const ariaRole = computed(() => props.windowRole === 'modal' ? 'dialog' : 'region')
const visualFocused = computed(() => props.focused && !props.windowLocked)
const lockLabel = computed(() => props.snapZone ? 'Adopt snap as layout' : props.layoutRule === 'dormant' ? 'Reactivate responsive layout' : 'Lock window')
function requestFocus(): void { emit('focus', { instanceId: props.instanceId }) }
function requestLock(): void { if (props.editMode && !props.windowLocked) emit('lock', { instanceId: props.instanceId }) }
function requestClose(): void { dockPickerOpen.value = false; emit('close', { instanceId: props.instanceId }) }
function toggleMinimized(): void { dockPickerOpen.value = false; const event = { instanceId: props.instanceId }; if (props.minimized) emit('restore', event); else emit('minimize', event) }
function toggleDockPicker(): void { if (!props.layoutLocked && props.dockable && !props.minimized) dockPickerOpen.value = !dockPickerOpen.value }
function selectDock(position: DockPosition): void { dockPickerOpen.value = false; emit('dock', position) }
function closeDockPicker(): void { dockPickerOpen.value = false }
function requestHeaderAction(action: WindowHeaderAction): void { if (!action.disabled) emit('headerAction', { ...action }) }
function setWidgetActions(bindings:readonly WidgetActionBinding[]):void{widgetActions.value=bindings}
function setHovered(value: boolean): void { hovered.value = value }
function closeLauncher(): void { props.onLauncherClose?.() }
</script>

<template>
  <section class="wf-window-shell" :class="[`wf-window-shell--role-${windowRole}`,`wf-window-shell--chrome-${chrome}`,{'wf-window-shell--focused':visualFocused,'wf-window-shell--minimized':minimized,'wf-window-shell--maximized':maximized,'wf-window-shell--layout-locked':windowLocked,'wf-window-shell--headerless':!showHeader || windowLocked,'wf-window-shell--glass':glass}]" :data-window-instance-id="instanceId" :data-focused="focused ? 'true' : 'false'" :data-window-visual-focused="visualFocused ? 'true' : 'false'" :data-window-role="windowRole" :data-window-mode="minimized ? 'minimized' : maximized ? 'maximized' : 'normal'" :data-window-locked="windowLocked || undefined" :data-window-header="header" :data-window-chrome="chrome" :data-window-glass="glass || undefined" :role="ariaRole" :aria-modal="windowRole === 'modal' ? 'true' : undefined" :aria-label="resolvedTitle" :aria-expanded="minimized ? 'false' : 'true'" :tabindex="-1" @mouseenter="setHovered(true)" @mouseleave="setHovered(false)" @pointerdown="requestFocus">
    <div class="wf-window-shell__surface">
    <header v-if="showHeader && !windowLocked" class="wf-window-shell__titlebar" :data-window-drag-handle="movable && !maximized ? '' : undefined">
      <div class="wf-window-shell__leading">
        <button v-for="action in leftHeaderActions" :key="action.id" class="wf-window-shell__header-action" type="button" :data-window-header-action="action.id" :aria-label="action.label" :title="action.tooltip ?? action.label" :disabled="action.disabled" @pointerdown.stop @click.stop="requestHeaderAction(action)"><span v-if="action.icon" class="wf-window-shell__action-icon" aria-hidden="true">{{ action.icon }}</span><span v-else>{{ action.label }}</span></button>
        <span v-if="icon" class="wf-window-shell__icon" aria-hidden="true">{{ icon }}</span>
        <div class="wf-window-shell__title"><slot name="title" :title="resolvedTitle">{{ resolvedTitle }}</slot></div>
        <span v-if="badge" class="wf-window-shell__badge">{{ badge }}</span>
      </div>
      <div class="wf-window-shell__actions">
        <span v-if="status" class="wf-window-shell__status">{{ status }}</span>
        <WidgetActionToolbar v-if="hasVisibleWidgetActions" :bindings="widgetActions" :max-visible="3" compact :aria-label="`${resolvedTitle} actions`"/>
        <button v-for="action in rightHeaderActions" :key="action.id" class="wf-window-shell__header-action" type="button" :data-window-header-action="action.id" :aria-label="action.label" :title="action.tooltip ?? action.label" :disabled="action.disabled" @pointerdown.stop @click.stop="requestHeaderAction(action)"><span v-if="action.icon" class="wf-window-shell__action-icon" aria-hidden="true">{{ action.icon }}</span><span v-else>{{ action.label }}</span></button>
        <slot name="actions" />
        <button v-if="editMode && !windowLocked && !minimized" class="wf-window-shell__lock" type="button" data-window-lock :aria-label="lockLabel" :title="lockLabel" @pointerdown.stop @click.stop="requestLock"><span class="wf-window-shell__action-icon" aria-hidden="true">▣</span><span class="wf-window-shell__lock-label">{{ props.snapZone ? 'Als Layout übernehmen' : 'Lock' }}</span></button>
        <div v-if="dockable && !minimized" class="wf-window-shell__dock-action">
          <button class="wf-window-shell__dock" type="button" aria-label="Anchor window to workspace" :aria-expanded="dockPickerOpen" @pointerdown.stop @click.stop="toggleDockPicker"><span class="wf-window-shell__action-icon" aria-hidden="true">⇱</span></button>
          <WindowDockPicker v-if="dockPickerOpen" @select="selectDock" @close="closeDockPicker" />
        </div>
        <button v-if="minimizable" class="wf-window-shell__minimize" type="button" :aria-label="minimized ? 'Restore window' : 'Minimize window'" @pointerdown.stop @click.stop="toggleMinimized"><span class="wf-window-shell__action-icon" aria-hidden="true">{{ minimized ? '□' : '−' }}</span></button>
        <button v-if="closable" class="wf-window-shell__close" type="button" aria-label="Close window" @pointerdown.stop @click.stop="requestClose"><span class="wf-window-shell__action-icon" aria-hidden="true">×</span></button>
      </div>
    </header>
    <div v-show="!minimized" class="wf-window-shell__content" :class="{ 'wf-window-shell__content--layout-edit': editMode }" :aria-hidden="minimized ? 'true' : undefined" :inert="editMode ? true : undefined" :data-layout-content="editMode ? 'dimmed' : undefined">
      <slot><CommandLauncher v-if="isLauncher && launcherNavigator" :commands="commandRegistry" :navigator="launcherNavigator" :context="launcherContext" :placeholder="launcherPlaceholder" :submit-label="launcherSubmitLabel" @close="closeLauncher" /><PaneHost v-else-if="contentPane" :pane="contentPane" :registry="registry" :command-registry="commandRegistry" :lifecycle="lifecycle" :layout-locked="layoutLocked || windowLocked" :edit-mode="editMode" :pane-drag-enabled="paneDragEnabled" host-type="window" action-chrome="none" :host-visible="!minimized" :host-focused="focused" @actions-change="setWidgetActions" @update:pane="emit('update:pane', $event)" /></slot>
    </div>
    </div>
  </section>
</template>

<style scoped>
.wf-window-shell{--wf-window-shell-surface:var(--wf-color-surface-window);--wf-window-shell-border:var(--wf-color-border-strong);--wf-window-shell-shadow:var(--wf-shadow-md);--wf-window-shell-radius:var(--wf-radius-md);--wf-window-shell-border-width:1px;display:flex;min-width:0;min-height:0;flex-direction:column;overflow:visible;color:var(--wf-color-text);background:var(--wf-window-shell-surface);border:var(--wf-window-shell-border-width) solid var(--wf-window-shell-border);border-radius:var(--wf-window-shell-radius);box-shadow:var(--wf-window-shell-shadow);font-family:var(--wf-font-family)}.wf-window-shell__surface{display:flex;min-width:0;min-height:0;flex:1;flex-direction:column;overflow:hidden;border-radius:max(0px,calc(var(--wf-window-shell-radius) - var(--wf-window-shell-border-width)));background:var(--wf-window-shell-surface)}.wf-window-shell--focused{--wf-window-shell-border:var(--wf-color-focus)}.wf-window-shell--maximized{--wf-window-shell-radius:0px}.wf-window-shell--role-utility{--wf-window-shell-surface:var(--wf-color-surface-floating);--wf-window-shell-border:var(--wf-color-border-floating);--wf-window-shell-shadow:var(--wf-shadow-lg)}.wf-window-shell--role-overlay{--wf-window-shell-surface:var(--wf-color-surface-overlay);--wf-window-shell-border:var(--wf-color-border-overlay);--wf-window-shell-shadow:var(--wf-shadow-lg)}.wf-window-shell--role-modal{--wf-window-shell-surface:var(--wf-color-surface-modal);--wf-window-shell-border:var(--wf-color-border-modal);--wf-window-shell-shadow:var(--wf-shadow-lg)}.wf-window-shell--chrome-borderless{--wf-window-shell-border:transparent}.wf-window-shell--chrome-none{--wf-window-shell-border:transparent;--wf-window-shell-radius:0px;--wf-window-shell-shadow:none}.wf-window-shell--glass{--wf-window-shell-surface:color-mix(in srgb,var(--wf-color-surface-window) 78%,transparent);backdrop-filter:blur(10px)}.wf-window-shell__titlebar{display:flex;min-height:var(--wf-size-titlebar-height);align-items:center;justify-content:space-between;gap:var(--wf-space-sm);padding:0 var(--wf-space-sm) 0 var(--wf-space-md);background:var(--wf-window-shell-surface);border-bottom:1px solid var(--wf-color-border-subtle);user-select:none}.wf-window-shell--role-utility .wf-window-shell__titlebar{border-bottom-color:var(--wf-color-border-floating)}.wf-window-shell--role-overlay .wf-window-shell__titlebar{border-bottom-color:var(--wf-color-border-overlay)}.wf-window-shell--role-modal .wf-window-shell__titlebar{border-bottom-color:var(--wf-color-border-modal)}.wf-window-shell--chrome-borderless .wf-window-shell__titlebar,.wf-window-shell--chrome-none .wf-window-shell__titlebar{border-bottom-color:transparent}.wf-window-shell--minimized .wf-window-shell__titlebar{border-bottom:0}.wf-window-shell__leading,.wf-window-shell__actions{display:flex;min-width:0;align-items:center;gap:var(--wf-space-xs)}.wf-window-shell__leading{flex:1}.wf-window-shell__title{min-width:0;overflow:hidden;font-size:var(--wf-font-size-sm);font-weight:var(--wf-font-weight-medium);text-overflow:ellipsis;white-space:nowrap}.wf-window-shell__icon{flex:0 0 auto;color:var(--wf-color-accent)}.wf-window-shell__badge{flex:0 0 auto;padding:1px var(--wf-space-xs);border:1px solid var(--wf-color-border-subtle);border-radius:var(--wf-radius-sm);color:var(--wf-color-accent);font-size:var(--wf-font-size-xs)}.wf-window-shell__status{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);white-space:nowrap}.wf-window-shell__actions{position:relative}.wf-window-shell__header-action,.wf-window-shell__minimize,.wf-window-shell__close{min-width:var(--wf-size-control-height);height:var(--wf-size-control-height);padding:0 var(--wf-space-xs);color:var(--wf-color-text-muted);background:transparent;border:0;border-radius:var(--wf-radius-sm);font:inherit;cursor:pointer}.wf-window-shell__header-action:hover:not(:disabled),.wf-window-shell__minimize:hover,.wf-window-shell__close:hover{color:var(--wf-color-text);background:var(--wf-color-hover)}.wf-window-shell__header-action:focus-visible,.wf-window-shell__minimize:focus-visible,.wf-window-shell__close:focus-visible{outline:2px solid var(--wf-color-focus);outline-offset:-2px}.wf-window-shell__header-action:disabled{cursor:default;opacity:.5}.wf-window-shell__content{min-width:0;min-height:0;flex:1;padding:var(--wf-space-md);overflow:hidden}.wf-window-shell__content :deep(.wf-pane-host){width:100%;height:100%}
.wf-window-shell__header-action,.wf-window-shell__minimize,.wf-window-shell__close{min-width:var(--wf-size-icon-button-size);height:var(--wf-size-icon-button-size)}.wf-window-shell__action-icon{display:inline-grid;width:var(--wf-size-icon-size);height:var(--wf-size-icon-size);place-items:center;line-height:1;font-size:var(--wf-size-icon-size)}
.wf-window-shell__dock-action{position:relative}.wf-window-shell__dock{min-width:var(--wf-size-icon-button-size);height:var(--wf-size-icon-button-size);padding:0 var(--wf-space-xs);color:var(--wf-color-text-muted);background:transparent;border:0;border-radius:var(--wf-radius-sm);font:inherit;cursor:pointer}.wf-window-shell__dock:hover{color:var(--wf-color-text);background:var(--wf-color-hover)}.wf-window-shell__dock:focus-visible{outline:2px solid var(--wf-color-focus);outline-offset:-2px}.wf-window-shell__lock{min-height:var(--wf-size-icon-button-size);padding:0 var(--wf-space-xs);display:inline-flex;align-items:center;gap:var(--wf-space-2xs);color:var(--wf-color-text-muted);background:transparent;border:0;border-radius:var(--wf-radius-sm);font:inherit;font-size:var(--wf-font-size-xs);cursor:pointer}.wf-window-shell__lock:hover{color:var(--wf-color-text);background:var(--wf-color-hover)}.wf-window-shell__lock:focus-visible{outline:2px solid var(--wf-color-focus);outline-offset:-2px}.wf-window-shell--layout-locked .wf-window-shell__content{padding:0}
</style>
