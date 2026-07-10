import type { KinematicChain } from './chainTypes';
import type { IkWorkerRequest, IkWorkerResponse } from './ikProtocol';
import type { IkRequest, IkResult } from './ikTypes';
import type { PreflightRequest, PreflightResult } from './preflight';

type Pending =
  | { kind: 'ik'; resolve: (r: IkResult) => void; reject: (e: Error) => void }
  | { kind: 'preflight'; resolve: (r: PreflightResult | 'cancelled') => void; reject: (e: Error) => void };

/**
 * Main-thread client for the IK worker. All iterative solving happens in the
 * worker; this class only marshals requests/responses.
 */
export class IkWorkerClient {
  private readonly worker: Worker;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readyResolve: (() => void) | null = null;
  private readonly ready: Promise<void>;

  constructor() {
    this.worker = new Worker(new URL('./ikWorker.ts', import.meta.url), { type: 'module' });
    this.ready = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    this.worker.onmessage = (event: MessageEvent<IkWorkerResponse>) => this.onMessage(event.data);
  }

  init(chain: KinematicChain): Promise<void> {
    this.send({ type: 'init', chain });
    return this.ready;
  }

  solveIk(request: IkRequest): Promise<IkResult> {
    const id = this.nextId++;
    return new Promise<IkResult>((resolve, reject) => {
      this.pending.set(id, { kind: 'ik', resolve, reject });
      this.send({ type: 'solveIk', id, request });
    });
  }

  preflight(request: PreflightRequest): { id: number; promise: Promise<PreflightResult | 'cancelled'> } {
    const id = this.nextId++;
    const promise = new Promise<PreflightResult | 'cancelled'>((resolve, reject) => {
      this.pending.set(id, { kind: 'preflight', resolve, reject });
      this.send({ type: 'preflight', id, request });
    });
    return { id, promise };
  }

  cancel(id: number): void {
    this.send({ type: 'cancel', id });
  }

  dispose(): void {
    this.worker.terminate();
  }

  private send(message: IkWorkerRequest): void {
    this.worker.postMessage(message);
  }

  private onMessage(response: IkWorkerResponse): void {
    switch (response.type) {
      case 'ready':
        this.readyResolve?.();
        return;
      case 'ikResult': {
        const p = this.pending.get(response.id);
        if (p?.kind === 'ik') p.resolve(response.result);
        this.pending.delete(response.id);
        return;
      }
      case 'preflightResult': {
        const p = this.pending.get(response.id);
        if (p?.kind === 'preflight') p.resolve(response.result);
        this.pending.delete(response.id);
        return;
      }
      case 'cancelled': {
        const p = this.pending.get(response.id);
        if (p?.kind === 'preflight') p.resolve('cancelled');
        this.pending.delete(response.id);
        return;
      }
      case 'error': {
        if (response.id !== null) {
          this.pending.get(response.id)?.reject(new Error(response.message));
          this.pending.delete(response.id);
        }
        return;
      }
    }
  }
}
