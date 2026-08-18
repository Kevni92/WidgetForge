<script setup lang="ts">
import { computed } from 'vue'
import { KeyValueGroup, KeyValueRow, StatValue, useWidgetContext, useWidgetNavigation } from 'widgetforge'

const context = useWidgetContext<{ planetId: string; compact?: boolean }>()
const navigation = useWidgetNavigation()
const planetId = computed(() => context.parameters.value.planetId)
const compact = computed(() => context.parameters.value.compact ?? false)
const seed = computed(() => [...planetId.value].reduce((sum, character) => sum + character.charCodeAt(0), 0))
const population = computed(() => (82 + seed.value % 47) * 1000)
const workforce = computed(() => 68 + seed.value % 19)
const storage = computed(() => 54 + seed.value % 33)

function openMarket(): void {
  navigation.navigate({ widgetId: 'market.ticker', parameters: { commodity: 'METALS', rows: 10 } })
}
</script>

<template>
  <article class="planet-widget" :class="{ 'planet-widget--compact': compact }">
    <header class="planet-widget__header">
      <div>
        <span class="planet-widget__eyebrow">Colony Administration</span>
        <strong>{{ planetId }}</strong>
        <span>Terran settlement · Helios system</span>
      </div>
      <span class="planet-widget__status"><i /> Stable</span>
    </header>

    <div class="planet-widget__metrics">
      <div><span>Population</span><StatValue :value="population.toLocaleString('en-US')" tone="info" /></div>
      <div><span>Workforce</span><StatValue :value="workforce" unit="%" tone="success" /></div>
      <div><span>Storage</span><StatValue :value="storage" unit="%" :tone="storage > 80 ? 'warning' : 'neutral'" /></div>
    </div>

    <KeyValueGroup v-if="!compact" :columns="2" compact label="Colony statistics">
      <KeyValueRow label="Governor" value="M. Renner" />
      <KeyValueRow label="Habitat" value="Temperate" />
      <KeyValueRow label="Power reserve" value="18.5 MW" />
      <KeyValueRow label="Dock utilization" value="73%" />
      <KeyValueRow label="Production lines" value="12 / 14" />
      <KeyValueRow label="Next convoy" value="04:18" />
    </KeyValueGroup>

    <footer class="planet-widget__footer">
      <button type="button" data-navigation="market" @click="openMarket">Open local market</button>
      <span>Instance {{ context.instanceId }}</span>
    </footer>
  </article>
</template>

<style scoped>
.planet-widget{height:100%;display:grid;grid-template-rows:auto auto 1fr auto;gap:var(--wf-space-md);padding:var(--wf-space-md);overflow:auto;background:linear-gradient(145deg,var(--wf-color-surface),var(--wf-color-canvas));color:var(--wf-color-text)}.planet-widget--compact{grid-template-rows:auto 1fr;padding:var(--wf-space-sm);gap:var(--wf-space-sm)}.planet-widget__header{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--wf-space-md)}.planet-widget__header>div{display:grid;gap:2px}.planet-widget__eyebrow{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs);text-transform:uppercase;letter-spacing:.08em}.planet-widget__header strong{font-size:var(--wf-font-size-lg)}.planet-widget__header>div>span:last-child{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs)}.planet-widget__status{display:flex;align-items:center;gap:6px;color:var(--wf-color-success);font-size:var(--wf-font-size-xs)}.planet-widget__status i{width:7px;height:7px;border-radius:50%;background:var(--wf-color-success)}.planet-widget__metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--wf-space-sm)}.planet-widget__metrics>div{display:grid;gap:3px;padding:var(--wf-space-sm);border:1px solid var(--wf-color-border);border-radius:var(--wf-radius-sm);background:var(--wf-color-surface-raised)}.planet-widget__metrics>div>span:first-child{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs)}.planet-widget--compact .planet-widget__metrics{grid-template-columns:repeat(3,minmax(70px,1fr))}.planet-widget--compact :deep(.wf-key-value-group),.planet-widget--compact .planet-widget__footer{display:none}.planet-widget__footer{display:flex;align-items:center;justify-content:space-between;gap:var(--wf-space-md);padding-top:var(--wf-space-sm);border-top:1px solid var(--wf-color-border)}.planet-widget__footer button{height:30px;padding:0 var(--wf-space-md);border:1px solid var(--wf-color-accent);border-radius:var(--wf-radius-sm);background:transparent;color:var(--wf-color-accent);cursor:pointer}.planet-widget__footer button:hover{background:var(--wf-color-selected)}.planet-widget__footer span{color:var(--wf-color-text-muted);font-size:var(--wf-font-size-xs)}
</style>
