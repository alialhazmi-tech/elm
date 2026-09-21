/** استخراج أبعاد الصور من رؤوس الملفات بلا اعتماديات — PNG وJPEG وWebP. */

export interface ImageMeta {
  mime: string;
  width: number | null;
  height: number | null;
}

export function readImageMeta(buffer: Uint8Array): ImageMeta | null {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // PNG: توقيع 8 بايت ثم IHDR بالعرض والارتفاع.
  if (buffer.length > 24 && view.getUint32(0) === 0x89504e47) {
    return { mime: "image/png", width: view.getUint32(16), height: view.getUint32(20) };
  }

  // JPEG: مسح مقاطع حتى SOF0–SOF15 (عدا DHT/DAC/RST).
  if (buffer.length > 4 && view.getUint16(0) === 0xffd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return {
          mime: "image/jpeg",
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7),
        };
      }
      offset += 2 + view.getUint16(offset + 2);
    }
    return { mime: "image/jpeg", width: null, height: null };
  }

  // WebP: RIFF….WEBP ثم VP8 / VP8L / VP8X.
  if (
    buffer.length > 30 &&
    view.getUint32(0) === 0x52494646 &&
    view.getUint32(8) === 0x57454250
  ) {
    const format = String.fromCharCode(buffer[12], buffer[13], buffer[14], buffer[15]);
    if (format === "VP8X") {
      const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
      return { mime: "image/webp", width, height };
    }
    if (format === "VP8 ") {
      return {
        mime: "image/webp",
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    if (format === "VP8L") {
      const bits = view.getUint32(21, true);
      return {
        mime: "image/webp",
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
    return { mime: "image/webp", width: null, height: null };
  }

  return null;
}
