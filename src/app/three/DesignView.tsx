import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bounds, OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { Shape, ShapeGeometry, TOUCH, Vector2, Vector3 } from 'three';
import type { Camera, DirectionalLight, Group } from 'three';
import type { RefObject } from 'react';
import type { Polygon } from '../../core/geometry/polygon';
import type { Part } from '../../core/model/part';
import type { EdgeBead } from '../../core/model/domain';
import type { ViewRequest } from '../state/designStore';
import { CameraFitting } from './CameraFitting';
import { EdgeBeadMesh } from './EdgeBeadMesh';
import { listInsideFloors } from './insideFloor';
import { PartMesh } from './PartMesh';
import type { PickArea } from './pickAreas';
import { PickAreaMesh } from './PickAreaMesh';
import type { SelectionHighlight } from '../ui/selectionHighlight';
import { lightPositionForView } from './viewerLight';
import { cameraPositionOutsideParts, prepareClearanceParts } from './cameraClearance';
import type { ClearancePart } from './cameraClearance';
import type { CaptureOverview } from './OverviewCapture';
import { OverviewCapture, VIEWER_LIGHT_NAME } from './OverviewCapture';
import { measurePartsExtent, plateRadius, SHADOW_FLOOR_RADIUS_MM, shadowCameraBox } from './viewerFloor';
import type { ShadowCameraBox } from './viewerFloor';
import { measurePlateCenteringOffset, shiftParts, shiftPickAreas } from './plateCentering';

interface DesignViewProps {
  parts: Part[];
  color: string;
  /** Fylls med en funktion som tar översiktsbilden till PDF:en. */
  captureRef: RefObject<CaptureOverview | null>;
  /** Fylls med en funktion som centrerar huset och anpassar zoomen. */
  fitRef: RefObject<FitView | null>;
  /** Ändras när ett annat hus öppnas: kameran visar det med den sparade vinkeln, eller ställs in på det. */
  viewRequest: ViewRequest;
  /** Det som är valt, t.ex. en vägg, ett tak eller ett fönster; det visas i en annan färg. */
  highlight: SelectionHighlight;
  /** Anropas när man trycker på en del, eller på tomma ytan (utan id). */
  onSelectPart: (partId: string | undefined) => void;
  /** Ytor utan egen del som öppnar ett objekt, t.ex. fönsterhål. */
  pickAreas: PickArea[];
  /** Anropas när man trycker på en sådan yta. */
  onSelectInstance: (instanceId: string) => void;
  /** Randen längs ytterkanterna, t.ex. kristyr, när den ska visas. */
  edgeBead?: EdgeBead;
  /** Anropas när man själv vrider, zoomar eller flyttar vyn, inte när vyn centreras. */
  onUserMoveView: () => void;
}

import type { FitView } from './CameraFitting';
export type { FitView };

/** Skuggans upplösning; rutan växer med skuggan så den behöver fler punkter än förr. */
const SHADOW_MAP_SIZE_PX = 2048;
/** Hur mörk skuggan är på bordet utanför fatet. */
const FLOOR_SHADOW_OPACITY = 0.2;
/** Golvet inne i huset: mörkare än fatet, som i skugga, och strax ovanför fatet (som ligger på −0,5 mm). */
const INSIDE_FLOOR_COLOR = '#5a4a3c';
/** 3D-vyns bakgrund: en aning mörkare beige än sidan, så att den vita kristyren syns mot den (ägarens önskan, tidigare #f3e9dc). */
const BACKGROUND_COLOR = '#e6d5c1';
const INSIDE_FLOOR_HEIGHT_MM = -0.25;
const CAMERA_POSITION_MM: [number, number, number] = [260, 230, 340];
const CAMERA_TARGET_MM: [number, number, number] = [0, 70, 0];
/** Närmaste avstånd till vyns mittpunkt. Husets egna väggar och tak stoppar zoomen långt innan dess. */
const MIN_ORBIT_DISTANCE_MM = 20;

