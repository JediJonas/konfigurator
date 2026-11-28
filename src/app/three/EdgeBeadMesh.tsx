import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import type { EdgeBead } from '../../core/model/domain';
import type { Part } from '../../core/model/part';
import { listOuterEdges } from '../../core/geometry/outerEdges';
import { buildBeadGeometry } from './edgeBeadGeometry';

interface EdgeBeadMeshProps {
  parts: Part[];
  bead: EdgeBead;
}

/**
 * Randen längs husets ytterkanter, t.ex. kristyr. Bara för att visa; den går
 * inte att trycka på, så ett tryck når delen bakom.
 */
export function EdgeBeadMesh({ parts, bead }: EdgeBeadMeshProps) {
  const geometry = useMemo(() => {
    const data = buildBeadGeometry(listOuterEdges(parts, { mergeDistance: bead.mergeDistance }), bead.radius);
    const result = new BufferGeometry();
    result.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
    result.setAttribute('normal', new Float32BufferAttribute(data.normals, 3));
    result.setIndex(data.indices);
    return result;
  }, [parts, bead]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow raycast={() => null}>
      <meshStandardMaterial color={bead.color} roughness={0.55} />
    </mesh>
  );
}
