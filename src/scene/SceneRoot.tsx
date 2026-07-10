import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { PCFShadowMap } from 'three';
import type { KeyConfig } from '../config/keyConfig';
import { useRobotStore } from '../state/robotStore';
import { coordToTuple, type Vec3Tuple } from './coordinates';
import { RobotModel } from './RobotModel';
import { KeyPanel } from './KeyPanel';
import { PinPathOverlay, TcpMarker, TargetMarker } from './Markers';

interface SceneRootProps {
  keyConfig: KeyConfig | null;
}

/**
 * Root R3F scene. The base frame is Z-up (matching the URDF and key config), so
 * the camera up vector is +Z and world coordinates equal base_link coordinates.
 */
export function SceneRoot({ keyConfig }: SceneRootProps) {
  const tcp = useRobotStore((s) => s.tcp);
  const targetKey = useRobotStore((s) => s.targetKey);

  let targetPosition: Vec3Tuple | null = null;
  if (keyConfig && targetKey && keyConfig.keys[targetKey]) {
    targetPosition = coordToTuple(keyConfig.keys[targetKey]);
  }

  return (
    <Canvas
      shadows={{ enabled: true, type: PCFShadowMap }}
      camera={{ position: [1.1, -1.1, 1.0], up: [0, 0, 1], fov: 50, near: 0.01, far: 100 }}
    >
      <color attach="background" args={['#1e222a']} />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[2, -2, 4]}
        intensity={2.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={12}
        shadow-camera-left={-2}
        shadow-camera-right={2}
        shadow-camera-top={2}
        shadow-camera-bottom={-2}
      />

      {/* Ground plane (XY, normal +Z) receiving shadows */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#2a2f3a" roughness={1} metalness={0} />
      </mesh>

      {/* Grid in the XY plane (drei Grid is XZ by default; rotate onto XY) */}
      <Grid
        args={[6, 6]}
        rotation={[Math.PI / 2, 0, 0]}
        cellSize={0.1}
        sectionSize={0.5}
        cellColor="#3b4252"
        sectionColor="#4c566a"
        infiniteGrid
        fadeDistance={8}
      />

      {/* Base-frame axes: X red, Y green, Z blue */}
      <axesHelper args={[0.3]} />

      <RobotModel />
      {keyConfig ? <KeyPanel config={keyConfig} /> : null}
      {tcp ? <TcpMarker position={tcp} /> : null}
      {targetPosition ? <TargetMarker position={targetPosition} /> : null}
      <PinPathOverlay />

      <OrbitControls makeDefault target={[0.55, 0, 0.2]} />
    </Canvas>
  );
}
