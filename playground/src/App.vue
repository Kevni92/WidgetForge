<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ThemeProvider,
  WindowShell,
  defaultTheme,
  forgeDarkTheme,
  forgeLightTheme,
  type WidgetForgeTheme,
} from 'widgetforge'
import { playgroundWidgetRegistry, playgroundWidgets } from './playground-widgets'

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
            <h1>Window Shell Playground</h1>
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

        <p class="intro">WindowShell stellt generisches Fenster-Chrome bereit und hält den Widget-Inhalt davon getrennt.</p>

        <section class="demo-section">
          <h2>Window Shells</h2>
          <div class="manifest-grid">
            <WindowShell
              :registry="playgroundWidgetRegistry"
              widget-id="planet.summary"
              instance-id="planet-alpha"
              :parameters="{ planetId: 'ARC-01' }"
              focused
            />
            <WindowShell
              :registry="playgroundWidgetRegistry"
              widget-id="planet.summary"
              instance-id="planet-beta"
              :parameters="{ planetId: 'ARC-02', compact: true }"
            />
            <WindowShell
              :registry="playgroundWidgetRegistry"
              widget-id="market.ticker"
              instance-id="market-metals"
              :parameters="{ commodity: 'METALS', rows: 6 }"
            />
          </div>
        </section>

        <section class="demo-section">
          <h2>Widget Manifests</h2>
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
