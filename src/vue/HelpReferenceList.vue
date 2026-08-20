<script setup lang="ts">
import type { HelpReferenceEntry } from '../core/help-documentation'

interface Props {
  entries: readonly HelpReferenceEntry[]
  selectedKey?: string | null
}

const props = withDefaults(defineProps<Props>(), { selectedKey: null })
const emit = defineEmits<{ select: [key: string] }>()

function label(entry: HelpReferenceEntry): string {
  return entry.kind === 'widget' ? entry.title : entry.name
}

function identifier(entry: HelpReferenceEntry): string {
  return entry.kind === 'widget' ? entry.id : entry.widgetId
}

function description(entry: HelpReferenceEntry): string | undefined {
  if (entry.description) return entry.description
  return entry.kind === 'widget' ? entry.documentation.summary : entry.documentation.description ?? entry.documentation.summary
}

function meta(entry: HelpReferenceEntry): string {
  if (entry.kind === 'widget') {
    const count = entry.parameterCount === 1 ? '1 parameter' : `${entry.parameterCount} parameters`
    return count
  }
  return `Widget: ${entry.widgetId}`
}
</script>

<template>
  <ul class="wf-help-reference-list" role="list" aria-label="Documentation entries">
    <li v-for="entry in props.entries" :key="entry.key" class="wf-help-reference-list__item">
      <button
        class="wf-help-reference-list__button"
        type="button"
        :data-help-entry="entry.key"
        :aria-current="props.selectedKey === entry.key ? 'true' : undefined"
        @click="emit('select', entry.key)"
      >
        <span class="wf-help-reference-list__kind">{{ entry.kind === 'widget' ? 'Widget' : 'Command' }}</span>
        <strong class="wf-help-reference-list__label">{{ label(entry) }}</strong>
        <code class="wf-help-reference-list__identifier">{{ identifier(entry) }}</code>
        <span class="wf-help-reference-list__meta">{{ meta(entry) }}</span>
        <span v-if="description(entry)" class="wf-help-reference-list__description">{{ description(entry) }}</span>
      </button>
    </li>
  </ul>
</template>

<style scoped>
.wf-help-reference-list{display:grid;gap:var(--wf-space-xs);margin:0;padding:0;list-style:none}.wf-help-reference-list__item{min-width:0}.wf-help-reference-list__button{display:grid;width:100%;min-width:0;gap:2px;padding:var(--wf-space-sm);border:1px solid transparent;border-radius:var(--wf-radius-sm);background:transparent;color:var(--wf-color-text);font:inherit;text-align:start;cursor:pointer}.wf-help-reference-list__button:hover{background:var(--wf-color-hover)}.wf-help-reference-list__button[aria-current="true"]{border-color:var(--wf-color-focus);background:var(--wf-color-selected)}.wf-help-reference-list__button:focus-visible{outline:2px solid var(--wf-color-focus);outline-offset:2px}.wf-help-reference-list__kind{color:var(--wf-color-accent);font-size:var(--wf-font-size-xs);font-weight:var(--wf-font-weight-bold);text-transform:uppercase}.wf-help-reference-list__label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wf-help-reference-list__identifier{overflow:hidden;color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);text-overflow:ellipsis;white-space:nowrap}.wf-help-reference-list__meta{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs)}.wf-help-reference-list__description{display:-webkit-box;overflow:hidden;color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);-webkit-box-orient:vertical;-webkit-line-clamp:2}
</style>
