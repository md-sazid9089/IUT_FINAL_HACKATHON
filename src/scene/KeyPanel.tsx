import { Line, Text } from '@react-three/drei';
import type { KeyConfig } from '../config/keyConfig';
import { approachUnitVector, coordToTuple, keyButtonCenter, type Vec3Tuple } from './coordinates';

const BUTTON_SIZE = 0.04; // 40 mm square keycap
const BUTTON_HEIGHT = 0.02; // 20 mm tall; top face sits exactly on the contact point
const APPROACH_INDICATOR_LENGTH = 0.06;

interface KeyPanelProps {
  config: KeyConfig;
}

/**
 * Renders the six keys from the key configuration. The configured coordinate is
 * the top contact point of each keycap; the button body is drawn below it. A per
 * key approach-axis indicator shows the direction the stylus descends.
 */
export function KeyPanel({ config }: KeyPanelProps) {
  const a = approachUnitVector(config.approach_axis);

  return (
    <group name="key-panel">
      {Object.entries(config.keys).map(([id, coord]) => {
        const contact = coordToTuple(coord);
        const center = keyButtonCenter(coord, config.approach_axis, BUTTON_HEIGHT);
        // Indicator starts "above" the key (opposite the approach direction).
        const indicatorStart: Vec3Tuple = [
          contact[0] - a[0] * APPROACH_INDICATOR_LENGTH,
          contact[1] - a[1] * APPROACH_INDICATOR_LENGTH,
          contact[2] - a[2] * APPROACH_INDICATOR_LENGTH,
        ];
        return (
          <group key={id} name={`key-${id}`}>
            {/* Keycap body (top face on the contact point) */}
            <mesh position={center} castShadow receiveShadow>
              <boxGeometry args={[BUTTON_SIZE, BUTTON_SIZE, BUTTON_HEIGHT]} />
              <meshStandardMaterial color="#3b4252" metalness={0.1} roughness={0.7} />
            </mesh>
            {/* Contact point marker */}
            <mesh position={contact}>
              <sphereGeometry args={[0.004, 16, 16]} />
              <meshStandardMaterial color="#88c0d0" emissive="#3b6d78" />
            </mesh>
            {/* Approach-axis indicator (from above down to the contact point) */}
            <Line points={[indicatorStart, contact]} color="#a3be8c" lineWidth={2} />
            {/* Key label */}
            <Text
              position={[contact[0], contact[1], contact[2] + 0.03]}
              fontSize={0.02}
              color="#e5e9f0"
              anchorX="center"
              anchorY="middle"
            >
              {id}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
