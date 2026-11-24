/** Alla längder är millimeter. */
export type Mm = number;

export interface Vec2 {
  x: Mm;
  y: Mm;
}

export interface Vec3 {
  x: Mm;
  y: Mm;
  z: Mm;
}

export function vec2(x: Mm, y: Mm): Vec2 {
  return { x, y };
}

export function vec3(x: Mm, y: Mm, z: Mm): Vec3 {
  return { x, y, z };
}

export function subtract3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function length3(a: Vec3): Mm {
  return Math.hypot(a.x, a.y, a.z);
}

export function distance2(a: Vec2, b: Vec2): Mm {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
