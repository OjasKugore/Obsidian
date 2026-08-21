/**
 * lib/crypto/compress.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Compression using the CompressionStream / DecompressionStream Web API.
 * Falls back to 'none' if compression would make the payload larger.
 *
 * Zero DOM deps — works in browser, Web Workers, and Node.js ≥ 18.
 *
 * Wire format: compression method is stored in adata[0][7] as 'zlib' | 'none'.
 * PrivateBin used 'zlib' to mean deflate-raw; we keep the same label for
 * wire-format compatibility.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Casts Uint8Array to ArrayBuffer-backed variant (TS 5.x SubtleCrypto compat).
 * CompressionStream writer also requires this stricter type.
 */
function buf(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u.buffer instanceof ArrayBuffer
    ? (u as unknown as Uint8Array<ArrayBuffer>)
    : (new Uint8Array(u) as unknown as Uint8Array<ArrayBuffer>);
}

/**
 * Compresses data using deflate-raw (CompressionStream).
 * Throws if the runtime does not support CompressionStream.
 */
export async function compress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();

  const chunks: Uint8Array[] = [];

  // Write all data then close the stream
  const writePromise = (async () => {
    await writer.write(buf(data));
    await writer.close();
  })();
  const readPromise = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  })();

  await Promise.all([writePromise, readPromise]);

  // Concatenate chunks into a single Uint8Array
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Decompresses deflate-raw data using DecompressionStream.
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  const chunks: Uint8Array[] = [];

  const writePromise = (async () => {
    await writer.write(buf(data));
    await writer.close();
  })();

  const readPromise = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  })();

  await Promise.all([writePromise, readPromise]);

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Tries to compress data. If the compressed output is not smaller, returns
 * the original with method='none'. This prevents compression attacks on
 * small plaintexts where compression can actually increase size.
 *
 * @returns { data, method } where method is 'zlib' (compressed) or 'none'
 */
export async function tryCompress(
  data: Uint8Array
): Promise<{ data: Uint8Array; method: 'zlib' | 'none' }> {
  try {
    const compressed = await compress(data);
    if (compressed.length < data.length) {
      return { data: compressed, method: 'zlib' };
    }
  } catch {
    // CompressionStream not available (e.g. old Node.js) — fall through
  }
  return { data, method: 'none' };
}
