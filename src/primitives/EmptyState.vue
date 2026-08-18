<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string
  message?: string
  compact?: boolean
}>(), {
  title: 'No data',
  message: '',
  compact: false,
})
</script>

<template>
  <div
    class="wf-empty-state"
    :class="{ 'wf-empty-state--compact': props.compact }"
    role="status"
    aria-live="polite"
  >
    <div v-if="$slots.icon" class="wf-empty-state__icon" aria-hidden="true">
      <slot name="icon" />
    </div>
    <div class="wf-empty-state__content">
      <strong class="wf-empty-state__title">
        <slot name="title">{{ props.title }}</slot>
      </strong>
      <p v-if="props.message || $slots.default" class="wf-empty-state__message">
        <slot>{{ props.message }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="wf-empty-state__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.wf-empty-state {
  display: grid;
  place-items: center;
  gap: var(--wf-space-sm);
  min-height: 120px;
  padding: var(--wf-space-lg);
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-md);
  background: var(--wf-color-surface);
  color: var(--wf-color-text);
  text-align: center;
}

.wf-empty-state--compact {
  min-height: auto;
  padding: var(--wf-space-md);
}

.wf-empty-state__icon {
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-lg);
}

.wf-empty-state__content {
  display: grid;
  gap: var(--wf-space-xs);
  max-width: 420px;
}

.wf-empty-state__title {
  font-size: var(--wf-font-size-md);
  font-weight: var(--wf-font-weight-bold);
}

.wf-empty-state__message {
  margin: 0;
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-sm);
}

.wf-empty-state__actions {
  display: flex;
  justify-content: center;
  gap: var(--wf-space-sm);
}
</style>
