import type { KinematicChain } from './chainTypes';
import type { FkRequest, FkResponse } from './fkProtocol';
import type { FkResult, JointValues } from './forwardKinematics';

/**
 * Thin client around the FK worker. Establishes the worker, sends `init`, and
 * exposes a promise-based `solve`. Kept small for Gate 2; the IK gate will build
 * on this transport.
 */
export class FkWorkerClient {
  private readonly worker: Worker;
  private nextId = 1;
  private readonly pending = new Map<number, (result: FkResult) => void>();
  private readonly rejecters = new Map<number, (error: Error) => void>();
  private readyResolve: (() => void) | null = null;
  private readonly ready: Promise<void>;

  constructor() {
    this.worker = new Worker(new URL('./fkWorker.ts', import.meta.url), { type: 'module' });
    this.ready = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    this.worker.onmessage = (event: MessageEvent<FkResponse>) => this.onMessage(event.data);
  }

  init(chain: KinematicChain): Promise<void> {
    const message: FkRequest = { type: 'init', chain };
    this.worker.postMessage(message);
    return this.ready;
  }

  solve(jointValues: JointValues): Promise<FkResult> {
    const id = this.nextId++;
    const message: FkRequest = { type: 'fk', id, jointValues };
    return new Promise<FkResult>((resolve, reject) => {
      this.pending.set(id, resolve);
      this.rejecters.set(id, reject);
      this.worker.postMessage(message);
    });
  }

  dispose(): void {
    this.worker.terminate();
  }

  private onMessage(response: FkResponse): void {
    switch (response.type) {
      case 'ready':
        this.readyResolve?.();
        break;
      case 'fkResult': {
        this.pending.get(response.id)?.(response.result);
        this.pending.delete(response.id);
        this.rejecters.delete(response.id);
        break;
      }
      case 'error': {
        if (response.id !== null) {
          this.rejecters.get(response.id)?.(new Error(response.message));
          this.pending.delete(response.id);
          this.rejecters.delete(response.id);
        }
        break;
      }
    }
  }
}
