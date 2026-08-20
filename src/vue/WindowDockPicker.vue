<script setup lang="ts">
import type { DockPosition } from '../core/dock-manager'

const positions: readonly { id: DockPosition; label: string; icon: string }[] = [
  { id: 'top', label: 'Top', icon: '↑' },
  { id: 'bottom', label: 'Bottom', icon: '↓' },
  { id: 'left', label: 'Left', icon: '←' },
  { id: 'right', label: 'Right', icon: '→' },
]

const emit = defineEmits<{
  select: [position: DockPosition]
  close: []
}>()
</script>

<template>
  <div class="wf-window-dock-picker" role="menu" aria-label="Anchor window to workspace edge" @pointerdown.stop>
    <span class="wf-window-dock-picker__title">Anchor to workspace</span>
    <button
      v-for="position in positions"
      :key="position.id"
      class="wf-window-dock-picker__option"
      type="button"
      role="menuitem"
      :data-window-dock-position="position.id"
      :aria-label="`Anchor to ${position.label}`"
      @click.stop="emit('select', position.id)"
    >
      <span aria-hidden="true">{{ position.icon }}</span>
      <span>{{ position.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.wf-window-dock-picker{position:absolute;top:calc(100% + var(--wf-space-xs));right:0;z-index:var(--wf-layer-overlay);display:grid;grid-template-columns:repeat(2,minmax(92px,1fr));gap:var(--wf-space-xs);min-width:208px;padding:var(--wf-space-sm);background:var(--wf-color-surface-floating);border:1px solid var(--wf-color-border-floating);border-radius:var(--wf-radius-md);box-shadow:var(--wf-shadow-lg)}
.wf-window-dock-picker__title{grid-column:1/-1;padding:0 var(--wf-space-xs) var(--wf-space-xs);color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs)}
.wf-window-dock-picker__option{display:flex;align-items:center;gap:var(--wf-space-xs);min-height:var(--wf-size-control-height);padding:0 var(--wf-space-sm);color:var(--wf-color-text);background:transparent;border:1px solid var(--wf-color-border-subtle);border-radius:var(--wf-radius-sm);font:inherit;cursor:pointer}
.wf-window-dock-picker__option:hover{background:var(--wf-color-hover)}
.wf-window-dock-picker__option:focus-visible{outline:2px solid var(--wf-color-focus);outline-offset:1px}
</style>
