<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ThemeProvider,
  defaultTheme,
  forgeDarkTheme,
  forgeLightTheme,
  type WidgetForgeTheme,
} from 'widgetforge'
import { playgroundWidgets } from './playground-widgets'

type ThemeName = 'neutral' | 'forge-dark' | 'forge-light'

const themeName = ref<ThemeName>('neutral')
const themes: Record<ThemeName, WidgetForgeTheme> = {
  neutral: defaultTheme,
  'forge-dark': forgeDarkTheme,
  'forge-light': forgeLightTheme,
}

const activeTheme = computed(() => themes[themeName.value])
</script>

<template>
  <ThemeProvider :theme="activeTheme">
    <main class="playground-shell">
      <section class="playground-card">
        <header class="playground-header">
          <div>
            <p class="eyebrow">WidgetForge</p>
            <h1>Widget Contract Playground</h1>
          </div>
          <label class="theme-picker">
            Theme
            <select v-model="themeName">
              <option value="neutral">Neutral</option>
              <option value="forge-dark">Forge Dark</option>
              <option value="forge-light">Forge Light</option>
            </select>
          </label>
        </header>

        <p class="intro">Widgets werden deklarativ über ein kleines, domänenfreies Manifest beschrieben.</p>

        <section class="demo-section">
          <h2>Dummy Widgets</h2>
          <div class="manifest-grid">
            <article v-for="widget in playgroundWidgets" :key="widget.id" class="manifest-card">
              <strong>{{ widget.title }}</strong>
              <code>{{ widget.id }}</code>
              <span class="manifest-meta">
                Parameter: {{ Object.keys(widget.parameters ?? {}).join(', ') || 'keine' }}
              </span>
              <span v-if="widget.window?.defaultSize" class="manifest-meta">
                Default: {{ widget.window.defaultSize.width }} × {{ widget.window.defaultSize.height }}
              </span>
            </article>
          </div>
        </section>

        <section class="demo-section">
          <h2>Theme Tokens</h2>
          <div class="token-demo">
            <div class="demo-surface">Surface</div>
            <div class="demo-surface raised">Raised surface</div>
          </div>
        </section>

        <section class="demo-section">
          <h2>Semantische Zustände</h2>
          <div class="state-grid">
            <span class="state success">Success</span>
            <span class="state warning">Warning</span>
            <span class="state info">Info</span>
            <span class="state danger">Danger</span>
          </div>
        </section>
      </section>
    </main>
  </ThemeProvider>
</template>
