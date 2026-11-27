import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { BufferGeometry, DoubleSide, Float32BufferAttribute } from 'three';
import type { PickArea } from './pickAreas';
import { triangulatePlanarRegion } from './pickAreas';
import { SELECTED_COLOR, TAP_MAX_MOVEMENT_PX } from './PartMesh';

interface PickAreaMeshProps {
  area: PickArea;
  /** Ett valt fönster visas med hålet fyllt i markeringens färg. */
  isSelected: boolean;
  onSelect: (instanceId: string) => void;
}

/** Så täckt hålet är när fönstret är valt; man ser fortfarande in genom det. */
const SELECTED_OPACITY = 0.6;

/** En osynlig yta över t.ex. ett fönsterhål, så att man kan trycka på fönstret. */
export function PickAreaMesh({ area, isSelected, onSelect }: PickAreaMeshProps) {
  const geometry = useMemo(() => buildGeometry(area), [area]);
  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (event.delta > TAP_MAX_MOVEMENT_PX) return;
    event.stopPropagation();
    onSelect(area.instanceId);
  }
  return (
    <mesh geometry={geometry} onClick={handleClick}>
      {/* Ritas bara när fönstret är valt, men träffas alltid när man trycker. */}
      <meshBasicMaterial
        side={DoubleSide}
        color={SELECTED_COLOR}
        colorWrite={isSelected}
        depthWrite={false}
        transparent
        opacity={isSelected ? SELECTED_OPACITY : 0}
      />
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
