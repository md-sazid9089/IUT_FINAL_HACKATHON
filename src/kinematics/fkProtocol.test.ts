import { describe, expect, it } from 'vitest';
import type { KinematicChain } from './chainTypes';
import { createWorkerState, handleRequest } from './fkProtocol';

// Minimal two-joint chain: a Z revolute then a fixed 1 m offset along Z.
const chain: KinematicChain = {
  baseLink: 'base',
  tipLink: 'tip',
  joints: [
    {
      name: 'j1',
      type: 'revolute',
      parentLink: 'base',
      childLink: 'link1',
      originXyz: [0, 0, 0],
      originRpy: [0, 0, 0],
      axis: [0, 0, 1],
      limit: { lower: -Math.PI, upper: Math.PI, effort: 1, velocity: 1 },
    },
    {
      name: 'tip_frame',
      type: 'fixed',
      parentLink: 'link1',
      childLink: 'tip',
      originXyz: [0, 0, 1],
      originRpy: [0, 0, 0],
      axis: [1, 0, 0],
      limit: null,
    },
  ],
};

describe('fk worker protocol', () => {
  it('replies ready and stores the chain on init', () => {
    const state = createWorkerState();
    const res = handleRequest(state, { type: 'init', chain });
    expect(res).toEqual({ type: 'ready' });
    expect(state.chain).toBe(chain);
  });

  it('errors when solving before init', () => {
    const state = createWorkerState();
    const res = handleRequest(state, { type: 'fk', id: 7, jointValues: {} });
    expect(res.type).toBe('error');
    if (res.type === 'error') {
      expect(res.id).toBe(7);
      expect(res.message).toMatch(/not initialized/i);
    }
  });

  it('returns a finite FK result after init', () => {
    const state = createWorkerState();
    handleRequest(state, { type: 'init', chain });
    const res = handleRequest(state, { type: 'fk', id: 42, jointValues: { j1: 0 } });
    expect(res.type).toBe('fkResult');
    if (res.type === 'fkResult') {
      expect(res.id).toBe(42);
      expect(res.result.tcp.position[2]).toBeCloseTo(1, 12);
      expect(res.result.tcp.position.every((c) => Number.isFinite(c))).toBe(true);
    }
  });
});
