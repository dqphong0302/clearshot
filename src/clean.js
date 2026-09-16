/**
 * ClearShot - Image Metadata Purge & Re-encoding Core
 * Supports:
 * 1. Lossless Byte-Strip (Direct binary chunk/marker removal without pixel decoding)
 * 2. Safe Canvas Re-encode (Bakes EXIF rotation, resets encoder tables, custom format/quality)
 * 3. Paranoid Mode (Safe + Box-Muller Gaussian Noise to perturb quantization tables & SynthID watermark)
 */

function u32be(u8, offset) {
  return ((u8[offset] << 24) | (u8[offset + 1] << 16) | (u8[offset + 2] << 8) | u8[offset + 3]) >>> 0;
}

function bytesToAscii(u8, start, len) {
  let s = '';
  const end = Math.min(start + len, u8.length);
  for (let i = start; i < end; i++) {
    s += String.fromCharCode(u8[i]);
  }
  return s;
}

// ---------------------------------------------------------------------------
// 1. Lossless Binary Cleaners
// ---------------------------------------------------------------------------

const PNG_KEEP_CHUNKS = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'pHYs', 'sBIT', 'hIST', 'sPLT', 'acTL', 'fcTL', 'fdAT'
]);

function cleanPngLossless(bytes) {
  // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d || bytes[5] !== 0x0a || bytes[6] !== 0x1a || bytes[7] !== 0x0a
  ) {
    throw new Error('INVALID_PNG');
  }

  const keptChunks = [];
  let offset = 8;
  let totalLength = 8;

  while (offset + 8 <= bytes.length) {
    const len = u32be(bytes, offset);
    const type = bytesToAscii(bytes, offset + 4, 4);
    const chunkFullLength = 12 + len;

    if (offset + chunkFullLength > bytes.length || len < 0) {
      break;
    }

    // Keep only essential image rendering chunks, strip caBX, tEXt, iTXt, zTXt, eXIf, iCCP, etc.
    if (PNG_KEEP_CHUNKS.has(type)) {
      const chunkData = bytes.subarray(offset, offset + chunkFullLength);
      keptChunks.push(chunkData);
      totalLength += chunkData.length;
    }

    offset += chunkFullLength;
    if (type === 'IEND') break;
  }

  const out = new Uint8Array(totalLength);
  out.set(bytes.subarray(0, 8), 0);
  let pos = 8;
  for (const chunk of keptChunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }

  return new Blob([out], { type: 'image/png' });
}

function cleanJpegLossless(bytes) {
  // Check JPEG SOI: FF D8
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('INVALID_JPEG');
  }

  const segments = [];
  let offset = 2;

  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      break;
    }

    const marker = bytes[offset + 1];

    // EOI (End of Image)
    if (marker === 0xd9) {
      break;
    }

    // Start of Scan (SOS): Keep everything from SOS marker to EOF
    if (marker === 0xda) {
      segments.push(bytes.subarray(offset));
      offset = bytes.length;
      break;
    }

    // Restart markers RST0 - RST7 (no length field)
    if (marker >= 0xd0 && marker <= 0xd7) {
      segments.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    const len = (bytes[offset + 2] << 8) | bytes[offset + 3];
    const segEnd = offset + 2 + len;
    if (len < 2 || segEnd > bytes.length) {
      break;
    }

    // Determine if this segment is metadata to strip
    // APP1 (EXIF/XMP), APP11 (C2PA/JUMBF), APP13 (Photoshop/IPTC), APP14 (Adobe), COM (Comment), other APPn
    const isAppMarker = marker >= 0xe1 && marker <= 0xef;
    const isComment = marker === 0xfe;
    const isMetadata = isAppMarker || isComment;

    if (!isMetadata) {
      segments.push(bytes.subarray(offset, segEnd));
    }

    offset = segEnd;
  }

  let totalSize = 2; // SOI
  for (const seg of segments) {
    totalSize += seg.length;
  }

  const out = new Uint8Array(totalSize);
  out.set(bytes.subarray(0, 2), 0); // SOI
  let p = 2;
  for (const seg of segments) {
    out.set(seg, p);
    p += seg.length;
  }

  return new Blob([out], { type: 'image/jpeg' });
}

