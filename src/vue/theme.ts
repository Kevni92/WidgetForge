export interface WidgetForgeTheme {
  color: {
    canvas: string
    surface: string
    surfaceRaised: string
    text: string
    textMuted: string
    border: string
    accent: string
    accentContrast: string
    danger: string
    success: string
    warning: string
    info: string
    focus: string
    hover: string
    selected: string
  }
  font: {
    family: string
    sizeXs: string
    sizeSm: string
    sizeMd: string
    sizeLg: string
    weightRegular: number
    weightMedium: number
    weightBold: number
  }
  space: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
  }
  radius: {
    sm: string
    md: string
    lg: string
  }
  shadow: {
    sm: string
    md: string
  }
  size: {
    controlHeight: string
    titlebarHeight: string
  }
  layer: {
    base: number
    window: number
    overlay: number
    tooltip: number
  }
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export type WidgetForgeThemeOverride = DeepPartial<WidgetForgeTheme>

export const defaultTheme: WidgetForgeTheme = {
  color: {
    canvas: '#11161d',
    surface: '#18202a',
    surfaceRaised: '#202a36',
    text: '#e8edf2',
    textMuted: '#aeb9c5',
    border: '#2b3541',
    accent: '#62a8ff',
    accentContrast: '#07111d',
    danger: '#ff6b6b',
    success: '#53c58c',
    warning: '#e6a44e',
    info: '#62a8ff',
    focus: '#8bc1ff',
    hover: 'rgb(255 255 255 / 0.06)',
    selected: 'rgb(98 168 255 / 0.16)',
  },
  font: {
    family: 'Inter, ui-sans-serif, system-ui, sans-serif',
    sizeXs: '0.75rem',
    sizeSm: '0.875rem',
    sizeMd: '1rem',
    sizeLg: '1.25rem',
    weightRegular: 400,
    weightMedium: 600,
    weightBold: 700,
  },
  space: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px' },
  radius: { sm: '4px', md: '8px', lg: '12px' },
  shadow: {
    sm: '0 2px 8px rgb(0 0 0 / 0.18)',
    md: '0 8px 24px rgb(0 0 0 / 0.28)',
  },
  size: { controlHeight: '32px', titlebarHeight: '36px' },
  layer: { base: 0, window: 100, overlay: 1000, tooltip: 2000 },
}

function mergeSection<T extends object>(base: T, override?: DeepPartial<T>): T {
  return { ...base, ...(override ?? {}) } as T
}

export function createTheme(override: WidgetForgeThemeOverride = {}): WidgetForgeTheme {
  return {
    color: mergeSection(defaultTheme.color, override.color),
    font: mergeSection(defaultTheme.font, override.font),
    space: mergeSection(defaultTheme.space, override.space),
    radius: mergeSection(defaultTheme.radius, override.radius),
    shadow: mergeSection(defaultTheme.shadow, override.shadow),
    size: mergeSection(defaultTheme.size, override.size),
    layer: mergeSection(defaultTheme.layer, override.layer),
  }
}

export function themeToCssVariables(theme: WidgetForgeTheme): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [groupName, group] of Object.entries(theme)) {
    for (const [tokenName, value] of Object.entries(group)) {
      const kebab = tokenName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
      result[`--wf-${groupName}-${kebab}`] = String(value)
    }
  }
  return result
}
