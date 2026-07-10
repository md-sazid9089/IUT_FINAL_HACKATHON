import { describe, expect, it } from 'vitest';
import { parseKeyConfig } from './keyConfig';

const validConfig = {
  frame: 'base_link',
  units: 'meters',
  approach_axis: '-z',
  keys: {
    '1': { x: 0.5, y: 0.05, z: 0.05 },
    '2': { x: 0.55, y: 0.05, z: 0.05 },
  },
};

describe('parseKeyConfig', () => {
  it('accepts a well-formed config and returns typed data', () => {
    const cfg = parseKeyConfig(validConfig);
    expect(cfg.frame).toBe('base_link');
    expect(cfg.approach_axis).toBe('-z');
    expect(cfg.keys['1']).toEqual({ x: 0.5, y: 0.05, z: 0.05 });
  });

  it('rejects an unknown approach axis', () => {
    expect(() => parseKeyConfig({ ...validConfig, approach_axis: 'diagonal' })).toThrow();
  });

  it('rejects a non-finite coordinate', () => {
    const bad = {
      ...validConfig,
      keys: { '1': { x: Number.POSITIVE_INFINITY, y: 0, z: 0 } },
    };
    expect(() => parseKeyConfig(bad)).toThrow();
  });

  it('rejects a missing required field', () => {
    const { frame: _frame, ...withoutFrame } = validConfig;
    expect(() => parseKeyConfig(withoutFrame)).toThrow();
  });

  it('rejects a coordinate missing an axis', () => {
    const bad = { ...validConfig, keys: { '1': { x: 0.5, y: 0.05 } } };
    expect(() => parseKeyConfig(bad)).toThrow();
  });
});
