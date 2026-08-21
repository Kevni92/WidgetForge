<script setup lang="ts">
import { computed } from 'vue'
import type { WindowGeometry } from '../core/window-geometry'
import type { WindowLayoutRuleState, WindowLayoutSurfaceState } from '../core/window-layout'
import type { WindowSnapZone } from '../core/window-snap'
import WfIcon from './WfIcon.vue'

interface Props {
  instanceId: string
  title: string
  locked: boolean
  geometry?: WindowGeometry
  surface?: WindowLayoutSurfaceState | undefined
  rule?: WindowLayoutRuleState | undefined
  snapZone?: WindowSnapZone | null | undefined
}

const props = defineProps<Props>()
const emit = defineEmits<{
  lock: [instanceId: string]
  unlock: [instanceId: string]
  layout: [instanceId: string]
}>()

const surfaceLabel = computed(() => ({ floating: 'Floating', snapped: 'Snapped', locked: 'Locked layout' }[props.surface ?? (props.locked ? 'locked' : props.snapZone ? 'snapped' : 'floating')]))
const ruleLabel = computed(() => ({ none: 'No responsive rule', active: 'Responsive active', dormant: 'Responsive dormant', materialized: 'Free geometry / materialized' }[props.rule ?? (props.locked ? 'materialized' : 'none')]))
const statusLabel = computed(() => `${surfaceLabel.value} · ${ruleLabel.value}`)

function toggleLock(): void {
  if (props.locked) emit('unlock', props.instanceId)
  else emit('lock', props.instanceId)
}
</script>

<template>
  <div class="wf-workspace-selection-actions" data-workspace-selection-actions>
    <div class="wf-workspace-selection-actions__identity">
      <strong class="wf-workspace-selection-actions__label" data-selected-window-title>{{ title }}</strong>
      <small data-selected-window-id>{{ instanceId }}</small>
    </div>
    <div class="wf-workspace-selection-actions__status" data-window-layout-status :aria-label="statusLabel">
      <span data-window-layout-surface>{{ surfaceLabel }}</span>
      <span aria-hidden="true">·</span>
      <span data-window-layout-rule>{{ ruleLabel }}</span>
    </div>
    <dl v-if="geometry" class="wf-workspace-selection-actions__geometry" data-window-geometry>
      <div><dt>X</dt><dd>{{ Math.round(geometry.position.x) }} px</dd></div>
      <div><dt>Y</dt><dd>{{ Math.round(geometry.position.y) }} px</dd></div>
      <div><dt>W</dt><dd>{{ Math.round(geometry.size.width) }} px</dd></div>
      <div><dt>H</dt><dd>{{ Math.round(geometry.size.height) }} px</dd></div>
    </dl>
    <button class="wf-workspace-selection-actions__layout" type="button" data-window-selection-layout :aria-label="`Edit layout for ${title}`" @click="emit('layout', props.instanceId)">Layout bearbeiten</button>
    <button
      class="wf-workspace-selection-actions__toggle"
      :class="{ 'wf-workspace-selection-actions__toggle--active': locked }"
      type="button"
      data-window-selection-lock
      :aria-pressed="locked ? 'true' : 'false'"
      :aria-label="`${locked ? 'Unlock' : 'Lock'} window ${title}`"
      :title="`${locked ? 'Unlock' : 'Lock'} window ${title}`"
      @click="toggleLock"
    >
      <WfIcon :name="locked ? 'lock' : 'unlock'" />
      <span>{{ locked ? 'Unlock' : 'Lock' }}</span>
    </button>
  </div>
</template>

<style scoped>
.wf-workspace-selection-actions {
  position: absolute;
  top: var(--wf-space-sm);
  left: var(--wf-space-sm);
  z-index: var(--wf-layer-overlay);
  display: inline-flex;
  align-items: center;
  gap: var(--wf-space-sm);
  max-width: calc(100% - var(--wf-space-md));
  padding: var(--wf-space-2xs);
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-sm);
  background: var(--wf-color-surface-floating);
  box-shadow: var(--wf-shadow-sm);
  color: var(--wf-color-text);
}

.wf-workspace-selection-actions__identity { display: grid; min-width: 0; gap: 1px; }
.wf-workspace-selection-actions__identity small { padding-inline: var(--wf-space-xs); color: var(--wf-color-text-muted); font-size: var(--wf-font-size-xs); }

.wf-workspace-selection-actions__label {
  min-width: 0;
  overflow: hidden;
  padding-inline: var(--wf-space-xs);
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wf-workspace-selection-actions__status { display: inline-flex; align-items: center; gap: var(--wf-space-2xs); padding: 0 var(--wf-space-xs); color: var(--wf-color-accent); font-size: var(--wf-font-size-xs); white-space: nowrap; }
.wf-workspace-selection-actions__geometry { display: inline-flex; gap: var(--wf-space-xs); margin: 0; color: var(--wf-color-text-muted); font-size: var(--wf-font-size-xs); }
.wf-workspace-selection-actions__geometry div { display: inline-flex; gap: 2px; }
.wf-workspace-selection-actions__geometry dt { font-weight: var(--wf-font-weight-bold); }
.wf-workspace-selection-actions__geometry dd { margin: 0; }
.wf-workspace-selection-actions__layout { display: inline-flex; min-height: var(--wf-size-control-height); align-items: center; gap: var(--wf-space-xs); padding: 0 var(--wf-space-sm); border: 1px solid var(--wf-color-border); border-radius: var(--wf-radius-sm); background: var(--wf-color-surface-raised); color: var(--wf-color-text); font: inherit; font-size: var(--wf-font-size-xs); cursor: pointer; white-space: nowrap; }
.wf-workspace-selection-actions__layout:hover { background: var(--wf-color-hover); }

.wf-workspace-selection-actions__toggle {
  display: inline-flex;
  min-height: var(--wf-size-control-height);
  align-items: center;
  gap: var(--wf-space-xs);
  padding: 0 var(--wf-space-sm);
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-sm);
  background: var(--wf-color-surface-raised);
  color: var(--wf-color-text);
  font: inherit;
  font-size: var(--wf-font-size-xs);
  cursor: pointer;
}

.wf-workspace-selection-actions__toggle:hover {
  background: var(--wf-color-hover);
}

.wf-workspace-selection-actions__toggle--active {
  border-color: var(--wf-color-success);
  background: var(--wf-color-selected);
  color: var(--wf-color-success);
}

.wf-workspace-selection-actions__toggle:focus-visible {
  outline: 2px solid var(--wf-color-focus);
  outline-offset: 2px;
}
.wf-workspace-selection-actions__layout:focus-visible { outline: 2px solid var(--wf-color-focus); outline-offset: 2px; }
@media (max-width: 900px) { .wf-workspace-selection-actions__geometry { display: none; } .wf-workspace-selection-actions__status { max-width: 180px; overflow: hidden; text-overflow: ellipsis; } }
</style>
