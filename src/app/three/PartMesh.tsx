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
const SELECTED_COLOR = '#d9a441';
/** Rör sig pekaren mer än så här i pixlar är det en vridning av vyn, inte ett tryck. */
const TAP_MAX_MOVEMENT_PX = 6;

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
      <meshStandardMaterial color={isSelected ? SELECTED_COLOR : color} roughness={0.85} />
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
  return new ExtrudeGeometry(shape, { depth: part.thickness, bevelEnabled: false });
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