export function DesignView({ parts: designParts, color, captureRef, fitRef, viewRequest, highlight, onSelectPart, pickAreas: designPickAreas, onSelectInstance, edgeBead, onUserMoveView }: DesignViewProps) {
  // Huset med alla tillbyggnader och sektioner står alltid mitt på fatet (ägarens önskan).
  const offset = useMemo(() => measurePlateCenteringOffset(designParts), [designParts]);
  const parts = useMemo(() => shiftParts(designParts, offset), [designParts, offset]);
  const pickAreas = useMemo(() => shiftPickAreas(designPickAreas, offset), [designPickAreas, offset]);
  const partsRef = useRef<Group>(null);
  // Sant mellan att man tar tag i vyn och släpper. Ett tryck utan rörelse ändrar inte kameran och räknas inte.
  const isUserHoldingViewRef = useRef(false);
  const extent = useMemo(() => measurePartsExtent(parts), [parts]);
  const shadowBox = useMemo(() => shadowCameraBox(extent), [extent]);
  const insideFloors = useMemo(() => listInsideFloors(parts), [parts]);
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
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <hemisphereLight args={['#fff8ee', '#8a7560', 1.2]} />
      <ViewerLight shadowBox={shadowBox} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.5} receiveShadow>
        <circleGeometry args={[plateRadius(extent), 64]} />
        <meshStandardMaterial color="#fbfbf8" roughness={0.4} />
      </mesh>
      {insideFloors.map((floor, index) => (
        <InsideFloor key={index} floor={floor} />
      ))}
      {/* Osynligt bord under fatet som bara visar skuggan, så att den kan falla utanför fatet. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-1} receiveShadow>
        <circleGeometry args={[SHADOW_FLOOR_RADIUS_MM, 64]} />
        <shadowMaterial opacity={FLOOR_SHADOW_OPACITY} />
      </mesh>
      <Bounds margin={1.6}>
        <CameraFitting parts={parts} fitRef={fitRef} viewRequest={viewRequest} />
        <group ref={partsRef}>
          {parts.map((part) => (
            <PartMesh key={part.id} part={part} color={color} isSelected={highlight.partIds.has(part.id)} onSelect={onSelectPart} />
          ))}
        </group>
      </Bounds>
      {edgeBead ? <EdgeBeadMesh parts={parts} bead={edgeBead} /> : null}
      {pickAreas.map((area, index) => (
        <PickAreaMesh key={`${area.instanceId}/${index}`} area={area} isSelected={area.instanceId === highlight.pickInstanceId} onSelect={onSelectInstance} />
      ))}
      <OverviewCapture partsRef={partsRef} captureRef={captureRef} />
      <CameraClearance parts={parts} />
      <OrbitControls
        makeDefault
        target={CAMERA_TARGET_MM}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={MIN_ORBIT_DISTANCE_MM}
        maxDistance={1500}
        touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_ROTATE }}
        onStart={() => {
          isUserHoldingViewRef.current = true;
        }}
        onChange={() => {
          if (isUserHoldingViewRef.current) onUserMoveView();
        }}
        onEnd={() => {
          isUserHoldingViewRef.current = false;
        }}
      />
    </Canvas>
  );
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
function ViewerLight({ shadowBox }: { shadowBox: ShadowCameraBox }) {
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
    <directionalLight ref={lightRef} name={VIEWER_LIGHT_NAME} intensity={1.8} castShadow shadow-mapSize={[SHADOW_MAP_SIZE_PX, SHADOW_MAP_SIZE_PX]}>
      <orthographicCamera
        // Ny kamera när rutan ändras, så att skuggan räknas om med de nya gränserna.
        key={`${shadowBox.halfSizeMm}-${shadowBox.farMm}`}
        attach="shadow-camera"
        args={[-shadowBox.halfSizeMm, shadowBox.halfSizeMm, shadowBox.halfSizeMm, -shadowBox.halfSizeMm, 1, shadowBox.farMm]}
      />
    </directionalLight>
  );
}

/** Golvet inne i huset, mörkare än fatet, som i skugga. Ligger strax över fatet och under delarna. */
function InsideFloor({ floor }: { floor: Polygon }) {
  const geometry = useMemo(() => {
    // Polygonens y är världens z; planet vrids ner så att formens y pekar mot −z, därför byts tecknet.
    const shape = new Shape(floor.map((point) => new Vector2(point.x, -point.y)));
    return new ShapeGeometry(shape);
  }, [floor]);
  return (
    <mesh geometry={geometry} rotation-x={-Math.PI / 2} position-y={INSIDE_FLOOR_HEIGHT_MM}>
      <meshStandardMaterial color={INSIDE_FLOOR_COLOR} roughness={0.9} />
    </mesh>
  );
}
