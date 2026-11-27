import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three';
import type { PickArea } from './pickAreas';
import { triangulatePlanarRegion } from './pickAreas';
import { TAP_MAX_MOVEMENT_PX } from './PartMesh';

interface PickAreaMeshProps {
  area: PickArea;
  onSelect: (instanceId: string) => void;
}

/** En osynlig yta över t.ex. ett fönsterhål, så att man kan trycka på fönstret. */
export function PickAreaMesh({ area, onSelect }: PickAreaMeshProps) {
  const geometry = useMemo(() => buildGeometry(area), [area]);
  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (event.delta > TAP_MAX_MOVEMENT_PX) return;
    event.stopPropagation();
    onSelect(area.instanceId);
  }
  return (
    <mesh geometry={geometry} onClick={handleClick}>
      {/* Ritas inte, men träffas när man trycker. */}
      <meshBasicMaterial side={DoubleSide} colorWrite={false} depthWrite={false} transparent opacity={0} />
    </mesh>
  );
}

function buildGeometry(area: PickArea): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(area.region.flatMap((point) => [point.x, point.y, point.z]), 3));
  geometry.setIndex(triangulatePlanarRegion(area.region));
  geometry.computeBoundingSphere();
  return geometry;
}
