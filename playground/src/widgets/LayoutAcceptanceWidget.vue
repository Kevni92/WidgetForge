<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWidgetContext } from 'widgetforge'

const context = useWidgetContext<{ region: 'left' | 'center' | 'right'; description: string }>()
const expanded = ref(false)
const regionLabel = computed(() => context.parameters.value.region === 'center' ? 'Canvas window' : `${context.parameters.value.region === 'left' ? 'Left' : 'Right'} Menu`)
</script>

<template>
  <article class="layout-acceptance-widget" :data-layout-acceptance-region="context.parameters.value.region">
    <span class="layout-acceptance-widget__eyebrow">Acceptance surface</span>
    <h2>{{ regionLabel }}</h2>
    <p>{{ context.parameters.value.description }}</p>
    <button type="button" data-layout-content-action @click="expanded = !expanded">
      {{ expanded ? 'Hide details' : 'Open details' }}
    </button>
    <p v-if="expanded" data-layout-content-details role="status">Normal widget interaction is available outside Layout Edit mode.</p>
  </article>
</template>

<style scoped>
.layout-acceptance-widget{display:grid;align-content:start;gap:var(--wf-space-sm);height:100%;padding:var(--wf-space-md);overflow:auto;background:var(--wf-color-surface)}
.layout-acceptance-widget__eyebrow{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);letter-spacing:.08em;text-transform:uppercase}
.layout-acceptance-widget h2,.layout-acceptance-widget p{margin:0}
.layout-acceptance-widget h2{color:var(--wf-color-accent);font-size:var(--wf-font-size-lg)}
.layout-acceptance-widget p{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-sm)}
.layout-acceptance-widget button{justify-self:start;min-height:var(--wf-size-control-height-compact);padding:0 var(--wf-space-sm);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface-raised);color:var(--wf-color-text);font:inherit;font-size:var(--wf-font-size-xs);cursor:pointer}
.layout-acceptance-widget button:focus-visible{outline:2px solid var(--wf-color-focus);outline-offset:2px}
</style>
