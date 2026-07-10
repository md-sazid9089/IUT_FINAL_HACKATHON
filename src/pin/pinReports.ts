import type { Vec3 } from '../kinematics/spatial';

export interface PinPressEvidence {
  readonly runId: string;
  readonly pin: string;
  readonly digitIndex: number;
  readonly key: string;
  readonly target: Vec3;
  readonly actual: Vec3;
  readonly errorM: number;
  readonly errorMm: number;
  readonly stylusTiltDeg: number;
  readonly hoverSuccess: boolean;
  readonly descentSuccess: boolean;
  readonly contactSuccess: boolean;
  readonly retractSuccess: boolean;
  readonly ikIterations: number;
  readonly solverStatus: string;
  readonly trajectoryDurationMs: number;
  readonly dwellMs: number;
  readonly maximumJointDeltaRad: number;
  readonly nearestJointLimitMarginRad: number;
  readonly failureReason: string | null;
}

export interface PinRunReport {
  readonly runId: string;
  readonly pin: string;
  readonly startedAtIso: string;
  readonly completedAtIso: string | null;
  readonly outcome: 'passed' | 'failed' | 'cancelled' | 'e_stopped';
  readonly presses: PinPressEvidence[];
  readonly events: string[];
}

export function distanceM(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function exportPinReportJson(report: PinRunReport): string {
  return JSON.stringify(report, null, 2);
}

export function exportPinReportCsv(report: PinRunReport): string {
  const header = [
    'run_id',
    'pin',
    'digit_index',
    'key',
    'target_x_m',
    'target_y_m',
    'target_z_m',
    'actual_x_m',
    'actual_y_m',
    'actual_z_m',
    'error_m',
    'error_mm',
    'tilt_deg',
    'solver_status',
    'ik_iterations',
    'failure_reason',
  ];
  const rows = report.presses.map((p) =>
    [
      p.runId,
      report.pin,
      String(p.digitIndex),
      p.key,
      ...p.target.map(String),
      ...p.actual.map(String),
      String(p.errorM),
      String(p.errorMm),
      String(p.stylusTiltDeg),
      p.solverStatus,
      String(p.ikIterations),
      p.failureReason ?? '',
    ]
      .map((cell) => `"${cell.replaceAll('"', '""')}"`)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}

export interface RepeatabilityStats {
  readonly runs: number;
  readonly successes: number;
  readonly successRate: number;
  readonly meanErrorMm: number;
  readonly maxErrorMm: number;
  readonly minErrorMm: number;
  readonly stdDevErrorMm: number;
}

export function calculateRepeatability(reports: readonly PinRunReport[]): RepeatabilityStats {
  const errors = reports.flatMap((report) => report.presses.map((press) => press.errorMm));
  const successes = reports.filter((report) => report.outcome === 'passed').length;
  const mean = errors.length ? errors.reduce((sum, error) => sum + error, 0) / errors.length : 0;
  const variance = errors.length
    ? errors.reduce((sum, error) => sum + (error - mean) ** 2, 0) / errors.length
    : 0;
  return {
    runs: reports.length,
    successes,
    successRate: reports.length ? successes / reports.length : 0,
    meanErrorMm: mean,
    maxErrorMm: errors.length ? Math.max(...errors) : 0,
    minErrorMm: errors.length ? Math.min(...errors) : 0,
    stdDevErrorMm: Math.sqrt(variance),
  };
}
