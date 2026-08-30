const QUALITY_BY_MIME = {
  'image/jpeg': 0.92,
  'image/webp': 0.92,
  'image/png': undefined, // PNG is always lossless; quality is ignored
};

// Box-Muller gaussian noise, sigma in 0-255 levels. Imperceptible at sigma ~1.5,
// but perturbs the per-block statistics an encoder's quantization tables leave behind.
function addGaussianNoise(imageData, sigma) {
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

export async function cleanImage(file, mode = 'safe') {
  if (!QUALITY_BY_MIME.hasOwnProperty(file.type)) {
    throw new Error('UNSUPPORTED_TYPE');
  }

  // imageOrientation: 'from-image' bakes EXIF rotation into the decoded pixels,
  // so the orientation tag (which we're about to strip) is no longer needed.
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

  const quality = QUALITY_BY_MIME[file.type];
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('ENCODE_FAILED'))),
      file.type,
      quality
    );
  });

  return blob;
}
