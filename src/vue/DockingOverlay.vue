<script setup lang="ts">
import { computed } from 'vue'
import { workspaceDropPreviewRect, type WorkspaceDropRect, type WorkspaceDropZone } from '../core/workspace-docking'

interface Props {
  targetRect: WorkspaceDropRect
  activeZone: WorkspaceDropZone
  sourceId?: string | undefined
  targetId?: string | undefined
}

const props = defineProps<Props>()
const zones: readonly WorkspaceDropZone[] = ['top', 'left', 'center', 'right', 'bottom']
const overlayStyle = computed(() => ({ left: `${props.targetRect.x}px`, top: `${props.targetRect.y}px`, width: `${props.targetRect.width}px`, height: `${props.targetRect.height}px` }))
const previewStyle = computed(() => {
  const preview = workspaceDropPreviewRect(props.activeZone, props.targetRect)
  return {
    left: `${preview.x - props.targetRect.x}px`,
    top: `${preview.y - props.targetRect.y}px`,
    width: `${preview.width}px`,
    height: `${preview.height}px`,
  }
})
</script>

<template>
  <div class="wf-docking-overlay" :style="overlayStyle" :data-docking-source="sourceId" :data-docking-target="targetId" :data-docking-active-zone="activeZone" aria-hidden="true">
    <div class="wf-docking-overlay__preview" :style="previewStyle" />
    <div class="wf-docking-overlay__targets">
      <span v-for="zone in zones" :key="zone" class="wf-docking-overlay__target" :class="[`wf-docking-overlay__target--${zone}`, { 'wf-docking-overlay__target--active': zone === activeZone }]" :data-docking-zone="zone">
        <span class="wf-docking-overlay__glyph" />
      </span>
    </div>
  </div>
</template>

<style scoped>
.wf-docking-overlay{position:absolute;z-index:var(--wf-layer-overlay);pointer-events:none}
.wf-docking-overlay__preview{position:absolute;border:1px solid var(--wf-color-focus);border-radius:var(--wf-radius-sm);background:var(--wf-color-selected);box-shadow:inset 0 0 0 1px var(--wf-color-border)}
.wf-docking-overlay__targets{position:absolute;left:50%;top:50%;display:grid;grid-template-columns:repeat(3,clamp(28px,5vw,40px));grid-template-rows:repeat(3,clamp(28px,5vw,40px));gap:3px;transform:translate(-50%,-50%);padding:4px;border:1px solid var(--wf-color-border-overlay);border-radius:var(--wf-radius-md);background:var(--wf-color-surface-overlay);box-shadow:var(--wf-shadow-lg)}
.wf-docking-overlay__target{display:grid;place-items:center;border:1px solid var(--wf-color-border-overlay);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface-window);opacity:.82}
.wf-docking-overlay__target--active{border-color:var(--wf-color-focus);background:var(--wf-color-selected);opacity:1}
.wf-docking-overlay__target--top{grid-column:2;grid-row:1}.wf-docking-overlay__target--left{grid-column:1;grid-row:2}.wf-docking-overlay__target--center{grid-column:2;grid-row:2}.wf-docking-overlay__target--right{grid-column:3;grid-row:2}.wf-docking-overlay__target--bottom{grid-column:2;grid-row:3}
.wf-docking-overlay__glyph{width:13px;height:10px;border:1px solid currentColor;border-radius:1px;color:var(--wf-color-text-muted)}
.wf-docking-overlay__target--active .wf-docking-overlay__glyph{color:var(--wf-color-focus)}
@media (pointer:coarse){.wf-docking-overlay__targets{grid-template-columns:repeat(3,42px);grid-template-rows:repeat(3,42px);gap:5px}}
</style>
