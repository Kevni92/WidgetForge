<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  value?: string | number
  align?: 'start' | 'end'
}>(), {
  label: '',
  value: '',
  align: 'end',
})
</script>

<template>
  <div class="wf-key-value-row">
    <dt class="wf-key-value-row__label">
      <slot name="label">{{ props.label }}</slot>
    </dt>
    <dd
      class="wf-key-value-row__value"
      :class="`wf-key-value-row__value--${props.align}`"
    >
      <slot name="value">{{ props.value }}</slot>
    </dd>
  </div>
</template>

<style scoped>
.wf-key-value-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, auto);
  align-items: center;
  gap: var(--wf-key-value-row-gap, var(--wf-space-md));
  min-width: 0;
  padding: var(--wf-key-value-row-padding, var(--wf-space-sm)) 0;
  border-bottom: 1px solid var(--wf-color-border);
}

.wf-key-value-row__label,
.wf-key-value-row__value {
  min-width: 0;
  margin: 0;
}

.wf-key-value-row__label {
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-sm);
}

.wf-key-value-row__value {
  color: var(--wf-color-text);
  font-size: var(--wf-font-size-sm);
  font-weight: var(--wf-font-weight-medium);
}

.wf-key-value-row__value--start {
  text-align: start;
}

.wf-key-value-row__value--end {
  text-align: end;
}
</style>
