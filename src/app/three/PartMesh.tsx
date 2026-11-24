import { useMemo } from 'react';
import { Edges } from '@react-three/drei';
import { ExtrudeGeometry, Matrix4, Path, Shape } from 'three';
import type { Polygon } from '../../core/geometry/polygon';
import type { Part } from '../../core/model/part';

interface PartMeshProps {
  part: Part;
  color: string;
}

/** Extruderar delens kontur till materialtjockleken. Alla mått kommer från delen. */
export function PartMesh({ part, color }: PartMeshProps) {
  const geometry = useMemo(() => buildGeometry(part), [part]);
  const matrix = useMemo(() => new Matrix4().fromArray([...part.transform]), [part.transform]);
  return (
    <mesh geometry={geometry} matrix={matrix} matrixAutoUpdate={false} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.85} />
      <Edges color="#5a3313" threshold={20} />
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

function tracePolygon(path: Path, polygon: Polygon): void {
  polygon.forEach((point, index) => (index === 0 ? path.moveTo(point.x, point.y) : path.lineTo(point.x, point.y)));
  path.closePath();
}
