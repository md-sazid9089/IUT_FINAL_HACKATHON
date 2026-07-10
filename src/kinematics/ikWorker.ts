import type { KinematicChain } from './chainTypes';
import { solveIK } from './ikSolver';
import { runPreflightCancellable } from './preflight';
import type { IkWorkerRequest, IkWorkerResponse } from './ikProtocol';

/**
 * Dedicated IK worker. Runs the iterative DLS/LM solver, alternate-seed
 * evaluation, and key-pose preflight OFF the main thread. Preflight yields
 * between keys so `cancel` messages can be observed mid-run.
 */

let chain: KinematicChain | null = null;
const cancelled = new Set<number>();

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<IkWorkerRequest>) => void) | null;
  postMessage: (message: IkWorkerResponse) => void;
};

function post(message: IkWorkerResponse): void {
  ctx.postMessage(message);
}

ctx.onmessage = (event) => {
  const msg = event.data;
  switch (msg.type) {
    case 'init':
      chain = msg.chain;
      post({ type: 'ready' });
      return;

    case 'cancel':
      cancelled.add(msg.id);
      return;

    case 'solveIk': {
      if (!chain) {
        post({ type: 'error', id: msg.id, message: 'Chain not initialized' });
        return;
      }
      try {
        const result = solveIK(chain, msg.request);
        post({ type: 'ikResult', id: msg.id, result });
      } catch (err) {
        post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    case 'preflight': {
      if (!chain) {
        post({ type: 'error', id: msg.id, message: 'Chain not initialized' });
        return;
      }
      void runPreflightCancellable(chain, msg.request, () => cancelled.has(msg.id))
        .then((outcome) => {
          if ('cancelled' in outcome) {
            post({ type: 'cancelled', id: msg.id });
          } else {
            post({ type: 'preflightResult', id: msg.id, result: outcome });
          }
          cancelled.delete(msg.id);
        })
        .catch((err: unknown) => {
          post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
          cancelled.delete(msg.id);
        });
      return;
    }
  }
};
