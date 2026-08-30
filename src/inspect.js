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
    findings.push({ category: 'icc', label: 'ICC color profile embedded' });
  }

  if (tags.latitude !== undefined || tags.GPSLatitude !== undefined) {
    findings.push({ category: 'gps', label: 'GPS location embedded in EXIF', detail: 'Latitude/longitude present' });
  }
  if (tags.Make || tags.Model) {
    findings.push({ category: 'exif', label: `Camera/device: ${[tags.Make, tags.Model].filter(Boolean).join(' ')}` });
  }
  if (tags.Software) {
    findings.push({ category: 'software', label: `Software tag: "${String(tags.Software).slice(0, 60)}"` });
  }
  if (tags.UserComment) {
    findings.push({ category: 'comment', label: 'UserComment present' });
  }
  if (tags.BodySerialNumber || tags.LensSerialNumber || tags.SerialNumber) {
    findings.push({ category: 'device-serial', label: 'Device/lens serial number present' });
  }
  if (tags.DigitalSourceType) {
    const val = String(tags.DigitalSourceType);
    findings.push({
      category: 'iptc-ai-tag',
      label: `IPTC DigitalSourceType: ${val}`,
      detail: /trainedAlgorithmicMedia|composite/i.test(val) ? 'Explicit "this is AI-generated" IPTC tag' : undefined,
    });
  }
  if (tags.ImageDescription || tags.Description) {
    const text = String(tags.ImageDescription || tags.Description);
    if (/--ar |--v \d|--stylize|midjourney/i.test(text)) {
      findings.push({ category: 'ai-prompt', label: 'Midjourney prompt (Description field)' });
    } else {
      findings.push({ category: 'comment', label: `Description: "${text.slice(0, 60)}"` });
    }
  }

  for (const [key, label] of Object.entries(AI_TEXT_KEYS)) {
    if (tags[key] !== undefined) {
      findings.push({ category: 'ai-prompt', label, detail: 'Embedded PNG text chunk' });
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
        detail: `${len.toLocaleString()} bytes — declares AI/tool provenance (OpenAI, Adobe, Google, etc.)`,
      });
    } else if (!PNG_CRITICAL.has(type) && !PNG_KNOWN_ANCILLARY.has(type)) {
      findings.push({ category: 'unknown-chunk', label: `Unrecognized private chunk "${type}"`, detail: `${len} bytes` });
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
        label: 'C2PA / JUMBF manifest (APP11)',
        detail: `${len.toLocaleString()} bytes — declares AI/tool provenance`,
      });
    } else if (marker === 0xed) {
      const header = String.fromCharCode(...bytes.slice(offset + 4, offset + 18));
      if (header.startsWith('Photoshop 3.0')) {
        findings.push({ category: 'photoshop-irb', label: 'Photoshop IRB block (APP13)', detail: 'May contain IPTC IIM, edit history' });
      }
    } else if (marker === 0xfe) {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(offset + 4, offset + 2 + len));
      if (/stable diffusion|midjourney|comfyui|dall-?e|novelai/i.test(text)) {
        findings.push({ category: 'ai-prompt', label: 'AI tool signature in JPEG comment', detail: text.slice(0, 80) });
      }
    }
    offset += 2 + len;
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
  }

  return { originalSize: file.size, findings };
}
