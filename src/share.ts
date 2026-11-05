/**
 * Scripts travel inside the address after '#', which browsers never send to
 * the server. Two forms:
 *   #z=<base64url of deflate-raw>  (short; made with code)
 *   #s=<percent-encoded text>      (no compression needed)
 */

function toB64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encodeScript(src: string): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(src), new CompressionStream('deflate-raw'));
  return `z=${toB64Url(packed)}`;
}

/** Returns the script carried in a location hash, or null if there is none. */
export async function decodeHash(hash: string): Promise<string | null> {
  const h = hash.replace(/^#/, '');
  if (h.startsWith('z=')) {
    const raw = await pipe(fromB64Url(h.slice(2)), new DecompressionStream('deflate-raw'));
    return new TextDecoder().decode(raw);
  }
  if (h.startsWith('s=')) return decodeURIComponent(h.slice(2));
  return null;
}
