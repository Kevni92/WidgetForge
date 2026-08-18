<script setup lang="ts">
const props = withDefaults(defineProps<{
  message?: string
  compact?: boolean
}>(), {
  message: 'Loading…',
  compact: false,
})
</script>

<template>
  <div
    class="wf-state wf-loading-state"
    :class="{ 'wf-state--compact': props.compact }"
    role="status"
    aria-live="polite"
    aria-busy="true"
  >
    <span class="wf-loading-state__indicator" aria-hidden="true" />
    <div class="wf-state__content">
      <slot>
        <span>{{ props.message }}</span>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.wf-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--wf-space-md);
  min-height: 120px;
  padding: var(--wf-space-lg);
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-md);
  background: var(--wf-color-surface);
  color: var(--wf-color-text-muted);
  text-align: center;
}

.wf-state--compact {
  min-height: auto;
  padding: var(--wf-space-md);
}

.wf-loading-state__indicator {
  width: var(--wf-space-lg);
  height: var(--wf-space-lg);
  flex: 0 0 auto;
  border: 2px solid var(--wf-color-border);
  border-top-color: var(--wf-color-info);
  border-radius: var(--wf-radius-full);
  animation: wf-loading-state-spin 0.8s linear infinite;
}

.wf-state__content {
  min-width: 0;
  font-size: var(--wf-font-size-sm);
}

@keyframes wf-loading-state-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wf-loading-state__indicator {
    animation: none;
    border-top-color: var(--wf-color-border);
    background: var(--wf-color-info);
  }
}
</style>
