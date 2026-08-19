<script setup lang="ts">
import { nextTick } from 'vue'
import { WINDOW_SNAP_LAYOUTS, type WindowSnapZone } from '../core/window-snap'

const emit = defineEmits<{ select:[zone:WindowSnapZone|'maximize']; close:[] }>()
const entries = [{ id: 'maximize' as const, label: 'Maximize' }, ...WINDOW_SNAP_LAYOUTS.map((layout) => ({ id: layout.zone, label: layout.label }))]
function select(id: WindowSnapZone | 'maximize'): void { emit('select', id) }
function onKeydown(event: KeyboardEvent): void {
  const target = event.target
  if (!(target instanceof HTMLButtonElement)) return
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return }
  if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return
  event.preventDefault()
  const buttons = [...target.closest<HTMLElement>('[data-window-snap-layout-picker]')?.querySelectorAll<HTMLButtonElement>('button') ?? []]
  const index = buttons.indexOf(target)
  if (index < 0 || buttons.length === 0) return
  const columns = 4
  let next = index
  if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length
  if (event.key === 'ArrowRight') next = (index + 1) % buttons.length
  if (event.key === 'ArrowUp') next = Math.max(0, index - columns)
  if (event.key === 'ArrowDown') next = Math.min(buttons.length - 1, index + columns)
  if (event.key === 'Home') next = 0
  if (event.key === 'End') next = buttons.length - 1
  void nextTick(() => buttons[next]?.focus())
}
</script>

<template>
  <div class="wf-window-snap-layout-picker" data-window-snap-layout-picker role="menu" aria-label="Window layout">
    <button v-for="entry in entries" :key="entry.id" type="button" role="menuitem" class="wf-window-snap-layout-picker__item" :data-window-layout="entry.id" :title="entry.label" @click="select(entry.id)" @keydown="onKeydown">
      <span class="wf-window-snap-layout-picker__glyph" :data-layout-glyph="entry.id" aria-hidden="true" />
      <span>{{ entry.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.wf-window-snap-layout-picker{position:absolute;top:calc(100% + var(--wf-space-xs));right:0;z-index:var(--wf-layer-overlay);display:grid;grid-template-columns:repeat(4,minmax(76px,1fr));gap:var(--wf-space-xs);width:min(420px,80vw);padding:var(--wf-space-sm);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-md);background:var(--wf-color-surface-raised);box-shadow:var(--wf-shadow-lg)}
.wf-window-snap-layout-picker__item{display:grid;grid-template-rows:32px auto;align-items:center;gap:var(--wf-space-xs);min-width:0;padding:var(--wf-space-xs);border:1px solid transparent;border-radius:var(--wf-radius-sm);background:transparent;color:var(--wf-color-text);font:inherit;font-size:var(--wf-font-size-xs);cursor:pointer;text-align:center}.wf-window-snap-layout-picker__item:hover,.wf-window-snap-layout-picker__item:focus-visible{border-color:var(--wf-color-focus);background:var(--wf-color-hover);outline:0}.wf-window-snap-layout-picker__glyph{display:block;width:40px;height:26px;justify-self:center;border:1px solid var(--wf-color-border);border-radius:2px;background:var(--wf-color-selected)}
@media(max-width:640px),(pointer:coarse){.wf-window-snap-layout-picker{grid-template-columns:repeat(3,minmax(82px,1fr))}.wf-window-snap-layout-picker__item{min-height:54px}}
</style>
