import { inspectImage } from './inspect.js';
import { cleanImage } from './clean.js';

const drop = document.getElementById('drop');
const fileInput = document.getElementById('fileInput');
const result = document.getElementById('result');
const thumb = document.getElementById('thumb');
const fname = document.getElementById('fname');
const sizeLine = document.getElementById('sizeLine');
const findingsEl = document.getElementById('findings');
const sizeAfter = document.getElementById('sizeAfter');
const downloadBtn = document.getElementById('downloadBtn');
const downloadBtnText = document.getElementById('downloadBtnText');
const statusEl = document.getElementById('status');
const modeOptSafe = document.getElementById('modeOptSafe');
const modeOptParanoid = document.getElementById('modeOptParanoid');

let currentFile = null;
let currentThumbUrl = null;

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
  'icc': 'ICC Profile',
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
    const noFindings = document.createElement('div');
    noFindings.className = 'cs-no-findings';
    noFindings.textContent = '✓ Ảnh sạch hoàn toàn: Không phát hiện thấy siêu dữ liệu ẩn nào.';
    findingsEl.appendChild(noFindings);
    return;
  }

  for (const f of findings) {
    const row = document.createElement('div');
    row.className = 'cs-finding-item';

    const badge = document.createElement('span');
    const categoryClass = ['c2pa', 'ai-prompt', 'iptc-ai-tag', 'gps', 'exif', 'icc'].includes(f.category)
      ? f.category
      : '';
    badge.className = `cs-badge ${categoryClass}`.trim();
    badge.textContent = CATEGORY_LABEL[f.category] || f.category;

    const contentDiv = document.createElement('div');
    const labelDiv = document.createElement('div');
    labelDiv.className = 'cs-finding-label';
    labelDiv.textContent = f.label;
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

function selectedMode() {
  const checked = document.querySelector('input[name="mode"]:checked');
  return checked ? checked.value : 'safe';
}

function setMode(mode) {
  const isSafe = mode === 'safe';
  modeOptSafe.classList.toggle('active', isSafe);
  modeOptParanoid.classList.toggle('active', !isSafe);
  const safeRadio = modeOptSafe.querySelector('input');
  const paranoidRadio = modeOptParanoid.querySelector('input');
  if (safeRadio) safeRadio.checked = isSafe;
  if (paranoidRadio) paranoidRadio.checked = !isSafe;
}

if (modeOptSafe) {
  modeOptSafe.addEventListener('click', () => setMode('safe'));
}
if (modeOptParanoid) {
  modeOptParanoid.addEventListener('click', () => setMode('paranoid'));
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
    const errorMsg = 'Định dạng không hỗ trợ. Chỉ nhận JPG, PNG, WEBP.';
    statusEl.textContent = errorMsg;
    showToast(errorMsg, 'error');
    return;
  }

  if (currentThumbUrl) {
    URL.revokeObjectURL(currentThumbUrl);
  }

  currentFile = file;
  downloadBtn.disabled = true;
  if (downloadBtnText) downloadBtnText.textContent = 'Xóa metadata & Tải ảnh về';
  statusEl.textContent = 'Đang phân tích metadata trong trình duyệt...';
  result.classList.add('show');

  currentThumbUrl = URL.createObjectURL(file);
  thumb.src = currentThumbUrl;
  fname.textContent = file.name;
  sizeLine.textContent = `Kích thước ban đầu: ${humanSize(file.size)} • Định dạng: ${file.type.replace('image/', '').toUpperCase()}`;
  sizeAfter.textContent = '—';
  findingsEl.innerHTML = '';

  try {
    const { findings } = await inspectImage(file);
    renderFindings(findings);
    statusEl.textContent = 'Phân tích hoàn tất. Chọn chế độ và bấm nút để tải ảnh sạch.';
    downloadBtn.disabled = false;
    showToast(`Đã nhận ảnh: ${file.name} (${findings.length} metadata)`, 'info');
  } catch (err) {
    console.error('Inspect error:', err);
    statusEl.textContent = 'Không thể đọc toàn bộ thẻ metadata, nhưng vẫn có thể làm sạch và tải về.';
    downloadBtn.disabled = false;
  }
}

if (downloadBtn) {
  downloadBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    const mode = selectedMode();
    downloadBtn.disabled = true;
    if (downloadBtnText) downloadBtnText.textContent = 'Đang xử lý trong RAM...';
    statusEl.textContent = `Đang loại bỏ metadata & re-encode theo chế độ ${mode.toUpperCase()}...`;

    try {
      const blob = await cleanImage(currentFile, mode);
      sizeAfter.textContent = `${humanSize(blob.size)} (${Math.round((blob.size / currentFile.size) * 100)}% dung lượng gốc)`;

      const dotIndex = currentFile.name.lastIndexOf('.');
      const base = dotIndex > 0 ? currentFile.name.slice(0, dotIndex) : currentFile.name;
      const ext = currentFile.type.split('/')[1] || 'jpg';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${base}-clean.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      statusEl.textContent = 'Hoàn tất! Ảnh đã được làm sạch và tải xuống máy của bạn.';
      if (downloadBtnText) downloadBtnText.textContent = 'Tải lại lần nữa';
      showToast('Đã xóa metadata và tải ảnh thành công!', 'success');
    } catch (err) {
      console.error('Clean error:', err);
      statusEl.textContent = 'Quá trình xử lý thất bại, vui lòng thử lại.';
      showToast('Có lỗi xảy ra khi xử lý ảnh', 'error');
    } finally {
      downloadBtn.disabled = false;
    }
  });
}
