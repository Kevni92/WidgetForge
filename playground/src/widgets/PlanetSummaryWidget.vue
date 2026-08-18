<script setup lang="ts">
import { useWidgetContext } from 'widgetforge'

const context = useWidgetContext<{ planetId: string; compact?: boolean }>()
</script>

<template>
  <article class="dummy-widget">
    <strong>Planet Summary</strong>
    <span>Planet: {{ context.parameters.value.planetId }}</span>
    <span>Instance: {{ context.instanceId }}</span>
  </article>
</template>
