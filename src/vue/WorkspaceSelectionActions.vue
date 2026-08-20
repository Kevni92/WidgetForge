<script setup lang="ts">
interface Props {
  instanceId: string
  title: string
  locked: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  lock: [instanceId: string]
  unlock: [instanceId: string]
}>()

function toggleLock(): void {
  if (props.locked) emit('unlock', props.instanceId)
  else emit('lock', props.instanceId)
}
</script>

<template>
  <div class="wf-workspace-selection-actions" data-workspace-selection-actions>
    <span class="wf-workspace-selection-actions__label" data-selected-window-title>{{ title }}</span>
    <button
      class="wf-workspace-selection-actions__toggle"
      :class="{ 'wf-workspace-selection-actions__toggle--active': locked }"
      type="button"
      data-window-selection-lock
      :aria-label="`${locked ? 'Unlock' : 'Lock'} window ${title}`"
      :title="`${locked ? 'Unlock' : 'Lock'} window ${title}`"
      @click="toggleLock"
    >
      <span aria-hidden="true">{{ locked ? '▣' : '□' }}</span>
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
  gap: var(--wf-space-xs);
  max-width: calc(100% - var(--wf-space-md));
  padding: var(--wf-space-2xs);
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-sm);
  background: var(--wf-color-surface-floating);
  box-shadow: var(--wf-shadow-sm);
  color: var(--wf-color-text);
}

.wf-workspace-selection-actions__label {
  min-width: 0;
  overflow: hidden;
  padding-inline: var(--wf-space-xs);
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

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
</style>
