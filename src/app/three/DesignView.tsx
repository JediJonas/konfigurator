import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bounds, OrbitControls, useBounds } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { TOUCH, Vector3 } from 'three';
import type { Camera, DirectionalLight, Group } from 'three';
import type { RefObject } from 'react';
import type { Part } from '../../core/model/part';
import { PartMesh } from './PartMesh';
import { lightPositionForView } from './viewerLight';
import { cameraPositionOutsideParts, prepareClearanceParts } from './cameraClearance';
import type { ClearancePart } from './cameraClearance';
import type { CaptureOverview } from './OverviewCapture';
import { OverviewCapture, VIEWER_LIGHT_NAME } from './OverviewCapture';

interface DesignViewProps {
  parts: Part[];
  color: string;
  /** Fylls med en funktion som tar översiktsbilden till PDF:en. */
  captureRef: RefObject<CaptureOverview | null>;
  /** Fylls med en funktion som centrerar huset och anpassar zoomen. */
  fitRef: RefObject<FitView | null>;
  /** Delen vars kopplingspunkt är vald; den visas i en annan färg. */
  selectedPartId?: string;
  /** Anropas när man trycker på en del, eller på tomma ytan (utan id). */
  onSelectPart: (partId: string | undefined) => void;
}

export type FitView = () => void;

/** Fatets minsta radie i 3D-vyn. Fatet är bara bakgrund och ingår inte i underlaget. */
const MIN_PLATE_RADIUS_MM = 220;
/** Fatets kant utanför huset, så att tillbyggnader också står på fatet. */
const PLATE_MARGIN_MM = 40;
const CAMERA_POSITION_MM: [number, number, number] = [260, 230, 340];
const CAMERA_TARGET_MM: [number, number, number] = [0, 70, 0];
/** Närmaste avstånd till vyns mittpunkt. Husets egna väggar och tak stoppar zoomen långt innan dess. */
const MIN_ORBIT_DISTANCE_MM = 20;

export function DesignView({ parts, color, captureRef, fitRef, selectedPartId, onSelectPart }: DesignViewProps) {
  const partsRef = useRef<Group>(null);
  return (
    <Canvas
      // Ritar bara om när något ändras, vilket sparar batteri i mobilen.
      frameloop="demand"
      shadows
      camera={{ position: CAMERA_POSITION_MM, fov: 40, near: 1, far: 5000 }}
      // Behövs för att kunna kopiera översiktsbilden till ritningens första sida.
      gl={{ preserveDrawingBuffer: true }}
      onPointerMissed={() => onSelectPart(undefined)}
    >
      <color attach="background" args={['#f3e9dc']} />
      <hemisphereLight args={['#fff8ee', '#8a7560', 1.2]} />
      <ViewerLight />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.5} receiveShadow>
        <circleGeometry args={[plateRadius(parts), 64]} />
        <meshStandardMaterial color="#fbfbf8" roughness={0.4} />
      </mesh>
      <Bounds margin={1.6}>
        <CameraFitting parts={parts} fitRef={fitRef} />
        <group ref={partsRef}>
          {parts.map((part) => (
            <PartMesh key={part.id} part={part} color={color} isSelected={part.id === selectedPartId} onSelect={onSelectPart} />
          ))}
        </group>
      </Bounds>
      <OverviewCapture partsRef={partsRef} captureRef={captureRef} />
      <CameraClearance parts={parts} />
      <OrbitControls
        makeDefault
        target={CAMERA_TARGET_MM}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={MIN_ORBIT_DISTANCE_MM}
        maxDistance={1500}
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE }}
      />
    </Canvas>
  );
}

/**
 * Ställer kameran så att hela huset syns när det visas första gången och när
 * man trycker på knappen för att centrera. Annars behåller kameran sitt läge
 * när måtten ändras, så att vyn inte hoppar; ägaren vill zooma själv.
 * PDF:ens översiktsbild har en egen kamera.
 */
function CameraFitting({ parts, fitRef }: { parts: Part[]; fitRef: RefObject<FitView | null> }) {
  const bounds = useBounds();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    fitRef.current = () => bounds.refresh().clip().fit();
    return () => {
      fitRef.current = null;
    };
  }, [bounds, fitRef]);

  useEffect(() => {
    if (hasFittedRef.current || parts.length === 0) return;
    hasFittedRef.current = true;
    bounds.refresh().clip().fit();
  }, [bounds, parts]);
  return null;
}

/**
 * Håller kameran utanför huset: zoomar, vrider eller flyttar man vyn så att
 * kameran skulle hamna i en vägg eller ett tak, stannar den precis utanför.
 * Gäller mus, hjul och nyp i mobilen, eftersom alla går via kontrollernas
 * ändringshändelse. När måtten ändras flyttas kameran bara om huset har vuxit
 * runt den; annars står den kvar.
 */
function CameraClearance({ parts }: { parts: Part[] }) {
  const controls = useThree((state) => state.controls) as unknown as OrbitControlsLike | null;
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const clearanceParts = useMemo(() => prepareClearanceParts(parts), [parts]);

  useEffect(() => {
    if (!controls) return;
    const keepOutside = () => moveCameraOutside(camera, controls.target, clearanceParts);
    keepOutside();
    invalidate();
    controls.addEventListener('change', keepOutside);
    return () => controls.removeEventListener('change', keepOutside);
  }, [controls, camera, clearanceParts, invalidate]);
  return null;
}

interface OrbitControlsLike {
  target: Vector3;
  addEventListener: (type: 'change', listener: () => void) => void;
  removeEventListener: (type: 'change', listener: () => void) => void;
}

function moveCameraOutside(camera: Camera, target: Vector3, parts: ClearancePart[]): void {
  const position = cameraPositionOutsideParts(parts, target, camera.position);
  if (position === camera.position) return;
  camera.position.set(position.x, position.y, position.z);
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
    <directionalLight ref={lightRef} name={VIEWER_LIGHT_NAME} intensity={1.8} castShadow shadow-mapSize={[1024, 1024]}>
      <orthographicCamera attach="shadow-camera" args={[-300, 300, 300, -300, 1, 1500]} />
    </directionalLight>
  );
}

/** Fatet växer med huset när man bygger till. */
function plateRadius(parts: Part[]): number {
  const reach = parts.flatMap((part) => {
    const m = part.transform;
    return part.outline.map((point) => Math.hypot((m[0] ?? 0) * point.x + (m[4] ?? 0) * point.y + (m[12] ?? 0), (m[2] ?? 0) * point.x + (m[6] ?? 0) * point.y + (m[14] ?? 0)));
  });
  return Math.max(MIN_PLATE_RADIUS_MM, ...reach.map((distance) => distance + PLATE_MARGIN_MM));
}
