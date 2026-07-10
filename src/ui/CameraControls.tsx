import { CAMERA_PRESETS, useUiStore } from '../state/uiStore';

/**
 * Floating camera-preset selector overlaid on the viewport. Selecting a preset
 * updates UI-only state; the in-scene CameraRig performs the smooth transition.
 */
export function CameraControls() {
  const preset = useUiStore((s) => s.cameraPreset);
  const setPreset = useUiStore((s) => s.setCameraPreset);

  return (
    <div className="camera-controls" role="group" aria-label="Camera views">
      {CAMERA_PRESETS.map((p) => (
        <button
          key={p.id}
          className={`cam-btn${preset === p.id ? ' is-active' : ''}`}
          aria-pressed={preset === p.id}
          title={p.hint}
          onClick={() => setPreset(p.id)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
