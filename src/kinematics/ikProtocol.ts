import type { KinematicChain } from './chainTypes';
import type { IkRequest, IkResult } from './ikTypes';
import type { PreflightRequest, PreflightResult } from './preflight';

/** IK worker request/response API (structured-clone safe). */

export type IkWorkerRequest =
  | { readonly type: 'init'; readonly chain: KinematicChain }
  | { readonly type: 'solveIk'; readonly id: number; readonly request: IkRequest }
  | { readonly type: 'preflight'; readonly id: number; readonly request: PreflightRequest }
  | { readonly type: 'cancel'; readonly id: number };

export type IkWorkerResponse =
  | { readonly type: 'ready' }
  | { readonly type: 'ikResult'; readonly id: number; readonly result: IkResult }
  | { readonly type: 'preflightResult'; readonly id: number; readonly result: PreflightResult }
  | { readonly type: 'cancelled'; readonly id: number }
  | { readonly type: 'error'; readonly id: number | null; readonly message: string };
