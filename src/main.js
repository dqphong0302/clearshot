import { inspectImage } from './inspect.js';
import { cleanImage } from './clean.js';

const drop = document.getElementById('drop');
const fileInput = document.getElementById('fileInput');
const result = document.getElementById('result');
const thumb = document.getElementById('thumb');

// FileCard fields
const mName = document.getElementById('mName');
const mType = document.getElementById('mType');
const mDim = document.getElementById('mDim');
const mSize = document.getElementById('mSize');

// Verdict Banner
const verdict = document.getElementById('verdict');
const verdictIcon = document.getElementById('verdictIcon');
const verdictTitle = document.getElementById('verdictTitle');
const verdictText = document.getElementById('verdictText');

// Findings
const findingsEl = document.getElementById('findings');
const findingsCount = document.getElementById('findingsCount');

// Modes & Sub-options
const modeOptLossless = document.getElementById('modeOptLossless');
const modeOptSafe = document.getElementById('modeOptSafe');
const modeOptParanoid = document.getElementById('modeOptParanoid');
const reencodeOptions = document.getElementById('reencodeOptions');
const formatSelect = document.getElementById('formatSelect');
const qualityField = document.getElementById('qualityField');
const qualityRange = document.getElementById('qualityRange');
const qualityVal = document.getElementById('qualityVal');

// Actions
const downloadBtn = document.getElementById('downloadBtn');
const downloadBtnText = document.getElementById('downloadBtnText');
const doneNote = document.getElementById('doneNote');
const statusEl = document.getElementById('status');

let currentFile = null;
let currentThumbUrl = null;

