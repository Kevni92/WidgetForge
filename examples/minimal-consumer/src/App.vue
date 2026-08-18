<script setup lang="ts">
import { markRaw } from 'vue'
import {
  ThemeProvider,
  WindowManagerHost,
  createWidgetRegistry,
  createWindowManager,
  defaultTheme,
  defineWidget,
} from 'widgetforge'
import DemoWidget from './DemoWidget.vue'

const registry = markRaw(createWidgetRegistry([
  defineWidget({
    id: 'example.hello',
    title: 'Hello Widget',
    component: DemoWidget,
    window: {
      defaultSize: { width: 360, height: 220 },
      minSize: { width: 260, height: 160 },
    },
  }),
]))

const manager = markRaw(createWindowManager(registry))
manager.open({
  widgetId: 'example.hello',
  instanceId: 'hello-example',
  position: { x: 24, y: 24 },
})
</script>

<template>
  <ThemeProvider :theme="defaultTheme">
    <main class="consumer-shell">
      <h1>WidgetForge package consumer</h1>
      <div class="consumer-workspace">
        <WindowManagerHost :manager="manager" :registry="registry" />
      </div>
    </main>
  </ThemeProvider>
</template>

<style scoped>
.consumer-shell {
  min-height: 100vh;
  margin: 0;
  padding: var(--wf-space-lg);
  background: var(--wf-color-canvas);
  color: var(--wf-color-text);
  font-family: var(--wf-font-family);
}

.consumer-shell h1 {
  margin: 0 0 var(--wf-space-lg);
  font-size: var(--wf-font-size-lg);
}

.consumer-workspace {
  position: relative;
  min-height: 420px;
  border: 1px solid var(--wf-color-border);
  border-radius: var(--wf-radius-md);
  background: var(--wf-color-surface);
  overflow: hidden;
}
</style>
