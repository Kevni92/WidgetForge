export type WorkspaceMigrationDocument = Readonly<Record<string, unknown>>
export type WorkspaceMigrationStep = (document: WorkspaceMigrationDocument) => WorkspaceMigrationDocument

export interface WorkspaceMigrationDefinition {
  readonly fromVersion: number
  readonly toVersion: number
  readonly migrate: WorkspaceMigrationStep
}

export interface WorkspaceMigrationResult {
  readonly fromVersion: number
  readonly toVersion: number
  readonly appliedVersions: readonly number[]
  readonly document: WorkspaceMigrationDocument
}

export type WorkspaceMigrationErrorCode =
  | 'invalid-document'
  | 'invalid-version'
  | 'invalid-step'
  | 'duplicate-step'
  | 'future-version'
  | 'missing-path'
  | 'migration-failed'
  | 'non-serializable-result'

export class WorkspaceMigrationError extends Error {
  constructor(
    public readonly code: WorkspaceMigrationErrorCode,
    message: string,
    public readonly fromVersion?: number,
    public readonly toVersion?: number,
  ) {
    super(message)
    this.name = 'WorkspaceMigrationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function versionOf(value: unknown): number {
  if (!isRecord(value)) throw new WorkspaceMigrationError('invalid-document', 'workspace migration input must be an object')
  if (!Number.isInteger(value.version) || (value.version as number) < 1) {
    throw new WorkspaceMigrationError('invalid-version', 'workspace migration input must contain a positive integer version')
  }
  return value.version as number
}

function serializableClone(value: unknown, code: WorkspaceMigrationErrorCode): WorkspaceMigrationDocument {
  let serialized: string | undefined
  try { serialized = JSON.stringify(value) }
  catch (error) { throw new WorkspaceMigrationError(code, error instanceof Error ? error.message : 'workspace migration value is not serializable') }
  if (serialized === undefined) throw new WorkspaceMigrationError(code, 'workspace migration value is not serializable')
  const cloned = JSON.parse(serialized) as unknown
  if (!isRecord(cloned)) throw new WorkspaceMigrationError(code, 'workspace migration value must serialize to an object')
  return cloned
}

export class WorkspaceMigrationRegistry {
  private readonly steps = new Map<number, WorkspaceMigrationDefinition>()

  constructor(definitions: readonly WorkspaceMigrationDefinition[] = []) {
    for (const definition of definitions) this.register(definition)
  }

  register(definition: WorkspaceMigrationDefinition): void {
    if (!Number.isInteger(definition.fromVersion) || definition.fromVersion < 1 || definition.toVersion !== definition.fromVersion + 1) {
      throw new WorkspaceMigrationError('invalid-step', 'workspace migrations must be adjacent positive version steps vN -> vN+1', definition.fromVersion, definition.toVersion)
    }
    if (this.steps.has(definition.fromVersion)) {
      throw new WorkspaceMigrationError('duplicate-step', `workspace migration v${definition.fromVersion} -> v${definition.toVersion} is already registered`, definition.fromVersion, definition.toVersion)
    }
    this.steps.set(definition.fromVersion, { ...definition })
  }

  list(): readonly WorkspaceMigrationDefinition[] {
    return [...this.steps.values()].sort((left, right) => left.fromVersion - right.fromVersion).map((definition) => ({ ...definition }))
  }

  migrate(input: unknown, targetVersion: number): WorkspaceMigrationResult {
    if (!Number.isInteger(targetVersion) || targetVersion < 1) throw new WorkspaceMigrationError('invalid-version', 'target workspace version must be a positive integer')
    let document = serializableClone(input, 'invalid-document')
    const fromVersion = versionOf(document)
    if (fromVersion > targetVersion) throw new WorkspaceMigrationError('future-version', `workspace version ${fromVersion} is newer than supported version ${targetVersion}`, fromVersion, targetVersion)
    const appliedVersions: number[] = []
    let currentVersion = fromVersion
    while (currentVersion < targetVersion) {
      const definition = this.steps.get(currentVersion)
      if (!definition) throw new WorkspaceMigrationError('missing-path', `no workspace migration registered for v${currentVersion} -> v${currentVersion + 1}`, currentVersion, currentVersion + 1)
      let migrated: WorkspaceMigrationDocument
      try { migrated = definition.migrate(serializableClone(document, 'non-serializable-result')) }
      catch (error) {
        if (error instanceof WorkspaceMigrationError) throw error
        throw new WorkspaceMigrationError('migration-failed', error instanceof Error ? error.message : `workspace migration v${currentVersion} failed`, currentVersion, currentVersion + 1)
      }
      document = serializableClone(migrated, 'non-serializable-result')
      const migratedVersion = versionOf(document)
      if (migratedVersion !== currentVersion + 1) {
        throw new WorkspaceMigrationError('invalid-step', `workspace migration v${currentVersion} must produce version ${currentVersion + 1}, received ${migratedVersion}`, currentVersion, currentVersion + 1)
      }
      currentVersion = migratedVersion
      appliedVersions.push(currentVersion)
    }
    return { fromVersion, toVersion: targetVersion, appliedVersions, document }
  }
}

function legacyWindowToV2(value: unknown): unknown {
  if (!isRecord(value) || typeof value.instanceId !== 'string' || !value.instanceId.trim() || typeof value.widgetId !== 'string' || !value.widgetId.trim()) return value
  if (!isRecord(value.parameters) || !isRecord(value.geometry) || (value.mode !== 'normal' && value.mode !== 'minimized') || typeof value.focused !== 'boolean' || !Number.isInteger(value.zIndex)) return value
  return {
    instanceId: value.instanceId,
    title: value.widgetId,
    rootPane: { kind: 'widget', id: `${value.instanceId}.root`, widgetId: value.widgetId, instanceId: value.instanceId, parameters: value.parameters },
    geometry: value.geometry,
    constraints: { minSize: { width: 160, height: 96 }, maxSize: null },
    options: {
      role: 'normal', layer: 'normal', movable: true, resizable: true, minimizable: true, maximizable: true, closable: true,
      opacity: 1, header: 'always', chrome: 'default', glass: false, headerActions: [],
    },
    snap: null,
    restoreGeometry: null,
    mode: value.mode,
    focused: value.focused,
    zIndex: value.zIndex,
  }
}

export const migrateWorkspaceV1ToV2: WorkspaceMigrationStep = (document) => ({
  ...document,
  version: 2,
  windows: Array.isArray(document.windows) ? document.windows.map(legacyWindowToV2) : document.windows,
  docks: [],
})

export const migrateWorkspaceV2ToV3: WorkspaceMigrationStep = (document) => ({
  ...document,
  version: 3,
  ...(document.docks === undefined ? { docks: [] } : {}),
})

export function createWorkspaceMigrationRegistry(definitions: readonly WorkspaceMigrationDefinition[] = []): WorkspaceMigrationRegistry {
  return new WorkspaceMigrationRegistry(definitions)
}

export function createDefaultWorkspaceMigrationRegistry(): WorkspaceMigrationRegistry {
  return createWorkspaceMigrationRegistry([
    { fromVersion: 1, toVersion: 2, migrate: migrateWorkspaceV1ToV2 },
    { fromVersion: 2, toVersion: 3, migrate: migrateWorkspaceV2ToV3 },
  ])
}

export const defaultWorkspaceMigrationRegistry = createDefaultWorkspaceMigrationRegistry()
