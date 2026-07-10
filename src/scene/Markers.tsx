import type { Vec3Tuple } from './coordinates';

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
