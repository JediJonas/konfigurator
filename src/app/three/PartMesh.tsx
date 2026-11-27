import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Matrix4, Path, Shape } from 'three';
import { listPartEdges } from './partEdges';
import type { Polygon } from '../../core/geometry/polygon';
import type { Part } from '../../core/model/part';

interface PartMeshProps {
  part: Part;
  color: string;
  isSelected: boolean;
  onSelect: (partId: string) => void;
}

/** Färgen på en vald vägg, så att man ser var en tillbyggnad hamnar. */
export const SELECTED_COLOR = '#d9a441';
/** Så ljus insidan av väggar och tak är jämfört med utsidan, så att det ser mörkt ut inne i huset. */
const INSIDE_SHADE = 0.45;
const INSIDE_TOLERANCE_MM = 1e-6;
/** Rör sig pekaren mer än så här i pixlar är det en vridning av vyn, inte ett tryck. */
export const TAP_MAX_MOVEMENT_PX = 6;

/** Extruderar delens kontur till materialtjockleken. Alla mått kommer från delen. */
export function PartMesh({ part, color, isSelected, onSelect }: PartMeshProps) {
  const geometry = useMemo(() => buildGeometry(part), [part]);
  const edges = useMemo(() => buildEdges(part), [part]);
  const matrix = useMemo(() => new Matrix4().fromArray([...part.transform]), [part.transform]);
  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (event.delta > TAP_MAX_MOVEMENT_PX) return;
    // Bara den närmaste delen under fingret ska väljas, inte de bakom.
    event.stopPropagation();
    onSelect(part.id);
  }
  return (
    <mesh geometry={geometry} matrix={matrix} matrixAutoUpdate={false} castShadow receiveShadow onClick={handleClick}>
      <meshStandardMaterial color={isSelected ? SELECTED_COLOR : color} roughness={0.85} vertexColors />
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#5a3313" />
      </lineSegments>
    </mesh>
  );
}

function buildGeometry(part: Part): ExtrudeGeometry {
  const shape = new Shape();
  tracePolygon(shape, part.outline);
  for (const hole of part.holes) {
    const path = new Path();
    tracePolygon(path, hole);
    shape.holes.push(path);
  }
  const geometry = new ExtrudeGeometry(shape, { depth: part.thickness, bevelEnabled: false });
  geometry.setAttribute('color', new Float32BufferAttribute(shadeInside(geometry, part.hasInsideAtZero ?? false), 3));
  return geometry;
}

/** En färgfaktor per hörn: mörkare på trianglarna som ligger i insidan vid z = 0. */
function shadeInside(geometry: ExtrudeGeometry, hasInsideAtZero: boolean): number[] {
  const positions = geometry.getAttribute('position');
  const colors: number[] = [];
  for (let start = 0; start < positions.count; start += 3) {
    const isInside = hasInsideAtZero && [0, 1, 2].every((offset) => Math.abs(positions.getZ(start + offset)) < INSIDE_TOLERANCE_MM);
    const shade = isInside ? INSIDE_SHADE : 1;
    for (let corner = 0; corner < 3; corner++) colors.push(shade, shade, shade);
  }
  return colors;
}

function buildEdges(part: Part): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(listPartEdges(part), 3));
  return geometry;
}

function tracePolygon(path: Path, polygon: Polygon): void {
  polygon.forEach((point, index) => (index === 0 ? path.moveTo(point.x, point.y) : path.lineTo(point.x, point.y)));
  path.closePath();
}