const ICON_WARN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
const ICON_OK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>`;

function showToast(message, type = 'info') {
  if (window.PDUI && window.PDUI.Toast && typeof window.PDUI.Toast.show === 'function') {
    window.PDUI.Toast.show(message, type);
  }
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const CATEGORY_LABEL = {
  'c2pa': 'C2PA Manifest',
  'ai-prompt': 'AI Prompt / Graph',
  'iptc-ai-tag': 'IPTC AI Tag',
  'gps': 'Tọa độ GPS',
  'exif': 'Thông số EXIF',
  'device-serial': 'Serial thiết bị',
  'icc': 'Hồ sơ màu ICC',
  'xmp': 'XMP Metadata',
  'photoshop-irb': 'Photoshop IRB',
  'software': 'Phần mềm',
  'comment': 'Ghi chú',
  'text-chunk': 'Text Chunk',
  'unknown-chunk': 'Private Chunk',
};

function renderFindings(findings) {
  findingsEl.innerHTML = '';
  if (!findings || findings.length === 0) {
    if (findingsCount) findingsCount.textContent = '0 mục';
    const noFindings = document.createElement('div');
    noFindings.className = 'cs-no-findings';
    noFindings.textContent = '✓ Không tìm thấy siêu dữ liệu ẩn hoặc chữ ký AI trong file.';
    findingsEl.appendChild(noFindings);
    return;
  }

  if (findingsCount) findingsCount.textContent = `${findings.length} mục`;

  for (const f of findings) {
    const row = document.createElement('div');
    row.className = 'cs-finding-item';

    const isAI = ['c2pa', 'ai-prompt', 'iptc-ai-tag'].includes(f.category);
    const badge = document.createElement('span');
    badge.className = `cs-chip ${isAI ? 'chip-ai' : 'chip-meta'}`;
    badge.textContent = isAI ? 'AI' : 'META';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'cs-finding-text';

    const labelDiv = document.createElement('div');
    labelDiv.className = 'cs-finding-label';
    labelDiv.textContent = CATEGORY_LABEL[f.category] ? `${CATEGORY_LABEL[f.category]}: ${f.label}` : f.label;
    contentDiv.appendChild(labelDiv);

    if (f.detail) {
      const detailDiv = document.createElement('div');
      detailDiv.className = 'cs-finding-detail';
      detailDiv.textContent = f.detail;
      contentDiv.appendChild(detailDiv);
    }

    row.appendChild(badge);
    row.appendChild(contentDiv);
    findingsEl.appendChild(row);
  }
}

function updateVerdict(findings) {
  if (!verdict || !verdictIcon || !verdictTitle || !verdictText) return;

  const hasAI = findings && findings.some(f => ['c2pa', 'ai-prompt', 'iptc-ai-tag'].includes(f.category));
  const hasMeta = findings && findings.length > 0;

  if (hasAI) {
    verdict.className = 'cs-verdict detected';
    verdictIcon.innerHTML = ICON_WARN;
    verdictTitle.textContent = 'Phát hiện dấu vết AI trong ảnh';
    verdictText.textContent = 'File này chứa chữ ký C2PA Content Credentials hoặc prompt AI khai báo nguồn gốc tạo bởi máy học. Bạn có thể xóa sạch bên dưới.';
  } else if (hasMeta) {
    verdict.className = 'cs-verdict detected';
    verdictIcon.innerHTML = ICON_WARN;
    verdictTitle.textContent = 'Phát hiện metadata ẩn nhạy cảm';
    verdictText.textContent = 'Không thấy chữ ký AI, nhưng file mang theo siêu dữ liệu (EXIF máy ảnh, GPS, ICC, lịch sử sửa đổi) nên loại bỏ trước khi xuất bản.';
  } else {
    verdict.className = 'cs-verdict clean';
    verdictIcon.innerHTML = ICON_OK;
    verdictTitle.textContent = 'Sạch — Không thấy dấu vết nhạy cảm';
    verdictText.textContent = 'Không tìm thấy C2PA/EXIF/GPS nhạy cảm nào. Bạn vẫn có thể dùng chế độ Lossless hoặc Paranoid để bảo mật tối đa.';
  }
}

function selectedMode() {
  const checked = document.querySelector('input[name="mode"]:checked');
  return checked ? checked.value : 'lossless';
}

function updateModeUI(mode) {
  const isLossless = mode === 'lossless';
  const isSafe = mode === 'safe';
  const isParanoid = mode === 'paranoid';

  if (modeOptLossless) modeOptLossless.classList.toggle('active', isLossless);
  if (modeOptSafe) modeOptSafe.classList.toggle('active', isSafe);
  if (modeOptParanoid) modeOptParanoid.classList.toggle('active', isParanoid);

  const losslessRadio = modeOptLossless?.querySelector('input');
  const safeRadio = modeOptSafe?.querySelector('input');
  const paranoidRadio = modeOptParanoid?.querySelector('input');

  if (losslessRadio) losslessRadio.checked = isLossless;
  if (safeRadio) safeRadio.checked = isSafe;
  if (paranoidRadio) paranoidRadio.checked = isParanoid;

  if (reencodeOptions) {
    reencodeOptions.classList.toggle('show', !isLossless);
  }

  if (downloadBtnText) {
    if (isLossless) {
      downloadBtnText.textContent = 'Cắt metadata & Tải ảnh gốc sạch';
    } else if (isParanoid) {
      downloadBtnText.textContent = 'Khử dấu vân & Tải ảnh bảo mật';
    } else {
      downloadBtnText.textContent = 'Vẽ lại & Tải ảnh sạch';
    }
  }
}

if (modeOptLossless) {
  modeOptLossless.addEventListener('click', () => updateModeUI('lossless'));
}
if (modeOptSafe) {
  modeOptSafe.addEventListener('click', () => updateModeUI('safe'));
}
if (modeOptParanoid) {
  modeOptParanoid.addEventListener('click', () => updateModeUI('paranoid'));
}

// Format and Quality listeners
if (formatSelect && qualityField) {
  formatSelect.addEventListener('change', () => {
    const isPng = formatSelect.value === 'image/png';
    qualityField.style.display = isPng ? 'none' : 'flex';
  });
}

if (qualityRange && qualityVal) {
  qualityRange.addEventListener('input', () => {
    qualityVal.textContent = `${qualityRange.value}%`;
  });
}

// Drag and drop handlers
if (drop && fileInput) {
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('drag');
  });

  drop.addEventListener('dragleave', () => {
    drop.classList.remove('drag');
  });

  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('drag');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) {
      handleFile(fileInput.files[0]);
    }
  });
}

async function handleFile(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    const errorMsg = 'Định dạng không hỗ trợ. Vui lòng chọn JPG, PNG hoặc WEBP.';
    if (statusEl) statusEl.textContent = errorMsg;
    showToast(errorMsg, 'error');
    return;
  }

  if (currentThumbUrl) {
    URL.revokeObjectURL(currentThumbUrl);
  }

  currentFile = file;
  if (downloadBtn) downloadBtn.disabled = true;
  if (doneNote) {
    doneNote.textContent = '';
    doneNote.className = 'cs-result-note';
  }
  if (statusEl) statusEl.textContent = 'Đang phân tích cấu trúc nhị phân và siêu dữ liệu trong RAM...';
  result.classList.add('show');

  currentThumbUrl = URL.createObjectURL(file);
  thumb.src = currentThumbUrl;
  mName.textContent = file.name;
  mType.textContent = file.type.replace('image/', '').toUpperCase();
  mSize.textContent = humanSize(file.size);
  mDim.textContent = 'Đang đọc...';

  // Read dimensions from Image object
  const imgObj = new Image();
  imgObj.onload = () => {
    mDim.textContent = `${imgObj.naturalWidth} × ${imgObj.naturalHeight}`;
  };
  imgObj.src = currentThumbUrl;

  try {
    const { findings } = await inspectImage(file);
    renderFindings(findings);
    updateVerdict(findings);
    if (statusEl) statusEl.textContent = 'Phân tích hoàn tất. Chọn giải pháp xử lý rồi bấm tải ảnh về.';
    if (downloadBtn) downloadBtn.disabled = false;
    showToast(`Đã nạp ảnh: ${file.name} (${findings.length} mục)`, 'info');

    // Smooth scroll to result
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    console.error('Inspect error:', err);
    if (statusEl) statusEl.textContent = 'Không đọc được toàn bộ metadata, bạn vẫn có thể làm sạch và tải về.';
    if (downloadBtn) downloadBtn.disabled = false;
  }
}

if (downloadBtn) {
  downloadBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    const mode = selectedMode();
    const format = formatSelect ? formatSelect.value : 'original';
    const quality = qualityRange ? parseInt(qualityRange.value, 10) / 100 : 0.92;

    downloadBtn.disabled = true;
    if (downloadBtnText) downloadBtnText.textContent = 'Đang xử lý trong RAM...';
    if (doneNote) doneNote.textContent = 'Đang làm sạch điểm ảnh & đóng gói file...';

    try {
      const blob = await cleanImage(currentFile, { mode, format, quality });

      const diff = currentFile.size - blob.size;
      const dotIndex = currentFile.name.lastIndexOf('.');
      const base = dotIndex > 0 ? currentFile.name.slice(0, dotIndex) : currentFile.name;

      let ext = 'jpg';
      if (blob.type === 'image/png') ext = 'png';
      else if (blob.type === 'image/webp') ext = 'webp';
      else if (blob.type === 'image/jpeg') ext = 'jpg';

      const modeSuffix = mode === 'lossless' ? 'lossless' : mode === 'paranoid' ? 'paranoid' : 'clean';
      const cleanFileName = `${base}-${modeSuffix}.${ext}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cleanFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      if (doneNote) {
        doneNote.className = 'cs-result-note done';
        let noteMsg = `✓ Đã tải về · <b>${humanSize(blob.size)}</b>`;
        if (diff > 0) {
          noteMsg += ` (tiết kiệm <b>${humanSize(diff)}</b> metadata)`;
        }
        doneNote.innerHTML = noteMsg;
      }

      if (statusEl) statusEl.textContent = `File sạch đã sẵn sàng trên máy của bạn: ${cleanFileName}`;
      if (downloadBtnText) downloadBtnText.textContent = 'Tải lại lần nữa';
      showToast(`Đã xuất file sạch: ${cleanFileName}`, 'success');
    } catch (err) {
      console.error('Clean error:', err);
      if (statusEl) statusEl.textContent = 'Quá trình xử lý thất bại, vui lòng thử lại.';
      showToast('Có lỗi xảy ra khi xử lý ảnh', 'error');
    } finally {
      downloadBtn.disabled = false;
    }
  });
}
