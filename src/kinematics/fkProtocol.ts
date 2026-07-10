import type { KinematicChain } from './chainTypes';
import { computeForwardKinematics, type FkResult, type JointValues } from './forwardKinematics';

/**
 * Worker protocol for chain storage + FK evaluation.
 *
 * The request/response messages are structured-clone safe (plain data). The
 * handler is a pure function so it can be unit-tested without a real Worker.
 */

export type FkRequest =
  | { readonly type: 'init'; readonly chain: KinematicChain }
  | { readonly type: 'fk'; readonly id: number; readonly jointValues: JointValues };

export type FkResponse =
  | { readonly type: 'ready' }
  | { readonly type: 'fkResult'; readonly id: number; readonly result: FkResult }
  | { readonly type: 'error'; readonly id: number | null; readonly message: string };

export interface FkWorkerState {
  chain: KinematicChain | null;
}

export function createWorkerState(): FkWorkerState {
  return { chain: null };
}

export function handleRequest(state: FkWorkerState, request: FkRequest): FkResponse {
  try {
    switch (request.type) {
      case 'init':
        state.chain = request.chain;
        return { type: 'ready' };
      case 'fk': {
        if (!state.chain) {
          return { type: 'error', id: request.id, message: 'Chain not initialized' };
        }
        const result = computeForwardKinematics(state.chain, request.jointValues);
        return { type: 'fkResult', id: request.id, result };
      }
    }
  } catch (err) {
    const id = request.type === 'fk' ? request.id : null;
    return { type: 'error', id, message: err instanceof Error ? err.message : String(err) };
  }
}
