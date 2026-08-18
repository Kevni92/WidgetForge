<script setup lang="ts">
const props = withDefaults(defineProps<{
  compact?: boolean
  columns?: 1 | 2
  label?: string
}>(), {
  compact: false,
  columns: 1,
  label: 'Statistics',
})
</script>

<template>
  <dl
    class="wf-key-value-group"
    :class="{ 'wf-key-value-group--compact': props.compact }"
    :aria-label="props.label"
    :style="{ '--wf-key-value-columns': String(props.columns) }"
  >
    <slot />
  </dl>
</template>

<style scoped>
.wf-key-value-group {
  --wf-key-value-row-padding: var(--wf-space-sm);
  --wf-key-value-row-gap: var(--wf-space-md);

  display: grid;
  grid-template-columns: repeat(var(--wf-key-value-columns), minmax(0, 1fr));
  gap: var(--wf-space-xs) var(--wf-space-md);
  margin: 0;
}

.wf-key-value-group--compact {
  --wf-key-value-row-padding: var(--wf-space-xs);
  --wf-key-value-row-gap: var(--wf-space-sm);
}

@media (max-width: 640px) {
  .wf-key-value-group {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
