<script setup lang="ts">
import { computed } from 'vue'
import type { WidgetActionBinding } from '../core/widget-actions'

interface Props {
  bindings: readonly WidgetActionBinding[]
  maxVisible?: number
  ariaLabel?: string
  compact?: boolean
}
const props = withDefaults(defineProps<Props>(), { maxVisible: 3, ariaLabel: 'Widget actions', compact: false })

const visibleBindings = computed(() => props.bindings
  .filter((binding) => binding.action.visible !== false)
  .map((binding, index) => ({ binding, index }))
  .sort((left, right) => (right.binding.action.priority ?? 0) - (left.binding.action.priority ?? 0) || left.index - right.index)
  .map(({ binding }) => binding))
const primaryBindings = computed(() => visibleBindings.value.slice(0, Math.max(0, props.maxVisible)))
const overflowBindings = computed(() => visibleBindings.value.slice(Math.max(0, props.maxVisible)))
function tooltip(binding: WidgetActionBinding): string { return binding.action.shortcut ? `${binding.action.label} (${binding.action.shortcut})` : binding.action.label }
function execute(binding: WidgetActionBinding): void { if (!binding.action.disabled && binding.action.visible !== false) binding.execute() }
function onKeydown(event: KeyboardEvent, binding: WidgetActionBinding): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault(); execute(binding)
}
</script>

<template>
  <div class="wf-widget-action-toolbar" :class="{ 'wf-widget-action-toolbar--compact': compact }" role="toolbar" :aria-label="ariaLabel">
    <button
      v-for="binding in primaryBindings"
      :key="binding.action.id"
      class="wf-widget-action-toolbar__action"
      :class="`wf-widget-action-toolbar__action--${binding.action.tone ?? 'neutral'}`"
      type="button"
      :data-widget-action="binding.action.id"
      :data-action-group="binding.action.group ?? 'default'"
      :aria-label="binding.action.label"
      :title="tooltip(binding)"
      :disabled="binding.action.disabled"
      @click.stop="execute(binding)"
      @keydown.stop="onKeydown($event, binding)"
    ><span aria-hidden="true">{{ binding.action.icon }}</span><span v-if="!compact" class="wf-widget-action-toolbar__label">{{ binding.action.label }}</span></button>
    <details v-if="overflowBindings.length" class="wf-widget-action-toolbar__overflow" @click.stop>
      <summary class="wf-widget-action-toolbar__more" aria-label="More widget actions" title="More widget actions">⋯</summary>
      <div class="wf-widget-action-toolbar__menu" role="menu">
        <button
          v-for="binding in overflowBindings"
          :key="binding.action.id"
          class="wf-widget-action-toolbar__menu-action"
          :class="`wf-widget-action-toolbar__action--${binding.action.tone ?? 'neutral'}`"
          type="button"
          role="menuitem"
          :data-widget-action="binding.action.id"
          :data-action-group="binding.action.group ?? 'default'"
          :aria-label="binding.action.label"
          :title="tooltip(binding)"
          :disabled="binding.action.disabled"
          @click.stop="execute(binding)"
          @keydown.stop="onKeydown($event, binding)"
        ><span aria-hidden="true">{{ binding.action.icon }}</span><span>{{ binding.action.label }}</span><kbd v-if="binding.action.shortcut">{{ binding.action.shortcut }}</kbd></button>
      </div>
    </details>
  </div>
</template>

<style scoped>
.wf-widget-action-toolbar{display:flex;min-width:0;align-items:center;gap:2px}.wf-widget-action-toolbar__action,.wf-widget-action-toolbar__more,.wf-widget-action-toolbar__menu-action{border:0;border-radius:var(--wf-radius-sm);background:transparent;color:var(--wf-color-text-muted);font:inherit;cursor:pointer}.wf-widget-action-toolbar__action{display:flex;height:var(--wf-size-control-height);align-items:center;gap:var(--wf-space-xs);padding:0 var(--wf-space-xs)}.wf-widget-action-toolbar__action:hover:not(:disabled),.wf-widget-action-toolbar__more:hover,.wf-widget-action-toolbar__menu-action:hover:not(:disabled){background:var(--wf-color-hover);color:var(--wf-color-text)}.wf-widget-action-toolbar__action:focus-visible,.wf-widget-action-toolbar__more:focus-visible,.wf-widget-action-toolbar__menu-action:focus-visible{outline:2px solid var(--wf-color-focus);outline-offset:-2px}.wf-widget-action-toolbar__action:disabled,.wf-widget-action-toolbar__menu-action:disabled{cursor:default;opacity:.45}.wf-widget-action-toolbar__action--accent{color:var(--wf-color-accent)}.wf-widget-action-toolbar__action--danger{color:var(--wf-color-danger)}.wf-widget-action-toolbar__label{max-width:10rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wf-widget-action-toolbar__overflow{position:relative}.wf-widget-action-toolbar__more{display:grid;width:var(--wf-size-control-height);height:var(--wf-size-control-height);place-items:center;list-style:none}.wf-widget-action-toolbar__more::-webkit-details-marker{display:none}.wf-widget-action-toolbar__menu{position:absolute;top:calc(100% + 2px);right:0;z-index:var(--wf-layer-overlay);display:grid;min-width:180px;padding:var(--wf-space-xs);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface-raised);box-shadow:var(--wf-shadow-md)}.wf-widget-action-toolbar__menu-action{display:flex;min-height:var(--wf-size-control-height);align-items:center;gap:var(--wf-space-sm);padding:0 var(--wf-space-sm);text-align:left}.wf-widget-action-toolbar__menu-action span:nth-child(2){flex:1}.wf-widget-action-toolbar__menu-action kbd{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs)}.wf-widget-action-toolbar--compact .wf-widget-action-toolbar__action{width:var(--wf-size-control-height);justify-content:center;padding:0}
</style>
