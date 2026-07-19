// Config → engine-intent mappers (roadmap P3-T3). Pure data→data functions that
// turn validated config sections into the data-only specs the adapters already
// consume (EnvironmentSpec, lighting preset id). Headless: no Three.js/DOM. This
// is how the engine is driven "from the config" without any object-specific code.
import type { EnvironmentConfig, LightingConfig } from '@explorer-engine/schema';
import type { EnvironmentSpec } from '../ports/environment-port';
import type { LightingPresetId } from '../lighting';

/** Map the config's environment section to the renderer's EnvironmentSpec. */
export function environmentSpecFromConfig(env: EnvironmentConfig): EnvironmentSpec {
  return {
    background: env.background,
    environment: env.source,
    environmentIntensity: env.intensity,
  };
}

/** The lighting preset id selected by the config (feed to getLightingPreset). */
export function lightingPresetIdFromConfig(lighting: LightingConfig): LightingPresetId {
  return lighting.preset;
}
