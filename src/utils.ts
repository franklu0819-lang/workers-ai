export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < bytes.byteLength; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.byteLength);
    chunks.push(String.fromCharCode(...bytes.subarray(i, end)));
  }
  return btoa(chunks.join(""));
}
