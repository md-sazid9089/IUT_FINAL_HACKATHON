import { z } from 'zod';

/**
 * Structured voice-command schema — the FIRST safety boundary between the AI
 * and the robot. Whatever the language model returns is parsed against these
 * schemas; anything that does not validate is rejected outright. The AI never
 * reaches the robot: validated commands still pass through the command mapper
 * and the full RuntimeController safety pipeline afterwards.
 */

export const CartesianVoiceSchema = z.object({
  type: z.literal('cartesian_move'),
  axis: z.enum(['x', 'y', 'z']),
  direction: z.enum(['positive', 'negative']),
  /** Distance in `unit`; optional — a sensible default step is applied. */
  value: z.number().finite().positive().optional(),
  unit: z.enum(['meter', 'centimeter', 'millimeter']).optional(),
  speed: z.enum(['slow', 'normal', 'fast']).optional(),
});

export const JointVoiceSchema = z.object({
  type: z.literal('joint_move'),
  joint: z.enum(['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6']),
  /** Relative rotation in `unit` (signed). */
  angle: z.number().finite(),
  unit: z.enum(['degree', 'radian']).optional(),
});

export const HomeVoiceSchema = z.object({ type: z.literal('home') });
export const StopVoiceSchema = z.object({ type: z.literal('stop') });

export const PinVoiceSchema = z.object({
  type: z.literal('pin_execute'),
  pin: z.string().regex(/^[1-6]{6}$/, 'PIN must be exactly six digits 1-6'),
});

export const ClarificationSchema = z.object({
  type: z.literal('clarification_required'),
  message: z.string().min(1),
});

export const VoiceCommandSchema = z.discriminatedUnion('type', [
  CartesianVoiceSchema,
  JointVoiceSchema,
  HomeVoiceSchema,
  StopVoiceSchema,
  PinVoiceSchema,
  ClarificationSchema,
]);

export type VoiceCommand = z.infer<typeof VoiceCommandSchema>;
export type CartesianVoice = z.infer<typeof CartesianVoiceSchema>;
export type JointVoice = z.infer<typeof JointVoiceSchema>;

export interface VoiceParseResult {
  readonly ok: boolean;
  readonly command?: VoiceCommand;
  readonly error?: string;
}

/** Validate an unknown AI payload. Never throws. */
export function parseVoiceCommand(input: unknown): VoiceParseResult {
  const result = VoiceCommandSchema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, error: `Invalid voice command: ${first?.message ?? 'schema error'}` };
  }
  return { ok: true, command: result.data };
}

/**
 * Extract the first JSON object from raw model text (strips ``` fences and any
 * stray prose) and validate it. Never throws.
 */
export function parseVoiceCommandText(raw: string): VoiceParseResult {
  const cleaned = raw.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return { ok: false, error: 'AI returned no JSON object' };
  try {
    return parseVoiceCommand(JSON.parse(cleaned.slice(start, end + 1)));
  } catch {
    return { ok: false, error: 'AI returned malformed JSON' };
  }
}
