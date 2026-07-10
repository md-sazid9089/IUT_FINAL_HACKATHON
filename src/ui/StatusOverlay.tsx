import type { LoadStatus } from '../state/robotStore';

interface StatusOverlayProps {
  status: LoadStatus;
  error: string | null;
  configError: string | null;
}

/** Graceful loading and error overlay for URDF and key-config failures. */
export function StatusOverlay({ status, error, configError }: StatusOverlayProps) {
  if (status === 'error' || configError) {
    return (
      <div className="overlay overlay-error" role="alert">
        <div className="overlay-card">
          <h2>Failed to load digital twin</h2>
          {status === 'error' && error ? (
            <p>
              <strong>URDF:</strong> {error}
            </p>
          ) : null}
          {configError ? (
            <p>
              <strong>Key config:</strong> {configError}
            </p>
          ) : null}
          <p className="muted">Verify the runtime copies under <code>public/</code>.</p>
        </div>
      </div>
    );
  }

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="overlay" role="status">
        <div className="overlay-card">
          <div className="spinner" />
          <p>Loading digital twin…</p>
        </div>
      </div>
    );
  }

  return null;
}
