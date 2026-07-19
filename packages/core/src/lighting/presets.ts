// Built-in lighting presets (chapter 02 §2.7, roadmap P1-T4). Pure data — no
// backend types — so the headless core owns them (a preset makes sense for *any*
// object: it passes the Generic Test). A renderer adapter turns a preset into
// real lights. This first version ships presets constructed in code (no external
// asset); paired with the environment `neutral-room` IBL, `studio` yields a
// credible PBR look.
import type { LightingPreset } from '../ports/lighting-port';

/** Neutral, three-point studio setup. Combine with a `neutral-room` IBL. */
export const STUDIO_LIGHTING: LightingPreset = {
  id: 'studio',
  lights: [
    { kind: 'hemisphere', skyColor: 0xdfeaff, groundColor: 0x202028, intensity: 0.4 },
    { kind: 'directional', color: 0xffffff, intensity: 2.2, position: [4, 6, 4] },
    { kind: 'directional', color: 0xffffff, intensity: 0.6, position: [-4, 2, -3] },
  ],
};

/** Bright outdoor daylight: warm key sun plus a cool sky/ground bounce. */
export const OUTDOOR_LIGHTING: LightingPreset = {
  id: 'outdoor',
  lights: [
    { kind: 'hemisphere', skyColor: 0xb1d4ff, groundColor: 0x4a4438, intensity: 1.0 },
    { kind: 'directional', color: 0xfff4e0, intensity: 3.0, position: [6, 10, 4] },
  ],
};

/** Dim nocturnal mood: cool moonlight plus a small warm accent. */
export const NIGHT_LIGHTING: LightingPreset = {
  id: 'night',
  lights: [
    { kind: 'hemisphere', skyColor: 0x20304a, groundColor: 0x05070a, intensity: 0.2 },
    { kind: 'directional', color: 0x4466aa, intensity: 0.4, position: [-5, 8, -3] },
    { kind: 'point', color: 0x88aaff, intensity: 1.5, position: [2, 3, 2], distance: 20 },
  ],
};

/** All built-in presets, keyed by id. */
export const lightingPresets = {
  studio: STUDIO_LIGHTING,
  outdoor: OUTDOOR_LIGHTING,
  night: NIGHT_LIGHTING,
} as const;

/** Id of a built-in preset. */
export type LightingPresetId = keyof typeof lightingPresets;

/** Look up a built-in preset by id. */
export function getLightingPreset(id: LightingPresetId): LightingPreset {
  return lightingPresets[id];
}
