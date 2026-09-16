import exifr from 'exifr';

const PNG_CRITICAL = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND']);
const PNG_KNOWN_ANCILLARY = new Set([
  'gAMA', 'cHRM', 'sRGB', 'pHYs', 'tIME', 'bKGD', 'tRNS', 'sBIT', 'hIST', 'sPLT', 'acTL', 'fcTL', 'fdAT',
  'tEXt', 'iTXt', 'zTXt', 'eXIf', 'iCCP',
]);

const AI_TEXT_KEYS = {
  parameters: 'Stable Diffusion (A1111/WebUI) generation parameters',
  prompt: 'ComfyUI prompt / node graph data',
  workflow: 'ComfyUI workflow graph (full node JSON)',
  invokeai_metadata: 'InvokeAI generation metadata',
  invokeai_graph: 'InvokeAI generation graph',
  'sd-metadata': 'Stable Diffusion metadata',
  dream: 'InvokeAI dream string',
};

function tagsToFindings(tags) {
  const findings = [];

  if (tags.ProfileCMMType !== undefined || tags.ProfileVersion !== undefined) {
    findings.push({ category: 'icc', label: 'Hồ sơ màu ICC embedded', detail: 'ICC Profile color space configuration' });
  }

  if (tags.latitude !== undefined || tags.GPSLatitude !== undefined) {
    findings.push({
      category: 'gps',
      label: 'Tọa độ GPS vị trí thực tế',
      detail: `Vĩ độ: ${tags.latitude || tags.GPSLatitude}, Kinh độ: ${tags.longitude || tags.GPSLongitude || 'Có sẵn'}`,
    });
  }
  if (tags.Make || tags.Model) {
    findings.push({ category: 'exif', label: `Thiết bị chụp: ${[tags.Make, tags.Model].filter(Boolean).join(' ')}` });
  }
  if (tags.Software) {
    findings.push({ category: 'software', label: `Phần mềm xử lý: "${String(tags.Software).slice(0, 70)}"` });
  }
  if (tags.UserComment) {
    findings.push({ category: 'comment', label: 'UserComment chú thích ẩn' });
  }
  if (tags.BodySerialNumber || tags.LensSerialNumber || tags.SerialNumber) {
    findings.push({
      category: 'device-serial',
      label: 'Số Serial thiết bị / Ống kính',
      detail: `Body: ${tags.BodySerialNumber || tags.SerialNumber || '—'}, Lens: ${tags.LensSerialNumber || '—'}`,
    });
  }
  if (tags.DigitalSourceType) {
    const val = String(tags.DigitalSourceType);
    findings.push({
      category: 'iptc-ai-tag',
      label: `IPTC DigitalSourceType: ${val}`,
      detail: /trainedAlgorithmicMedia|composite/i.test(val) ? 'Nhãn khai báo chính thức "Tạo bởi AI" (IPTC Standard)' : undefined,
    });
  }
  if (tags.ImageDescription || tags.Description) {
    const text = String(tags.ImageDescription || tags.Description);
    if (/--ar |--v \d|--stylize|midjourney/i.test(text)) {
      findings.push({ category: 'ai-prompt', label: 'Midjourney Prompt (Description field)', detail: text.slice(0, 100) });
    } else {
      findings.push({ category: 'comment', label: `Description: "${text.slice(0, 70)}"` });
    }
  }

  for (const [key, label] of Object.entries(AI_TEXT_KEYS)) {
    if (tags[key] !== undefined) {
      const valStr = typeof tags[key] === 'string' ? tags[key].slice(0, 120) : 'Embedded JSON/graph';
      findings.push({ category: 'ai-prompt', label, detail: valStr });
    }
  }

  return findings;
}

