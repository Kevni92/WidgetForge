<script setup lang="ts">
import { computed, markRaw, ref } from 'vue'
import {
  ThemeProvider,
  WindowManagerHost,
  createWindowManager,
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

const windowManager = markRaw(createWindowManager(playgroundWidgetRegistry))
windowManager.open({ widgetId: 'planet.summary', instanceId: 'planet-alpha', parameters: { planetId: 'ARC-01' } })
windowManager.open({ widgetId: 'planet.summary', instanceId: 'planet-beta', parameters: { planetId: 'ARC-02', compact: true } })
windowManager.open({ widgetId: 'market.ticker', instanceId: 'market-metals', parameters: { commodity: 'METALS', rows: 6 } })

let nextPlanet = 3

function openPlanet(): void {
  windowManager.open({ widgetId: 'planet.summary', parameters: { planetId: `ARC-0${nextPlanet}` } })
  nextPlanet += 1
}

function openMarket(): void {
  windowManager.open({ widgetId: 'market.ticker', parameters: { commodity: 'FOOD', rows: 5 } })
}
</script>

<template>
  <ThemeProvider :theme="activeTheme">
    <main class="playground-shell">
      <section class="playground-card">
        <header class="playground-header">
          <div>
            <p class="eyebrow">WidgetForge</p>
            <h1>Window Manager Playground</h1>
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

        <p class="intro">Fenster werden ausschließlich über die öffentliche WindowManager-API geöffnet, fokussiert und geschlossen.</p>

        <section class="demo-section">
          <h2>Window Manager</h2>
          <div class="playground-actions">
            <button type="button" data-action="open-planet" @click="openPlanet">Open Planet</button>
            <button type="button" data-action="open-market" @click="openMarket">Open Market</button>
          </div>
          <WindowManagerHost :manager="windowManager" :registry="playgroundWidgetRegistry" />
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
      </section>
    </main>
  </ThemeProvider>
</template>