function cleanWebpLossless(bytes) {
  // Check WEBP header: 'RIFF....WEBP'
  const riff = bytesToAscii(bytes, 0, 4);
  const webp = bytesToAscii(bytes, 8, 4);
  if (riff !== 'RIFF' || webp !== 'WEBP') {
    throw new Error('INVALID_WEBP');
  }

  const keepChunks = [];
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const fourcc = bytesToAscii(bytes, offset, 4);
    const size = (bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] * 16777216)) >>> 0;
    const padded = size + (size & 1);
    const chunkEnd = offset + 8 + padded;

    if (chunkEnd > bytes.length) {
      break;
    }

    const chunkData = bytes.subarray(offset, chunkEnd);
    const upperType = fourcc.trim().toUpperCase();

    // Strip EXIF and XMP metadata chunks
    if (upperType === 'EXIF' || upperType === 'XMP') {
      // Ignored / stripped
    } else {
      let finalChunk = chunkData;
      // If VP8X chunk, clear bit 3 (EXIF) and bit 2 (XMP) in flag byte (offset 8 of the chunk)
      if (fourcc === 'VP8X' && chunkData.length >= 9) {
        finalChunk = chunkData.slice();
        finalChunk[8] = finalChunk[8] & ~(0x08 | 0x04);
      }
      keepChunks.push(finalChunk);
    }

    offset = chunkEnd;
  }

  let payloadSize = 0;
  for (const c of keepChunks) {
    payloadSize += c.length;
  }

  const out = new Uint8Array(12 + payloadSize);
  // RIFF header
  out[0] = 0x52; out[1] = 0x49; out[2] = 0x46; out[3] = 0x46; // 'RIFF'
  const riffSize = 4 + payloadSize;
  out[4] = riffSize & 0xff;
  out[5] = (riffSize >> 8) & 0xff;
  out[6] = (riffSize >> 16) & 0xff;
  out[7] = (riffSize >> 24) & 0xff;
  out[8] = 0x57; out[9] = 0x45; out[10] = 0x42; out[11] = 0x50; // 'WEBP'

  let p = 12;
  for (const c of keepChunks) {
    out.set(c, p);
    p += c.length;
  }

  return new Blob([out], { type: 'image/webp' });
}

// ---------------------------------------------------------------------------
// 2. Gaussian Box-Muller Noise (Paranoid Mode)
// ---------------------------------------------------------------------------

function addGaussianNoise(imageData, sigma = 1.5) {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) { // R, G, B — leave alpha untouched
      const u1 = Math.random() || 1e-6;
      const u2 = Math.random();
      const z = sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      d[i + c] = Math.min(255, Math.max(0, Math.round(d[i + c] + z)));
    }
  }
  return imageData;
}

// ---------------------------------------------------------------------------
// 3. Unified Cleaning Function
// ---------------------------------------------------------------------------

/**
 * Clean image file with selected options
 * @param {File} file 
 * @param {Object} options - { mode: 'lossless'|'safe'|'paranoid', format: 'original'|'image/jpeg'|'image/png'|'image/webp', quality: 0.7-1.0 }
 * @returns {Promise<Blob>}
 */
export async function cleanImage(file, options = {}) {
  const mode = typeof options === 'string' ? options : (options.mode || 'lossless');
  const targetFormat = (options.format && options.format !== 'original') ? options.format : file.type;
  const targetQuality = typeof options.quality === 'number' ? options.quality : 0.92;

  // 1. Lossless Byte-Strip Mode (only if output format is preserved as original)
  if (mode === 'lossless' && (!options.format || options.format === 'original' || options.format === file.type)) {
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);

      if (file.type === 'image/png') {
        return cleanPngLossless(bytes);
      } else if (file.type === 'image/jpeg') {
        return cleanJpegLossless(bytes);
      } else if (file.type === 'image/webp') {
        return cleanWebpLossless(bytes);
      }
    } catch (err) {
      console.warn('Lossless strip encountered an error, falling back to safe re-encode:', err);
      // Fall through to safe re-encode if binary strip fails
    }
  }

  // 2. Canvas Re-encode (Safe & Paranoid Modes, or when converting formats)
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  if (mode === 'paranoid') {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    addGaussianNoise(imageData, 1.5);
    ctx.putImageData(imageData, 0, 0);
  }

  const mime = targetFormat || 'image/jpeg';
  const quality = mime === 'image/png' ? undefined : targetQuality;

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('ENCODE_FAILED'))),
      mime,
      quality
    );
  });

  return blob;
}