function readChunkType(bytes, offset) {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

function scanPngContainer(bytes, view) {
  const findings = [];
  let offset = 8;
  while (offset + 8 <= bytes.length) {
    const len = view.getUint32(offset, false);
    const type = readChunkType(bytes, offset + 4);

    if (type === 'caBX') {
      findings.push({
        category: 'c2pa',
        label: 'C2PA / Content Credentials manifest (JUMBF)',
        detail: `${len.toLocaleString()} bytes — Khai báo bản quyền nguồn gốc AI (OpenAI, Adobe, Google, Microsoft)`,
      });
    } else if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') {
      const payload = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(offset + 8, Math.min(offset + 8 + len, offset + 200)));
      if (/prompt|workflow|parameters|midjourney|dall-?e|c2pa/i.test(payload)) {
        findings.push({ category: 'ai-prompt', label: `Dấu vết AI trong PNG chunk (${type})`, detail: payload.slice(0, 100) });
      }
    } else if (!PNG_CRITICAL.has(type) && !PNG_KNOWN_ANCILLARY.has(type)) {
      findings.push({ category: 'unknown-chunk', label: `Private chunk phụ "${type}"`, detail: `${len} bytes` });
    }

    offset += 12 + len;
    if (type === 'IEND' || len < 0) break;
  }
  return findings;
}

function scanJpegContainer(bytes, view) {
  const findings = [];
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
    if (marker === 0xda) break;

    const len = view.getUint16(offset + 2, false);
    if (marker === 0xeb) {
      findings.push({
        category: 'c2pa',
        label: 'C2PA / JUMBF Manifest (APP11)',
        detail: `${len.toLocaleString()} bytes — Khai báo chứng thực nguồn gốc tạo bởi AI`,
      });
    } else if (marker === 0xed) {
      const header = String.fromCharCode(...bytes.slice(offset + 4, offset + 18));
      if (header.startsWith('Photoshop 3.0')) {
        findings.push({ category: 'photoshop-irb', label: 'Photoshop IRB block (APP13)', detail: 'Chứa lịch sử biên tập, IPTC IIM' });
      }
    } else if (marker === 0xfe) {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(offset + 4, offset + 2 + len));
      if (/stable diffusion|midjourney|comfyui|dall-?e|novelai|c2pa/i.test(text)) {
        findings.push({ category: 'ai-prompt', label: 'AI signature trong JPEG comment (COM)', detail: text.slice(0, 100) });
      }
    }
    offset += 2 + len;
  }
  return findings;
}

function scanWebpContainer(bytes) {
  const findings = [];
  if (readChunkType(bytes, 0) !== 'RIFF' || readChunkType(bytes, 8) !== 'WEBP') return findings;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const fourcc = readChunkType(bytes, offset);
    const size = (bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] * 16777216)) >>> 0;
    const padded = size + (size & 1);

    if (offset + 8 + padded > bytes.length) break;

    const upper = fourcc.trim().toUpperCase();
    if (upper === 'EXIF') {
      findings.push({ category: 'exif', label: 'WEBP EXIF chunk', detail: `${size} bytes — Chứa thông tin máy chụp & vị trí` });
    } else if (upper === 'XMP') {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(offset + 8, Math.min(offset + 8 + size, offset + 300)));
      const isAI = /c2pa|openai|dall|midjourney|trainedalgorithmicmedia/i.test(text);
      findings.push({
        category: isAI ? 'c2pa' : 'xmp',
        label: isAI ? 'XMP AI Provenance trong WEBP' : 'WEBP XMP Metadata',
        detail: `${size} bytes`,
      });
    }

    offset += 8 + padded;
  }
  return findings;
}

export async function inspectImage(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf);
  const findings = [];

  try {
    const tags = await exifr.parse(buf, true);
    if (tags) findings.push(...tagsToFindings(tags));
  } catch {
    /* no parsable EXIF/XMP/IPTC/PNG-text metadata */
  }

  if (file.type === 'image/png') {
    findings.push(...scanPngContainer(bytes, view));
  } else if (file.type === 'image/jpeg') {
    findings.push(...scanJpegContainer(bytes, view));
  } else if (file.type === 'image/webp') {
    findings.push(...scanWebpContainer(bytes));
  }

  return { originalSize: file.size, findings };
}
