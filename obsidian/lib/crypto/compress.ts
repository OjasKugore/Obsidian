/**
 * lib/crypto/compress.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Compression using the Web Streams CompressionStream & DecompressionStream APIs.
 * Automatically falls back to 'none' if compression increases payload byte size.
 *
 * Zero DOM dependencies — works in Web Workers, Node.js ≥ 18, and modern browsers.
 * Wire format: stored in adata[0][7] as 'zlib' | 'none'.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── HELPER BUFFER CONVERTERS ──────────────────────────────────────────

/** Casts Uint8Array to ArrayBuffer-backed variant required by Web Streams API */
function buf(u: Uint8Array): Uint8Array<ArrayBuffer> {
  return u.buffer instanceof ArrayBuffer
    ? (u as unknown as Uint8Array<ArrayBuffer>)
    : (new Uint8Array(u) as unknown as Uint8Array<ArrayBuffer>);
}

// ── STREAM COMPRESSION & DECOMPRESSION ───────────────────────────────

/**
 * Compresses data using deflate-raw stream compression (CompressionStream API).
 */
export async function compress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  const reader = cs.readable.getReader();

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
 * Decompresses deflate-raw compressed bytes (DecompressionStream API).
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

// ── COMPRESSION STRATEGY PICKER ──────────────────────────────────────

/**
 * Evaluates plaintext size and compresses data.
 * If compressed size is larger than uncompressed, returns original bytes with method='none'.
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
    // CompressionStream not available in environment — fall through
  }
  return { data, method: 'none' };
}
