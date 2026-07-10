import { useRuntimeStore } from '../state/runtimeStore';

const LEVEL_LABEL: Record<string, string> = { info: 'INFO', warn: 'WARN', error: 'ERR' };

/**
 * Bottom "flight recorder" timeline: the most recent runtime events (commands,
 * plans, trajectories, rejections). Read-only, snapshot-driven.
 */
export function EventTimeline() {
  const events = useRuntimeStore((s) => s.snapshot?.events) ?? [];
  const recent = events.slice(-40).reverse();

  return (
    <section className="dock-timeline" aria-label="Event timeline">
      <div className="dock-head">
        <span className="dock-title">Event Timeline</span>
        <span className="dock-sub mono">{events.length ? `${events.length} events` : 'idle'}</span>
      </div>
      <div className="dock-scroll">
        {recent.length === 0 ? (
          <div className="dock-empty">Runtime events will stream here as commands are executed.</div>
        ) : (
          <ol className="dock-list mono">
            {recent.map((e) => (
              <li key={e.seq} className={`dock-item lvl-${e.level}`}>
                <span className={`dock-lvl lvl-${e.level}`}>{LEVEL_LABEL[e.level] ?? 'INFO'}</span>
                <span className="dock-kind">{e.kind}</span>
                <span className="dock-msg">{e.message}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
