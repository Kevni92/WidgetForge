<script setup lang="ts">
import { computed, markRaw, ref } from 'vue'
import {
  CommandInput,
  ThemeProvider,
  WindowManagerHost,
  createCommandRegistry,
  createWidgetNavigator,
  createWindowManager,
  defaultTheme,
  forgeDarkTheme,
  forgeLightTheme,
  restoreWorkspace,
  serializeWorkspace,
  type WidgetForgeTheme,
} from 'widgetforge'
import { playgroundWidgetRegistry, playgroundWidgets } from './playground-widgets'

type ThemeName = 'neutral' | 'forge-dark' | 'forge-light'

const WORKSPACE_STORAGE_KEY = 'widgetforge.playground.workspace.v1'

const themeName = ref<ThemeName>('neutral')
const themes: Record<ThemeName, WidgetForgeTheme> = {
  neutral: defaultTheme,
  'forge-dark': forgeDarkTheme,
  'forge-light': forgeLightTheme,
}
const activeTheme = computed(() => themes[themeName.value])

const windowManager = markRaw(createWindowManager(playgroundWidgetRegistry))
const commandNavigator = markRaw(createWidgetNavigator(playgroundWidgetRegistry, windowManager))
const commands = markRaw(createCommandRegistry([
  {
    name: 'planet',
    aliases: ['p'],
    widgetId: 'planet.summary',
    arguments: [
      { name: 'planetId', type: 'string', required: true },
      { name: 'compact', type: 'boolean', default: false },
    ],
  },
  {
    name: 'market',
    aliases: ['mkt'],
    widgetId: 'market.ticker',
    parameters: { commodity: 'METALS' },
    arguments: [{ name: 'rows', type: 'number', default: 5 }],
  },
]))

function readStoredWorkspace(): string | null {
  try {
    return window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
  } catch {
    return null
  }
}

function persistWorkspace(): void {
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, serializeWorkspace(windowManager))
  } catch {
    // Playground persistence is best-effort and must not break the framework demo.
  }
}

function openDefaultWorkspace(): void {
  windowManager.open({
    widgetId: 'planet.summary',
    instanceId: 'planet-alpha',
    parameters: { planetId: 'ARC-01' },
    position: { x: 32, y: 32 },
  })
  windowManager.open({
    widgetId: 'planet.summary',
    instanceId: 'planet-beta',
    parameters: { planetId: 'ARC-02', compact: true },
    position: { x: 190, y: 250 },
  })
  windowManager.open({
    widgetId: 'market.ticker',
    instanceId: 'market-metals',
    parameters: { commodity: 'METALS', rows: 6 },
    position: { x: 390, y: 70 },
  })
}

const storedWorkspace = readStoredWorkspace()
const restoredWorkspace = storedWorkspace ? restoreWorkspace(windowManager, storedWorkspace) : null
if (!restoredWorkspace?.valid) openDefaultWorkspace()
persistWorkspace()
windowManager.subscribe(persistWorkspace)

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
            <h1>Floating Window Playground</h1>
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

        <p class="intro">Fenster lassen sich verschieben und skalieren. Widgets können intern navigieren und registrierte Textbefehle öffnen dieselben Widgets über die normale Navigation. Das Workspace-Layout wird lokal im Browser gespeichert.</p>

        <section class="demo-section command-demo">
          <h2>Commands</h2>
          <CommandInput :commands="commands" :navigator="commandNavigator" placeholder="planet ARC-03" />
          <p class="manifest-meta">Beispiele: <code>planet ARC-03</code>, <code>p "New Terra" true</code>, <code>market 8</code></p>
        </section>

        <section class="demo-section">
          <h2>Window Manager</h2>
          <div class="playground-actions">
            <button type="button" data-action="open-planet" @click="openPlanet">Open Planet</button>
            <button type="button" data-action="open-market" @click="openMarket">Open Market</button>
          </div>
          <div class="window-playground-area">
            <WindowManagerHost :manager="windowManager" :registry="playgroundWidgetRegistry" />
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
      </section>
    </main>
  </ThemeProvider>
</template>
