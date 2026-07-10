import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { RobotModelAdapter } from '../robot/RobotModelAdapter';
import type { KinematicChain } from './chainTypes';
import { extractChain } from './extractChain';
import { computeForwardKinematics } from './forwardKinematics';
import { geometricJacobian } from './jacobian';

const urdf = readFileSync(resolve(process.cwd(), 'resources/6_dof_arm.urdf'), 'utf-8');
const ACTIVE = ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6'];
const LOCKED = { stylus_pitch: 0 };

let chain: KinematicChain;
beforeAll(() => {
  const adapter = new RobotModelAdapter();
  adapter.parse(urdf);
  chain = extractChain(adapter.object!, 'base_link', 'stylus_tip');
});

function fkAt(q: number[]) {
  const values: Record<string, number> = { ...LOCKED };
  ACTIVE.forEach((name, i) => (values[name] = q[i]!));
  return computeForwardKinematics(chain, values);
}

describe('geometric Jacobian vs finite differences', () => {
  it('matches the linear (position) columns', () => {
    const q = [0.3, -0.5, 0.7, 0.2, -0.4, 0.1];
    const n = ACTIVE.length;
    const J6 = new Float64Array(6 * n);
    geometricJacobian(fkAt(q), ACTIVE, J6);

    const h = 1e-6;
    for (let j = 0; j < n; j++) {
      const qp = [...q];
      const qm = [...q];
      qp[j]! += h;
      qm[j]! -= h;
      const pp = fkAt(qp).tcp.position;
      const pm = fkAt(qm).tcp.position;
      for (let row = 0; row < 3; row++) {
        const fd = (pp[row]! - pm[row]!) / (2 * h);
        expect(J6[row * n + j]!, `linear[${row}][${j}]`).toBeCloseTo(fd, 6);
      }
    }
  });

  it('matches the angular (orientation) columns', () => {
    const q = [0.2, 0.6, -0.4, 0.5, 0.3, -0.2];
    const n = ACTIVE.length;
    const J6 = new Float64Array(6 * n);
    geometricJacobian(fkAt(q), ACTIVE, J6);

    // Relative rotation vector between two orientations, ≈ ω·dt for small dt.
    const rotVec = (qa: number[], qb: number[]): [number, number, number] => {
      const A = fkAt(qa).tcp.quaternion;
      const B = fkAt(qb).tcp.quaternion;
      // δ = B · A⁻¹ (A⁻¹ = conjugate for unit quats)
      const ax = -A[0];
      const ay = -A[1];
      const az = -A[2];
      const aw = A[3];
      const dx = B[3] * ax + B[0] * aw + B[1] * az - B[2] * ay;
      const dy = B[3] * ay - B[0] * az + B[1] * aw + B[2] * ax;
      const dz = B[3] * az + B[0] * ay - B[1] * ax + B[2] * aw;
      const dw = B[3] * aw - B[0] * ax - B[1] * ay - B[2] * az;
      const sign = dw < 0 ? -1 : 1;
      return [2 * sign * dx, 2 * sign * dy, 2 * sign * dz];
    };

    const h = 1e-6;
    for (let j = 0; j < n; j++) {
      const qp = [...q];
      const qm = [...q];
      qp[j]! += h;
      qm[j]! -= h;
      const rv = rotVec(qm, qp);
      const fd: [number, number, number] = [rv[0] / (2 * h), rv[1] / (2 * h), rv[2] / (2 * h)];
      expect(J6[3 * n + j]!, `angular-x[${j}]`).toBeCloseTo(fd[0], 5);
      expect(J6[4 * n + j]!, `angular-y[${j}]`).toBeCloseTo(fd[1], 5);
      expect(J6[5 * n + j]!, `angular-z[${j}]`).toBeCloseTo(fd[2], 5);
    }
  });
});
