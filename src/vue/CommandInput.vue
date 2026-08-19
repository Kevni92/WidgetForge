<script setup lang="ts">
import { ref, toRaw } from 'vue'
import { CommandParseError, type CommandRegistry } from '../core/commands'
import { WidgetNavigationError, type NavigationResult, type WidgetNavigator } from '../core/navigation'

interface CommandInputProps {
  commands: CommandRegistry
  navigator: WidgetNavigator
  placeholder?: string
  submitLabel?: string
}

let nextCommandInputId = 0

function createFeedbackId(): string {
  nextCommandInputId += 1
  return `wf-command-input-feedback-${nextCommandInputId}`
}

const props = withDefaults(defineProps<CommandInputProps>(), {
  placeholder: 'Enter command',
  submitLabel: 'Run',
})

const emit = defineEmits<{
  executed: [result: NavigationResult]
  error: [error: Error]
}>()

const feedbackId = createFeedbackId()
const input = ref('')
const status = ref<'idle' | 'success' | 'error'>('idle')
const feedback = ref('')

function submit(): void {
  try {
    const intent = toRaw(props.commands).parse(input.value)
    const result = toRaw(props.navigator).navigate(intent)
    status.value = 'success'
    feedback.value = `Opened ${result.widgetId}`
    input.value = ''
    emit('executed', result)
  } catch (error) {
    const normalized = error instanceof Error ? error : new Error('Command execution failed')
    status.value = 'error'
    feedback.value = normalized instanceof CommandParseError || normalized instanceof WidgetNavigationError
      ? normalized.message
      : 'Command execution failed'
    emit('error', normalized)
  }
}
</script>

<template>
  <form class="wf-command-input" @submit.prevent="submit">
    <label class="wf-command-input__label">
      <span class="wf-command-input__label-text">Command</span>
      <input
        v-model="input"
        class="wf-command-input__field"
        type="text"
        :placeholder="placeholder"
        autocomplete="off"
        spellcheck="false"
        :aria-describedby="status === 'idle' ? undefined : feedbackId"
      />
    </label>
    <button class="wf-command-input__submit" type="submit">{{ submitLabel }}</button>
    <p
      v-if="status !== 'idle'"
      :id="feedbackId"
      class="wf-command-input__feedback"
      :class="`wf-command-input__feedback--${status}`"
      :role="status === 'error' ? 'alert' : 'status'"
    >
      {{ feedback }}
    </p>
  </form>
</template>

<style scoped>
.wf-command-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--wf-space-sm);
  align-items: end;
  color: var(--wf-color-text);
  font-family: var(--wf-font-family);
}

.wf-command-input__label {
  display: grid;
  min-width: 0;
  gap: var(--wf-space-xs);
}

.wf-command-input__label-text {
  color: var(--wf-color-text-muted);
  font-size: var(--wf-font-size-xs);
  font-weight: var(--wf-font-weight-medium);
}

.wf-command-input__field,
.wf-command-input__submit {
  min-height: var(--wf-size-control-height);
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-sm);
  font: inherit;
}

.wf-command-input__field {
  min-width: 0;
  padding: 0 var(--wf-space-sm);
  color: var(--wf-color-text);
  background: var(--wf-color-surface-raised);
}

.wf-command-input__field::placeholder { color: var(--wf-color-text-placeholder); opacity: 1; }

.wf-command-input__submit {
  padding: 0 var(--wf-space-md);
  color: var(--wf-color-accent-contrast);
  background: var(--wf-color-accent);
  border-color: var(--wf-color-accent);
  cursor: pointer;
}

.wf-command-input__field:focus-visible,
.wf-command-input__submit:focus-visible {
  outline: 2px solid var(--wf-color-focus);
  outline-offset: 2px;
}

.wf-command-input__feedback {
  grid-column: 1 / -1;
  margin: 0;
  font-size: var(--wf-font-size-sm);
}

.wf-command-input__feedback--success { color: var(--wf-color-success); }
.wf-command-input__feedback--error { color: var(--wf-color-danger); }
</style>
