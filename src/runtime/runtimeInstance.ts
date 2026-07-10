import type { RuntimeController } from './RuntimeController';

/**
 * Process-wide handle to the single RuntimeController. The controller is created
 * once the URDF has loaded (it needs joint metadata and the adapter). UI input
 * paths submit commands through this handle; they never touch the URDF directly.
 */
let runtime: RuntimeController | null = null;

export function setRuntime(controller: RuntimeController | null): void {
  runtime = controller;
}

export function getRuntime(): RuntimeController | null {
  return runtime;
}
