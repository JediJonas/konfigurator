import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bounds, OrbitControls, useBounds } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { TOUCH, Vector3 } from 'three';
import type { DirectionalLight } from 'three';
import type { Part } from '../../core/model/part';
import { PartMesh } from './PartMesh';
import { lightPositionForView } from './viewerLight';

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
      <ViewerLight />
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

/** Riktat ljus med skugga som följer betraktaren, så att skuggan flyttar sig när man vrider fatet. */
function ViewerLight() {
  const lightRef = useRef<DirectionalLight>(null);
  const controls = useThree((state) => state.controls) as unknown as { target: Vector3 } | null;
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    // Målet måste ligga i scenen för att ljusets riktning ska uppdateras.
    scene.add(light.target);
    return () => {
      scene.remove(light.target);
    };
  }, [scene]);

  // Körs bara när vyn ritas om, alltså när kameran eller huset har ändrats.
  useFrame(({ camera }) => {
    const light = lightRef.current;
    if (!light) return;
    const target = controls?.target ?? new Vector3(0, 0, 0);
    const position = lightPositionForView(camera.position, target);
    light.position.set(position.x, position.y, position.z);
    light.target.position.copy(target);
  });

  return (
    <directionalLight ref={lightRef} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]}>
      <orthographicCamera attach="shadow-camera" args={[-300, 300, 300, -300, 1, 1500]} />
    </directionalLight>
  );
}
