// Config migration (chapter 05 §5.3.1). Bumps an older schemaVersion to the
// current one before validation, so a package authored against a previous schema
// keeps working (backward compatibility, P10). Pure and data-only.

export interface MigrationResult {
  /** The (possibly rewritten) raw config to feed to the validator. */
  readonly raw: unknown;
  /** The version migrated from, or null if no migration applied. */
  readonly migratedFrom: string | null;
}

/**
 * Apply forward migrations. Currently one demonstrator step:
 * `0.9` used `model.file`; `1.0` renamed it to `model.src`.
 */
export function migrateConfig(input: unknown): MigrationResult {
  if (typeof input !== 'object' || input === null) return { raw: input, migratedFrom: null };
  const obj = input as Record<string, unknown>;
  const version =
    typeof obj['schemaVersion'] === 'string' ? (obj['schemaVersion'] as string) : null;

  if (version === '0.9') {
    const modelInput =
      typeof obj['model'] === 'object' && obj['model'] !== null
        ? { ...(obj['model'] as Record<string, unknown>) }
        : {};
    if ('file' in modelInput && !('src' in modelInput)) {
      modelInput['src'] = modelInput['file'];
      delete modelInput['file'];
    }
    return { raw: { ...obj, schemaVersion: '1.0', model: modelInput }, migratedFrom: '0.9' };
  }

  return { raw: input, migratedFrom: null };
}
