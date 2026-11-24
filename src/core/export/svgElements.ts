import type { Polygon } from '../geometry/polygon';
import type { Mm, Vec2 } from '../geometry/vector';

/** Linjebredd för skärlinjer, tunn så att man ser var man ska skära. */
export const CUT_LINE_MM = 0.3;
export const THIN_LINE_MM = 0.2;
export const TEXT_SIZE_MM = 3.5;
export const SMALL_TEXT_SIZE_MM = 2.8;

export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function formatNumber(value: number): string {
  return (Math.round(value * 1000) / 1000).toString();
}

export function polygonPath(polygons: Polygon[]): string {
  return polygons
    .filter((polygon) => polygon.length > 0)
    .map((polygon) => `M${polygon.map((p) => `${formatNumber(p.x)} ${formatNumber(p.y)}`).join(' L')} Z`)
    .join(' ');
}

interface LineOptions {
  width?: Mm;
  dashArray?: string;
}

export function line(from: Vec2, to: Vec2, options: LineOptions = {}): string {
  const dash = options.dashArray ? ` stroke-dasharray="${options.dashArray}"` : '';
  return `<line x1="${formatNumber(from.x)}" y1="${formatNumber(from.y)}" x2="${formatNumber(to.x)}" y2="${formatNumber(to.y)}" stroke="#000" stroke-width="${options.width ?? THIN_LINE_MM}"${dash}/>`;
}

interface TextOptions {
  size?: Mm;
  anchor?: 'start' | 'middle' | 'end';
  isBold?: boolean;
  color?: string;
}

export function text(at: Vec2, content: string, options: TextOptions = {}): string {
  const size = options.size ?? TEXT_SIZE_MM;
  const weight = options.isBold ? ' font-weight="bold"' : '';
  return `<text x="${formatNumber(at.x)}" y="${formatNumber(at.y)}" font-family="helvetica" font-size="${size}" fill="${options.color ?? '#000'}" text-anchor="${options.anchor ?? 'start'}"${weight}>${escapeXml(content)}</text>`;
}

export function svgDocument(width: Mm, height: Mm, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}">${body}</svg>`;
}
