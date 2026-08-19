import { inject, provide, type InjectionKey } from 'vue'
import type { WorkspaceEditMode } from 'widgetforge'

export type DemoThemeName = 'forge-dark' | 'forge-light'
export interface DemoControls {
  readonly theme: () => DemoThemeName
  readonly setTheme: (theme: DemoThemeName) => void
  readonly resetWorkspace: () => void
  readonly canUndo?: () => boolean
  readonly canRedo?: () => boolean
  readonly undo?: () => void
  readonly redo?: () => void
  readonly workspaceMode?: () => WorkspaceEditMode
  readonly setWorkspaceMode?: (mode: WorkspaceEditMode) => void
  readonly layoutNames?: () => readonly string[]
  readonly activeLayout?: () => string | null
  readonly loadLayout?: (name: string) => void
  readonly developerMode?: () => boolean
  readonly setDeveloperMode?: (enabled: boolean) => void
  readonly feedOnline?: () => boolean
  readonly simulateFeedFailure?: () => void
  readonly recoverFeed?: () => void
  readonly notify?: (title: string, message: string, severity?: 'info' | 'success' | 'warning' | 'error') => void
}
const key:InjectionKey<DemoControls>=Symbol('WidgetForgePlaygroundDemoControls')
export function provideDemoControls(controls:DemoControls):void{provide(key,controls)}
export function useDemoControls():DemoControls{const controls=inject(key);if(!controls)throw new Error('playground demo controls are unavailable');return controls}
