import { describe, expect, it } from 'vitest';
import {
  calculateRepeatability,
  distanceM,
  exportPinReportCsv,
  exportPinReportJson,
  type PinRunReport,
} from './pinReports';

const report: PinRunReport = {
  runId: 'run-1',
  pin: '123456',
  startedAtIso: '2026-07-10T00:00:00.000Z',
  completedAtIso: '2026-07-10T00:00:10.000Z',
  outcome: 'passed',
  events: [],
  presses: [
    {
      runId: 'run-1',
      pin: '123456',
      digitIndex: 0,
      key: '1',
      target: [0, 0, 0],
      actual: [0.001, 0, 0],
      errorM: 0.001,
      errorMm: 1,
      stylusTiltDeg: 0,
      hoverSuccess: true,
      descentSuccess: true,
      contactSuccess: true,
      retractSuccess: true,
      ikIterations: 12,
      solverStatus: 'converged',
      trajectoryDurationMs: 1000,
      dwellMs: 250,
      maximumJointDeltaRad: 0.2,
      nearestJointLimitMarginRad: 0.5,
      failureReason: null,
    },
  ],
};

describe('PIN reports', () => {
  it('uses real geometric distance and exports JSON/CSV', () => {
    expect(distanceM([0, 0, 0], [0.003, 0.004, 0])).toBeCloseTo(0.005);
    expect(exportPinReportJson(report)).toContain('"errorMm": 1');
    expect(exportPinReportCsv(report)).toContain('"run-1","123456","0","1"');
  });

  it('calculates repeatability statistics from recorded runs', () => {
    const stats = calculateRepeatability([report, { ...report, runId: 'run-2', outcome: 'failed' }]);
    expect(stats.runs).toBe(2);
    expect(stats.successes).toBe(1);
    expect(stats.successRate).toBe(0.5);
    expect(stats.meanErrorMm).toBe(1);
  });
});
