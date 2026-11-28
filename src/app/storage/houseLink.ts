import type { Design } from '../../core/model/design';
import type { Domain } from '../../core/model/domain';
import { packDesign, unpackDesign } from './compactDesign';
import { readStoredDesign } from './storedDesign';

/** Namnet på huset i adressen: `#hus=1.…`. */
export const HOUSE_LINK_KEY = 'hus';
/** Höjs om länkens packning ändras, så att gamla länkar kan läsas på det gamla sättet. */
const HOUSE_LINK_FORMAT = '1';
const COMPRESSION_FORMAT = 'deflate-raw';

export interface LinkedHouse {
  design: Design;
  name?: string;
}

/**
 * Länk till huset med hela designen i adressen, packad och komprimerad så att
 * den blir kort. Den står efter `#`, så att den aldrig skickas till servern.
 */
export async function createHouseLink(pageUrl: string, design: Design, domain: Domain, name?: string): Promise<string> {
  const bytes = await transformBytes(new TextEncoder().encode(JSON.stringify(packDesign(design, domain, name))), new CompressionStream(COMPRESSION_FORMAT));
  const url = new URL(pageUrl);
  url.hash = `${HOUSE_LINK_KEY}=${HOUSE_LINK_FORMAT}.${encodeBase64Url(bytes)}`;
  return url.toString();
}

/** Läser huset ur adressens `#`-del. Ger inget när adressen inte har något hus; kastar om huset inte går att öppna. */
export async function readHouseLink(hash: string, domain: Domain): Promise<LinkedHouse | undefined> {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get(HOUSE_LINK_KEY);
  if (!value) return undefined;
  const [format, data] = value.split('.');
  if (format !== HOUSE_LINK_FORMAT || !data) throw new Error('Länken är från en nyare version av appen.');
  const bytes = await transformBytes(decodeBase64Url(data), new DecompressionStream(COMPRESSION_FORMAT));
  const { design, name } = unpackDesign(JSON.parse(new TextDecoder().decode(bytes)), domain);
  return { design: readStoredDesign(design, domain), name };
}

async function transformBytes(bytes: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Base64 med tecken som går i en adress utan att kodas om: `-` och `_`, utan `=`. */
function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
