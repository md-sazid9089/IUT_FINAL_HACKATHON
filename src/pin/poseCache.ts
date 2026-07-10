import type { RobotProfile } from '../config/robotProfiles';
import type { KeyConfig } from '../config/keyConfig';
import { PIN_MOTION_CONFIG } from './pinConfig';
import type { PinPlan } from './pinPlanner';

export interface PoseCacheKeyInput {
  readonly urdfHash: string;
  readonly keyConfigHash: string;
  readonly profile: RobotProfile;
  readonly approachAxis: string;
}

export interface PoseCacheEntry {
  readonly key: string;
  readonly createdAt: number;
  readonly plan: PinPlan;
}

const cache = new Map<string, PoseCacheEntry>();

function stableJson(input: unknown): string {
  return JSON.stringify(input, Object.keys(input as object).sort());
}

export async function hashText(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function buildPoseCacheKey(input: PoseCacheKeyInput): string {
  return stableJson({
    urdfHash: input.urdfHash,
    keyConfigHash: input.keyConfigHash,
    robotProfile: input.profile.id,
    activeJoints: input.profile.activeJoints,
    lockedJoints: input.profile.lockedJoints,
    approachAxis: input.approachAxis,
    solverSettingsVersion: PIN_MOTION_CONFIG.solverSettingsVersion,
    safetySettingsVersion: PIN_MOTION_CONFIG.safetySettingsVersion,
  });
}

export async function cacheKeyForRuntimeAssets(keyConfig: KeyConfig, profile: RobotProfile): Promise<string> {
  const [urdfText, keyText] = await Promise.all([
    fetch('/robot/6_dof_arm.urdf').then((r) => r.text()),
    Promise.resolve(JSON.stringify(keyConfig)),
  ]);
  return buildPoseCacheKey({
    urdfHash: await hashText(urdfText),
    keyConfigHash: await hashText(keyText),
    profile,
    approachAxis: keyConfig.approach_axis,
  });
}

export function getCachedPlan(key: string, pin: string): PinPlan | null {
  const entry = cache.get(`${key}:${pin}`);
  return entry?.plan ?? null;
}

export function setCachedPlan(key: string, plan: PinPlan): void {
  if (!plan.allVerified) return;
  cache.set(`${key}:${plan.pin}`, { key, plan, createdAt: Date.now() });
}

export function clearPoseCache(): void {
  cache.clear();
}
