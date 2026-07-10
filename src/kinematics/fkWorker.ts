import { createWorkerState, handleRequest, type FkRequest, type FkResponse } from './fkProtocol';

/**
 * Dedicated FK worker. Stores the kinematic chain and answers FK requests off
 * the main thread. The heavy consumer is the IK gate; Gate 2 establishes the
 * initialization/protocol and chain storage.
 */

const state = createWorkerState();

const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<FkRequest>) => void) | null;
  postMessage: (message: FkResponse) => void;
};

ctx.onmessage = (event) => {
  ctx.postMessage(handleRequest(state, event.data));
};
