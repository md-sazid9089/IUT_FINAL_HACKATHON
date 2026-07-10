import { describe, expect, it } from 'vitest';
import { parseKeyConfig } from '../config/keyConfig';
import rawConfig from '../../resources/key.config.json';
import { validatePin } from './pinValidation';

const config = parseKeyConfig(rawConfig);

describe('validatePin', () => {
  it.each(['123456', '654321', '555555', '161616'])('accepts valid PIN %s', (pin) => {
    expect(validatePin(pin, config).ok).toBe(true);
  });

  it('rejects invalid length, spaces, empty PINs, and unsupported keys', () => {
    expect(validatePin('', config).ok).toBe(false);
    expect(validatePin('12345', config).ok).toBe(false);
    expect(validatePin('1234567', config).ok).toBe(false);
    expect(validatePin('123 56', config).ok).toBe(false);
    expect(validatePin('123459', config).unsupported).toEqual(['9']);
  });
});
