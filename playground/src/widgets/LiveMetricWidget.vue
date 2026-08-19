<script setup lang="ts">
import { computed } from 'vue'
import { createDataKey, useData, usePaneContext, useWidgetContext } from 'widgetforge'

interface DemoMetric { label: string; value: number; unit: string }

const context = useWidgetContext<{ resourceId: string }>()
const pane = usePaneContext()
const resourceId = context.parameters.value.resourceId
const state = useData(createDataKey<DemoMetric>('demo.metric', resourceId))
const valueText = computed(() => state.value.status === 'ready' ? state.value.data.value.toFixed(1) : '—')
const compact = computed(() => pane.size.value.width > 0 && pane.size.value.width < 220)
const paneHost = computed(() => pane.hostType.value)
const paneVisible = computed(() => pane.visible.value)
const dimensions = computed(() => pane.size.value.width > 0 ? `${pane.size.value.width}×${pane.size.value.height}` : 'measuring')
</script>

<template>
  <article class="live-metric-widget" :class="{ 'live-metric-widget--compact': compact }" :data-resource-id="resourceId" :data-pane-host="paneHost" :data-pane-visible="String(paneVisible)" :data-pane-compact="String(compact)">
    <span v-if="!compact" class="live-metric-widget__eyebrow">Live resource</span>
    <template v-if="state.status === 'ready'">
      <strong>{{ state.data.label }}</strong>
      <span class="live-metric-widget__value">{{ valueText }} {{ state.data.unit }}</span>
    </template>
    <span v-else-if="state.status === 'loading'" class="live-metric-widget__state">Loading…</span>
    <span v-else class="live-metric-widget__state live-metric-widget__state--error">{{ state.error.message }}</span>
    <span class="live-metric-widget__context">{{ paneHost }} · {{ dimensions }}</span>
  </article>
</template>

<style scoped>
.live-metric-widget { display: grid; gap: var(--wf-space-sm); }
.live-metric-widget--compact { gap: var(--wf-space-xs); }
.live-metric-widget__eyebrow,.live-metric-widget__context { color: var(--wf-color-text-muted); font-size: var(--wf-font-size-xs); }
.live-metric-widget__eyebrow { text-transform: uppercase; letter-spacing: 0.08em; }
.live-metric-widget__context { text-transform: uppercase; }
.live-metric-widget__value { color: var(--wf-color-accent); font-size: var(--wf-font-size-lg); font-weight: var(--wf-font-weight-bold); }
.live-metric-widget--compact .live-metric-widget__value { font-size: var(--wf-font-size-md); }
.live-metric-widget__state { color: var(--wf-color-text-muted); }
.live-metric-widget__state--error { color: var(--wf-color-danger); }
</style>
