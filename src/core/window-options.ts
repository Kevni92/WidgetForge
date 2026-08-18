export type WindowLayer = 'normal' | 'always-on-top'
export type WindowHeaderMode = 'always' | 'focused' | 'hidden'

export interface WindowOptions {
  readonly layer: WindowLayer
  readonly movable: boolean
  readonly resizable: boolean
  readonly minimizable: boolean
  readonly closable: boolean
  readonly opacity: number
  readonly header: WindowHeaderMode
}

export type WindowOptionsOverride = Partial<WindowOptions>

export const defaultWindowOptions: WindowOptions = {
  layer: 'normal',
  movable: true,
  resizable: true,
  minimizable: true,
  closable: true,
  opacity: 1,
  header: 'always',
}

export class WindowOptionsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WindowOptionsError'
  }
}

export function createWindowOptions(override: WindowOptionsOverride = {}): WindowOptions {
  const options: WindowOptions = { ...defaultWindowOptions, ...override }
  if (options.layer !== 'normal' && options.layer !== 'always-on-top') {
    throw new WindowOptionsError(`unknown window layer "${String(options.layer)}"`)
  }
  if (options.header !== 'always' && options.header !== 'focused' && options.header !== 'hidden') {
    throw new WindowOptionsError(`unknown window header mode "${String(options.header)}"`)
  }
  if (!Number.isFinite(options.opacity) || options.opacity < 0 || options.opacity > 1) {
    throw new WindowOptionsError('window opacity must be between 0 and 1')
  }
  return options
}
