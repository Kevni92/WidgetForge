<script setup lang="ts">
const props = withDefaults(defineProps<{
  value: string | number
  unit?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info'
  label?: string
}>(), {
  unit: '',
  tone: 'neutral',
})
</script>

<template>
  <span
    class="wf-stat-value"
    :class="`wf-stat-value--${props.tone}`"
    :aria-label="props.label"
  >
    <span class="wf-stat-value__value">{{ props.value }}</span>
    <span v-if="props.unit" class="wf-stat-value__unit">{{ props.unit }}</span>
    <slot />
  </span>
</template>

<style scoped>
.wf-stat-value {
  display: inline-flex;
  align-items: baseline;
  gap: var(--wf-space-xs);
  color: var(--wf-color-text);
  font-variant-numeric: tabular-nums;
}

.wf-stat-value__value {
  font-weight: var(--wf-font-weight-bold);
}

.wf-stat-value__unit {
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-xs);
  font-weight: var(--wf-font-weight-regular);
}

.wf-stat-value--success {
  color: var(--wf-color-success);
}

.wf-stat-value--warning {
  color: var(--wf-color-warning);
}

.wf-stat-value--danger {
  color: var(--wf-color-danger);
}

.wf-stat-value--info {
  color: var(--wf-color-info);
}
</style>
