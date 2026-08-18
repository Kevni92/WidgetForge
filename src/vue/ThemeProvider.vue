<script setup lang="ts">
import { computed, provide } from 'vue'
import { createTheme, themeToCssVariables, type WidgetForgeThemeOverride } from './theme'
import { themeKey } from './theme-context'

const props = withDefaults(defineProps<{ theme?: WidgetForgeThemeOverride }>(), {
  theme: () => ({}),
})

const resolvedTheme = computed(() => createTheme(props.theme))
const cssVariables = computed(() => themeToCssVariables(resolvedTheme.value))

provide(themeKey, resolvedTheme)
</script>

<template>
  <div class="wf-theme" :style="cssVariables">
    <slot />
  </div>
</template>

<style>
.wf-theme {
  min-height: 100%;
  font-family: var(--wf-font-family);
  font-size: var(--wf-font-size-md);
  color: var(--wf-color-text);
  background: var(--wf-color-canvas);
}
</style>
