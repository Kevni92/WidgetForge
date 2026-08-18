<script setup lang="ts">
const props = withDefaults(defineProps<{
  title?: string
  message?: string
  retryable?: boolean
  retryLabel?: string
  compact?: boolean
}>(), {
  title: 'Unable to load data',
  message: '',
  retryable: false,
  retryLabel: 'Retry',
  compact: false,
})

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <div
    class="wf-error-state"
    :class="{ 'wf-error-state--compact': props.compact }"
    role="alert"
  >
    <div v-if="$slots.icon" class="wf-error-state__icon" aria-hidden="true">
      <slot name="icon" />
    </div>
    <div class="wf-error-state__content">
      <strong class="wf-error-state__title">
        <slot name="title">{{ props.title }}</slot>
      </strong>
      <p v-if="props.message || $slots.default" class="wf-error-state__message">
        <slot>{{ props.message }}</slot>
      </p>
    </div>
    <div v-if="props.retryable || $slots.actions" class="wf-error-state__actions">
      <button
        v-if="props.retryable"
        type="button"
        class="wf-error-state__retry"
        @click="emit('retry')"
      >
        {{ props.retryLabel }}
      </button>
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.wf-error-state {
  display: grid;
  place-items: center;
  gap: var(--wf-space-sm);
  min-height: 120px;
  padding: var(--wf-space-lg);
  border: 1px solid var(--wf-color-danger);
  border-radius: var(--wf-radius-md);
  background: var(--wf-color-surface);
  color: var(--wf-color-text);
  text-align: center;
}

.wf-error-state--compact {
  min-height: auto;
  padding: var(--wf-space-md);
}

.wf-error-state__icon {
  color: var(--wf-color-danger);
  font-size: var(--wf-font-size-lg);
}

.wf-error-state__content {
  display: grid;
  gap: var(--wf-space-xs);
  max-width: 420px;
}

.wf-error-state__title {
  color: var(--wf-color-danger);
  font-size: var(--wf-font-size-md);
  font-weight: var(--wf-font-weight-bold);
}

.wf-error-state__message {
  margin: 0;
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-sm);
}

.wf-error-state__actions {
  display: flex;
  justify-content: center;
  gap: var(--wf-space-sm);
}

.wf-error-state__retry {
  min-height: var(--wf-size-control-height);
  padding: 0 var(--wf-space-md);
  border: 1px solid var(--wf-color-danger);
  border-radius: var(--wf-radius-sm);
  background: transparent;
  color: var(--wf-color-danger);
  font: inherit;
  font-weight: var(--wf-font-weight-medium);
  cursor: pointer;
}

.wf-error-state__retry:hover {
  background: var(--wf-color-hover);
}

.wf-error-state__retry:focus-visible {
  outline: 2px solid var(--wf-color-focus);
  outline-offset: 2px;
}
</style>
