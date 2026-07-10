import type { RuntimeState } from '../runtime/runtimeState';

export type ChipTone = 'ready' | 'active' | 'warn' | 'danger' | 'idle' | 'ok';

const TONE_BY_STATE: Record<RuntimeState, ChipTone> = {
  BOOTING: 'idle',
  MODEL_LOADING: 'idle',
  SELF_TEST: 'active',
  READY: 'ready',
  PLANNING: 'active',
  EXECUTING: 'active',
  PAUSED: 'warn',
  STOPPING: 'warn',
  E_STOPPED: 'danger',
  FAULT: 'danger',
};

/** Maps a runtime state to its chip tone (single source of truth for colour). */
export function toneForState(state: RuntimeState): ChipTone {
  return TONE_BY_STATE[state] ?? 'idle';
}

interface StatusChipProps {
  label: string;
  tone: ChipTone;
  /** Pulse the indicator dot (use only for genuinely live states). */
  pulse?: boolean;
  title?: string;
  size?: 'sm' | 'md';
}

/**
 * Reusable status chip: coloured dot + label. Pure presentation; colour comes
 * from the design-system tone tokens. Animation is opt-in and respects
 * prefers-reduced-motion via CSS.
 */
export function StatusChip({ label, tone, pulse = false, title, size = 'md' }: StatusChipProps) {
  return (
    <span className={`chip chip-${tone} chip-${size}`} title={title ?? label} role="status">
      <span className={`chip-dot${pulse ? ' chip-dot-pulse' : ''}`} aria-hidden="true" />
      {label}
    </span>
  );
}
