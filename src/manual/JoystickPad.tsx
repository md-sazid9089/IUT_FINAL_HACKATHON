import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_DEAD_ZONE } from './jogModel';

export interface JoystickPadProps {
  /** Called with the normalised vector (x∈[-1,1], y∈[-1,1]) while held. +Y is up. */
  readonly onVector: (x: number, y: number) => void;
  /** Called when the stick is released or capture is lost — motion must stop. */
  readonly onRelease: () => void;
  /** Constrain movement to one axis ('x' horizontal, 'y' vertical). */
  readonly axis?: 'both' | 'x' | 'y';
  readonly ariaLabel?: string;
  readonly deadZone?: number;
  readonly disabled?: boolean;
  readonly size?: number;
}

/**
 * XY Cartesian joystick with pointer capture.
 *
 * Mapping: horizontal right = +X, left = −X; vertical up = +Y, down = −Y.
 * The knob position previews the live direction vector. On pointer release OR
 * pointer-capture loss the stick recentres and `onRelease` fires so the engine
 * stops emitting immediately.
 */
export function JoystickPad({
  onVector,
  onRelease,
  axis = 'both',
  ariaLabel,
  deadZone = DEFAULT_DEAD_ZONE,
  disabled = false,
  size = 140,
}: JoystickPadProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const radius = size / 2;

  const recenter = useCallback(() => {
    activePointer.current = null;
    setKnob({ x: 0, y: 0 });
    onRelease();
  }, [onRelease]);

  const applyFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const pad = padRef.current;
      if (!pad) return;
      const rect = pad.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let nx = (clientX - cx) / radius;
      // Screen Y grows downward; invert so pushing up gives +Y.
      let ny = -(clientY - cy) / radius;
      // Single-axis pads ignore the perpendicular component entirely.
      if (axis === 'x') ny = 0;
      if (axis === 'y') nx = 0;
      const mag = Math.hypot(nx, ny);
      if (mag > 1) {
        nx /= mag;
        ny /= mag;
      }
      setKnob({ x: nx, y: ny });
      const emitMag = Math.hypot(nx, ny);
      if (emitMag <= deadZone) {
        onVector(0, 0);
      } else {
        onVector(nx, ny);
      }
    },
    [axis, deadZone, onVector, radius],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      activePointer.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      applyFromEvent(e.clientX, e.clientY);
    },
    [applyFromEvent, disabled],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointer.current !== e.pointerId) return;
      applyFromEvent(e.clientX, e.clientY);
    },
    [applyFromEvent],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (activePointer.current !== e.pointerId) return;
      recenter();
    },
    [recenter],
  );

  // Pointer-capture loss (e.g. touch cancelled, focus stolen) must stop motion.
  const handleLostCapture = useCallback(() => {
    if (activePointer.current !== null) recenter();
  }, [recenter]);

  // Keyboard accessibility: arrow keys nudge the stick while focused.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      const map: Record<string, [number, number]> = {
        ArrowRight: [1, 0],
        ArrowLeft: [-1, 0],
        ArrowUp: [0, 1],
        ArrowDown: [0, -1],
      };
      const v = map[e.key];
      if (!v) return;
      if (axis === 'x' && v[0] === 0) return;
      if (axis === 'y' && v[1] === 0) return;
      e.preventDefault();
      setKnob({ x: v[0], y: v[1] });
      onVector(v[0], v[1]);
    },
    [axis, disabled, onVector],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        recenter();
      }
    },
    [recenter],
  );

  // Safety: recentre if this component ever unmounts mid-drag. Uses a ref so
  // the cleanup runs ONLY on unmount — not on every re-render (which would
  // otherwise clear the stick continuously as parent status updates arrive).
  const recenterRef = useRef(recenter);
  useEffect(() => {
    recenterRef.current = recenter;
  }, [recenter]);
  useEffect(() => () => recenterRef.current(), []);

  const knobPx = {
    left: `${50 + knob.x * 45}%`,
    top: `${50 - knob.y * 45}%`,
  };

  return (
    <div
      ref={padRef}
      className={`joystick-pad${disabled ? ' disabled' : ''}`}
      style={{ width: size, height: size }}
      role="application"
      aria-label={
        ariaLabel ?? 'XY Cartesian joystick. Drag to jog the tool: right +X, left −X, up +Y, down −Y.'
      }
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onLostPointerCapture={handleLostCapture}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      {axis !== 'y' ? <div className="joystick-cross joystick-cross-h" /> : null}
      {axis !== 'x' ? <div className="joystick-cross joystick-cross-v" /> : null}
      <div className="joystick-knob" style={knobPx} />
    </div>
  );
}
