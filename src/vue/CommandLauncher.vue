<script setup lang="ts">
import type { CommandRegistry } from '../core/commands'
import type { NavigationResult, WidgetNavigationContext, WidgetNavigator } from '../core/navigation'
import CommandInput from './CommandInput.vue'

interface CommandLauncherProps {
  commands?: CommandRegistry | undefined
  navigator: WidgetNavigator
  context?: WidgetNavigationContext | undefined
  placeholder?: string | undefined
  submitLabel?: string | undefined
}

const props = withDefaults(defineProps<CommandLauncherProps>(), {
  placeholder: 'Type a command',
  submitLabel: 'Open',
})

const emit = defineEmits<{
  executed: [result: NavigationResult]
  error: [error: Error]
  close: []
}>()
</script>

<template>
  <section class="wf-command-launcher" data-command-launcher aria-label="Command launcher" @keydown.esc.prevent="emit('close')">
    <CommandInput
      v-if="props.commands"
      :commands="props.commands"
      :navigator="props.navigator"
      :context="props.context"
      :placeholder="props.placeholder"
      :submit-label="props.submitLabel"
      auto-focus
      @executed="emit('executed', $event)"
      @error="emit('error', $event)"
    />
    <p v-else class="wf-command-launcher__unavailable" data-command-launcher-unavailable>
      No command registry is configured for this workspace.
    </p>
  </section>
</template>

<style scoped>
.wf-command-launcher{display:flex;min-width:0;min-height:0;width:100%;height:100%;flex-direction:column;justify-content:center;color:var(--wf-color-text);font-family:var(--wf-font-family)}
.wf-command-launcher__unavailable{margin:0;color:var(--wf-color-text-muted);font-size:var(--wf-font-size-sm)}
</style>
