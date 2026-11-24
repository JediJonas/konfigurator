import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls, useBounds } from '@react-three/drei';
import { useEffect } from 'react';
import { TOUCH } from 'three';
import type { Part } from '../../core/model/part';
import { PartMesh } from './PartMesh';

interface DesignViewProps {
  parts: Part[];
  color: string;
}

/** Fatets radie i 3D-vyn. Fatet är bara bakgrund och ingår inte i underlaget. */
const PLATE_RADIUS_MM = 220;
const CAMERA_POSITION_MM: [number, number, number] = [260, 230, 340];
const CAMERA_TARGET_MM: [number, number, number] = [0, 70, 0];

export function DesignView({ parts, color }: DesignViewProps) {
  return (
    <Canvas
      // Ritar bara om när något ändras, vilket sparar batteri i mobilen.
      frameloop="demand"
      shadows
      camera={{ position: CAMERA_POSITION_MM, fov: 40, near: 1, far: 5000 }}
      // Behövs för att kunna ta en bild av vyn till ritningens första sida.
      gl={{ preserveDrawingBuffer: true }}
    >
      <color attach="background" args={['#f3e9dc']} />
      <hemisphereLight args={['#fff8ee', '#8a7560', 1.2]} />
      <directionalLight position={[300, 500, 250]} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]}>
        <orthographicCamera attach="shadow-camera" args={[-300, 300, 300, -300, 1, 1500]} />
      </directionalLight>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.5} receiveShadow>
        <circleGeometry args={[PLATE_RADIUS_MM, 64]} />
        <meshStandardMaterial color="#fbfbf8" roughness={0.4} />
      </mesh>
      <Bounds margin={1.6}>
        <FitWhenPartsChange parts={parts} />
        {parts.map((part) => (
          <PartMesh key={part.id} part={part} color={color} />
        ))}
      </Bounds>
      <OrbitControls
        makeDefault
        target={CAMERA_TARGET_MM}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={100}
        maxDistance={1500}
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE }}
      />
    </Canvas>
  );
}

/** Ställer kameran så att hela huset syns när måtten ändras, så att även översiktsbilden i PDF:en visar allt. */
function FitWhenPartsChange({ parts }: { parts: Part[] }) {
  const bounds = useBounds();
  useEffect(() => {
    bounds.refresh().clip().fit();
  }, [bounds, parts]);
  return null;
}
