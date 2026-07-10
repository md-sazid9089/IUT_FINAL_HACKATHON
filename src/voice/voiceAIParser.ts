import { callGemini } from './geminiClient';
import { callGrok } from './grokClient';
import { parseVoiceCommandText, type VoiceParseResult } from './voiceCommandSchema';

/**
 * Voice → structured command orchestrator.
 *
 * 1) Always try a deterministic OFFLINE rule parser first. It covers ~80% of
 *    utterances instantly, works without an API key, and stops the browser
 *    from shipping a request for trivial phrases like "stop" or "go home".
 * 2) If offline can't classify, call the configured AI provider (Gemini
 *    preferred; Grok used only when a Grok key is set and Gemini is absent).
 * 3) The AI response is validated against voiceCommandSchema — anything that
 *    fails the schema is rejected before it reaches the runtime.
 */

export type AiProvider = 'gemini' | 'grok' | 'offline';

export interface AiConfig {
  readonly geminiKey?: string;
  readonly grokKey?: string;
}

export function readAiConfig(): AiConfig {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  return {
    geminiKey: env.VITE_GEMINI_API_KEY?.trim() || undefined,
    grokKey: env.VITE_GROK_API_KEY?.trim() || undefined,
  };
}

export function preferredProvider(cfg: AiConfig): AiProvider {
  if (cfg.geminiKey) return 'gemini';
  if (cfg.grokKey) return 'grok';
  return 'offline';
}

export interface ParseOutcome {
  readonly provider: AiProvider;
  readonly rawText: string;
  readonly result: VoiceParseResult;
}

// ---- offline deterministic rules ---------------------------------------------

const AXIS_WORDS: Record<string, { axis: 'x' | 'y' | 'z'; direction: 'positive' | 'negative' }> = {
  right: { axis: 'x', direction: 'positive' },
  left: { axis: 'x', direction: 'negative' },
  forward: { axis: 'y', direction: 'positive' },
  forwards: { axis: 'y', direction: 'positive' },
  back: { axis: 'y', direction: 'negative' },
  backward: { axis: 'y', direction: 'negative' },
  backwards: { axis: 'y', direction: 'negative' },
  up: { axis: 'z', direction: 'positive' },
  down: { axis: 'z', direction: 'negative' },
};

const JOINT_ALIASES: Record<string, string> = {
  base: 'joint_1',
  shoulder: 'joint_2',
  elbow: 'joint_3',
  wrist: 'joint_5',
};

function parseNumberUnit(text: string): { value: number; unit: 'meter' | 'centimeter' | 'millimeter' } | null {
  const m = text.match(/(-?\d+(?:\.\d+)?)\s*(m|meter|meters|cm|centimeter|centimeters|mm|millimeter|millimeters)\b/);
  if (!m) return null;
  const v = Number.parseFloat(m[1]!);
  if (!Number.isFinite(v)) return null;
  const u = m[2]!.toLowerCase();
  if (u.startsWith('mm') || u.startsWith('milli')) return { value: v, unit: 'millimeter' };
  if (u.startsWith('cm') || u.startsWith('centi')) return { value: v, unit: 'centimeter' };
  return { value: v, unit: 'meter' };
}

export function parseOffline(rawText: string): VoiceParseResult {
  const text = rawText.toLowerCase().trim();
  if (!text) return { ok: false, error: 'Empty transcript' };

  // Stop
  if (/\b(e-?stop|emergency\s*stop|halt|freeze|stop\s*(the)?\s*(robot|arm)?)\b/.test(text)) {
    return parseVoiceCommandText(JSON.stringify({ type: 'stop' }));
  }

  // Home / reset
  if (/\b(go\s*home|home\s*position|reset\s*(the\s*)?(robot|arm|position)?)\b/.test(text)) {
    return parseVoiceCommandText(JSON.stringify({ type: 'home' }));
  }

  // PIN entry
  const pin = text.match(/\b(?:pin|password|code)\b[^0-9]*([1-6]{6})/);
  if (pin) return parseVoiceCommandText(JSON.stringify({ type: 'pin_execute', pin: pin[1] }));

  // Joint rotation
  const jointNumeric = text.match(/\bjoint\s*([1-6])\b[^0-9-]*(-?\d+(?:\.\d+)?)\s*(deg|degree|degrees|rad|radian|radians)?/);
  const jointNamed = Object.keys(JOINT_ALIASES).find((k) => text.includes(k));
  if (jointNumeric) {
    const [, idx, ang, unit] = jointNumeric;
    const isRad = /^rad/i.test(unit ?? '');
    return parseVoiceCommandText(
      JSON.stringify({
        type: 'joint_move',
        joint: `joint_${idx}`,
        angle: Number.parseFloat(ang!),
        unit: isRad ? 'radian' : 'degree',
      }),
    );
  }
  if (jointNamed) {
    const angleMatch = text.match(/(-?\d+(?:\.\d+)?)\s*(deg|degree|degrees|rad|radian|radians)?/);
    if (angleMatch) {
      const isRad = /^rad/i.test(angleMatch[2] ?? '');
      return parseVoiceCommandText(
        JSON.stringify({
          type: 'joint_move',
          joint: JOINT_ALIASES[jointNamed],
          angle: Number.parseFloat(angleMatch[1]!),
          unit: isRad ? 'radian' : 'degree',
        }),
      );
    }
  }

  // Cartesian
  const axisWord = Object.keys(AXIS_WORDS).find((k) => new RegExp(`\\b${k}\\b`).test(text));
  if (axisWord) {
    const { axis, direction } = AXIS_WORDS[axisWord]!;
    const nu = parseNumberUnit(text);
    const cmd: Record<string, unknown> = { type: 'cartesian_move', axis, direction };
    if (nu) {
      cmd.value = Math.abs(nu.value);
      cmd.unit = nu.unit;
    }
    if (/\bslow\w*|precis/.test(text)) cmd.speed = 'slow';
    else if (/\bfast|quick/.test(text)) cmd.speed = 'fast';
    return parseVoiceCommandText(JSON.stringify(cmd));
  }

  // "move slightly" / vague
  if (/\bmove\b/.test(text)) {
    return parseVoiceCommandText(
      JSON.stringify({
        type: 'clarification_required',
        message: 'Please specify direction (up, down, left, right, forward, back) and distance',
      }),
    );
  }

  return { ok: false, error: 'offline parser could not classify — AI required' };
}

// ---- provider orchestration --------------------------------------------------

export async function parseVoice(
  rawText: string,
  cfg: AiConfig,
  opts: { signal?: AbortSignal } = {},
): Promise<ParseOutcome> {
  // 1) Deterministic first.
  const offline = parseOffline(rawText);
  if (offline.ok) return { provider: 'offline', rawText, result: offline };

  const provider = preferredProvider(cfg);
  if (provider === 'offline') {
    // No key configured and no rule matched → surface the offline error.
    return { provider: 'offline', rawText, result: offline };
  }

  try {
    const aiText =
      provider === 'gemini'
        ? await callGemini(rawText, {
            apiKey: cfg.geminiKey!,
            ...(opts.signal ? { signal: opts.signal } : {}),
          })
        : await callGrok(rawText, {
            apiKey: cfg.grokKey!,
            ...(opts.signal ? { signal: opts.signal } : {}),
          });
    return { provider, rawText, result: parseVoiceCommandText(aiText) };
  } catch (err) {
    return {
      provider,
      rawText,
      result: { ok: false, error: err instanceof Error ? err.message : String(err) },
    };
  }
}
