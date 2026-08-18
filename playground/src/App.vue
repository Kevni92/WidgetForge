<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ThemeProvider,
  defaultTheme,
  forgeDarkTheme,
  forgeLightTheme,
  type WidgetForgeTheme,
} from 'widgetforge'

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
            <h1>Theme Playground</h1>
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

        <p class="intro">Forge ist ein offizielles Preset auf derselben generischen Theme-API wie das neutrale Standard-Theme.</p>

        <div class="token-demo">
          <div class="demo-surface">Surface</div>
          <div class="demo-surface raised">Raised surface</div>
        </div>

        <section class="demo-section">
          <h2>Semantische Zustände</h2>
          <div class="state-grid">
            <span class="state success">Success</span>
            <span class="state warning">Warning</span>
            <span class="state info">Info</span>
            <span class="state danger">Danger</span>
          </div>
        </section>

        <section class="demo-section">
          <h2>Interaktion</h2>
          <div class="interaction-grid">
            <button class="interaction hover">Hover</button>
            <button class="interaction selected">Selected</button>
            <button class="interaction focus">Focus</button>
          </div>
        </section>
      </section>
    </main>
  </ThemeProvider>
</template>
