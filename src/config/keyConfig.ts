import { z } from 'zod';

/**
 * Zod schema for the organizer key configuration (`key.config.json`).
 *
 * The file is an immutable source artifact. A verified runtime copy lives at
 * `public/config/key.config.json`. This schema validates that copy at load time
 * so malformed data fails loudly instead of silently corrupting targeting.
 */

export const APPROACH_AXES = ['x', '-x', 'y', '-y', 'z', '-z'] as const;
export type ApproachAxis = (typeof APPROACH_AXES)[number];

const finiteNumber = z.number().finite();

export const Vec3Schema = z.object({
  x: finiteNumber,
  y: finiteNumber,
  z: finiteNumber,
});
export type Vec3Coord = z.infer<typeof Vec3Schema>;

export const KeyConfigSchema = z.object({
  frame: z.string().min(1),
  units: z.string().min(1),
  approach_axis: z.enum(APPROACH_AXES),
  keys: z.record(z.string().min(1), Vec3Schema),
});

export type KeyConfig = z.infer<typeof KeyConfigSchema>;

/** Parse and validate an unknown value as a KeyConfig. Throws ZodError on failure. */
export function parseKeyConfig(data: unknown): KeyConfig {
  return KeyConfigSchema.parse(data);
}

/** Fetch and validate the runtime key configuration copy. */
export async function loadKeyConfig(url: string): Promise<KeyConfig> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load key config (${response.status} ${response.statusText})`);
  }
  const json: unknown = await response.json();
  return parseKeyConfig(json);
}
