import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { DEFAULT_DEAD_ZONE } from './jogModel';

export interface JoystickPadProps {
  /**
   * x:
   *  -1 = full left
   *  +1 = full right
   *
   * y:
   *  -1 = full down
   *  +1 = full up
   */
  readonly onVector: (x: number, y: number) => void;

  readonly onRelease: () => void;
  readonly deadZone?: number;
  readonly disabled?: boolean;
  readonly size?: number;
}

interface StickPosition {
  x: number;
  y: number;
}

export function JoystickPad({
  onVector,
  onRelease,
  deadZone = DEFAULT_DEAD_ZONE,
  disabled = false,
  size = 160,
}: JoystickPadProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const releaseRef = useRef(onRelease);

  const [position, setPosition] = useState<StickPosition>({
    x: 0,
    y: 0,
  });

  const knobDiameter = 24;
  const knobRadius = knobDiameter / 2;
  const movementRadius = size / 2 - knobRadius - 6;

  useEffect(() => {
    releaseRef.current = onRelease;
  }, [onRelease]);

  const reset = useCallback(() => {
    activePointerId.current = null;

    setPosition({
      x: 0,
      y: 0,
    });

    releaseRef.current();
  }, []);

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const pad = padRef.current;

      if (!pad) {
        return;
      }

      const rect = pad.getBoundingClientRect();

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let x = (clientX - centerX) / movementRadius;

      // Browser Y grows downward, so invert it.
      let y = -(clientY - centerY) / movementRadius;

      const magnitude = Math.hypot(x, y);

      /**
       * Keep the joystick inside its circular boundary.
       *
       * [1, 1] becomes:
       * [0.7071, 0.7071]
       *
       * Therefore, a diagonal movement does not become faster than a straight
       * horizontal or vertical movement.
       */
      if (magnitude > 1) {
        x /= magnitude;
        y /= magnitude;
      }

      const finalMagnitude = Math.hypot(x, y);

      if (finalMagnitude <= deadZone) {
        setPosition({
          x: 0,
          y: 0,
        });

        onVector(0, 0);
        return;
      }

      setPosition({
        x,
        y,
      });

      onVector(x, y);
    },
    [deadZone, movementRadius, onVector],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }

      activePointerId.current = event.pointerId;

      event.currentTarget.setPointerCapture(event.pointerId);

      updateFromPointer(
        event.clientX,
        event.clientY,
      );
    },
    [disabled, updateFromPointer],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== event.pointerId) {
        return;
      }

      updateFromPointer(
        event.clientX,
        event.clientY,
      );
    },
    [updateFromPointer],
  );

  const handlePointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== event.pointerId) {
        return;
      }

      reset();
    },
    [reset],
  );

  const handleLostPointerCapture = useCallback(() => {
    if (activePointerId.current !== null) {
      reset();
    }
  }, [reset]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }

      const mapping: Record<string, StickPosition> = {
        ArrowRight: { x: 1, y: 0 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowUp: { x: 0, y: 1 },
        ArrowDown: { x: 0, y: -1 },
      };

      const next = mapping[event.key];

      if (!next) {
        return;
      }

      event.preventDefault();

      setPosition(next);
      onVector(next.x, next.y);
    },
    [disabled, onVector],
  );

  const handleKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        event.key === 'ArrowRight' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown'
      ) {
        event.preventDefault();
        reset();
      }
    },
    [reset],
  );

  useEffect(() => {
    return () => {
      releaseRef.current();
    };
  }, []);

  /**
   * Using transform instead of left/top percentage plus negative margins keeps
   * the ball exactly centred.
   */
  const knobStyle: React.CSSProperties = {
    width: knobDiameter,
    height: knobDiameter,
    transform:
      `translate(calc(-50% + ${position.x * movementRadius}px), ` +
      `calc(-50% + ${-position.y * movementRadius}px))`,
  };

  const angle =
    position.x === 0 && position.y === 0
      ? null
      : (Math.atan2(position.y, position.x) * 180) / Math.PI;

  const strength = Math.round(
    Math.min(1, Math.hypot(position.x, position.y)) * 100,
  );

  return (
    <div className="joint-joystick-wrapper">
      <div
        ref={padRef}
        className={`joystick-pad${disabled ? ' disabled' : ''}`}
        style={{
          width: size,
          height: size,
        }}
        role="application"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={
          'Joint joystick. Left and right control joint 1. ' +
          'Up and down control joint 2.'
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handleLostPointerCapture}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      >
        <span className="joystick-label joystick-label-up">
          J2+
        </span>

        <span className="joystick-label joystick-label-down">
          J2−
        </span>

        <span className="joystick-label joystick-label-left">
          J1−
        </span>

        <span className="joystick-label joystick-label-right">
          J1+
        </span>

        <div className="joystick-cross joystick-cross-h" />
        <div className="joystick-cross joystick-cross-v" />

        <div
          className="joystick-knob"
          style={knobStyle}
        />
      </div>

      <div className="joystick-values mono small">
        <span>J1 input: {position.x.toFixed(3)}</span>
        <span>J2 input: {position.y.toFixed(3)}</span>

        <span>
          Angle: {angle === null ? '—' : `${angle.toFixed(1)}°`}
        </span>

        <span>Power: {strength}%</span>
      </div>
    </div>
  );
}