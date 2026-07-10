import { PIN_SEQUENCE_LENGTH } from './pinConfig';
import type { KeyConfig } from '../config/keyConfig';

export interface PinValidationResult {
  readonly ok: boolean;
  readonly pin: string;
  readonly digits: string[];
  readonly allowedKeys: string[];
  readonly reason: string | null;
  readonly unsupported: string[];
}

export function validatePin(pin: string, keyConfig: KeyConfig): PinValidationResult {
  const allowedKeys = Object.keys(keyConfig.keys).sort();
  const digits = pin.split('');
  const unsupported = digits.filter((digit) => !allowedKeys.includes(digit));

  if (pin.length === 0) {
    return { ok: false, pin, digits, allowedKeys, reason: 'PIN is empty', unsupported };
  }
  if (/\s/.test(pin)) {
    return { ok: false, pin, digits, allowedKeys, reason: 'PIN cannot contain spaces', unsupported };
  }
  if (pin.length !== PIN_SEQUENCE_LENGTH) {
    return {
      ok: false,
      pin,
      digits,
      allowedKeys,
      reason: `PIN must contain exactly ${PIN_SEQUENCE_LENGTH} characters`,
      unsupported,
    };
  }
  if (unsupported.length > 0) {
    return {
      ok: false,
      pin,
      digits,
      allowedKeys,
      reason: `Unsupported key(s): ${[...new Set(unsupported)].join(', ')}`,
      unsupported,
    };
  }

  return { ok: true, pin, digits, allowedKeys, reason: null, unsupported: [] };
}
