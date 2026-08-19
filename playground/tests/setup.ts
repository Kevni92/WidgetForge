import { afterEach, beforeEach } from 'vitest'

type VitestGlobal = typeof globalThis & { jsdom?: { window: { localStorage: Storage } } }
const jsdomWindow = (globalThis as VitestGlobal).jsdom?.window
if (!jsdomWindow) throw new Error('Playground tests require the Vitest jsdom environment')

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: jsdomWindow.localStorage })

function clearStorage(): void {
  window.localStorage.clear()
}

beforeEach(clearStorage)
afterEach(clearStorage)
