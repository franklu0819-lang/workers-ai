export function errorResponse(
  status: number,
  message: string,
  type: string,
  param: string | null = null,
  code: string | null = null,
): Response {
  return new Response(
    JSON.stringify({ error: { message, type, param, code } }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.byteLength);
    chunks.push(String.fromCharCode(...bytes.subarray(i, end)));
  }
  return btoa(chunks.join(""));
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}
