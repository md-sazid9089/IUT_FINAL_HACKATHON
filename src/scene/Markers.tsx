import type { Vec3Tuple } from './coordinates';
import { Line } from '@react-three/drei';
import { usePinStore } from '../pin/pinStore';

/** Glowing sphere marking the rendered TCP (stylus tip) world position. */
export function TcpMarker({ position }: { position: Vec3Tuple }) {
  return (
    <mesh position={position} name="tcp-marker">
      <sphereGeometry args={[0.012, 24, 24]} />
      <meshStandardMaterial color="#bf616a" emissive="#7a2e35" emissiveIntensity={0.6} />
    </mesh>
  );
}

/** Ring marker highlighting the currently selected target key contact point. */
export function TargetMarker({ position }: { position: Vec3Tuple }) {
  return (
    <mesh position={position} name="target-marker" rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.018, 0.0025, 12, 32]} />
      <meshStandardMaterial color="#ebcb8b" emissive="#8a7327" emissiveIntensity={0.5} />
    </mesh>
  );
}

export function PinPathOverlay() {
  const plan = usePinStore((s) => s.plan);
  const report = usePinStore((s) => s.report);
  if (!plan) return null;
  const planned = plan.waypoints.map((waypoint) => waypoint.position as Vec3Tuple);
  const completed = report?.presses.map((press) => press.actual as Vec3Tuple) ?? [];

  return (
    <group name="pin-path-overlay">
      {planned.length > 1 ? <Line points={planned} color="#38bdf8" lineWidth={2} dashed /> : null}
      {completed.length > 1 ? <Line points={completed} color="#22c55e" lineWidth={3} /> : null}
      {plan.digits.map((digit) => (
        <group key={`${digit.digitIndex}-${digit.key}`}>
          <mesh position={digit.hoverPoint}>
            <sphereGeometry args={[0.006, 12, 12]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
          <mesh position={digit.contactPoint}>
            <sphereGeometry args={[0.005, 12, 12]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
        </group>
      ))}
    </group>
  );
}
