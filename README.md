# 🧹 ClearShot — Image Metadata Purge & Privacy Protection Tool

> UI nền tảng: **PhongDang UI (PDUI) v1.6.0** · profile `tool` · manifest tại `vendor/pdui/pdui-manifest.json`.

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-emerald.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![Platform](https://img.shields.io/badge/platform-Client--Side%20Web%20App-purple.svg)
![Design System](https://img.shields.io/badge/UI-PDUI%20v1.6.0-1e40af.svg)

**Ứng dụng loại bỏ siêu dữ liệu ẩn (Metadata), chứng thực C2PA, prompt AI và bảo vệ quyền riêng tư hình ảnh 100% trên trình duyệt.**

🌐 **Trải nghiệm trực tuyến:** [https://clearshot.phongdang.io.vn](https://clearshot.phongdang.io.vn)  
🏛️ **Hệ sinh thái:** [https://phongdang.io.vn](https://phongdang.io.vn) • [https://classtools.vn](https://classtools.vn)  
📦 **Kho mã nguồn:** [https://github.com/dqphong0302/clearshot](https://github.com/dqphong0302/clearshot)

</div>

---

## 🌟 Giới Thiệu & Sứ Mệnh

Khi bạn chụp một bức ảnh hoặc tạo một tác phẩm qua AI (Midjourney, DALL-E, ComfyUI, Stable Diffusion), các file ảnh thường chứa hàng chục thẻ dữ liệu ẩn nhạy cảm:
- 📍 **Tọa độ GPS chính xác** nơi bức ảnh được chụp.
- 📷 **Thông tin thiết bị**: Nhà sản xuất, model camera, số serial thân máy và ống kính.
- 🤖 **C2PA / Content Credentials**: Chữ ký số chứng thực nguồn gốc do AI hoặc phần mềm tạo ra.
- 💬 **AI Generation Prompt & Graph**: Toàn bộ câu lệnh prompt, tham số seed, workflow node JSON lồng trong PNG chunks / XMP.
- 🏷️ **IPTC & XMP**: Tên tác giả, bản quyền, phần mềm biên tập (Photoshop IRB, Lightroom).

**ClearShot** giải quyết triệt để bài toán này bằng cách phân tích và loại bỏ toàn bộ metadata, sau đó re-encode lại ảnh sạch sẽ trong bộ nhớ RAM trình duyệt mà **không bao giờ gửi dữ liệu lên bất kỳ máy chủ nào**.

---

## ✨ Tính Năng Nổi Bật

### 1. 🔒 Bảo Mật Tuyệt Đối (100% Client-Side Execution)
- Toàn bộ quá trình quét thẻ nhị phân (`exifr`) và tái tạo điểm ảnh (`Canvas 2D API`, `createImageBitmap`) diễn ra cục bộ trên máy người dùng.
- Hoạt động ngoại tuyến (Offline-ready), không phụ thuộc API bên thứ ba, không lưu cookie hay nhật ký.

### 2. 🛡️ Quét & Gỡ Bỏ Đa Dạng Các Loại Metadata
- **C2PA Manifest (caBX chunk / JUMBF)**: Khử nhãn AI provenance của OpenAI, Adobe, Google, Microsoft.
- **AI Prompt Chunks**: Phát hiện và làm sạch các thẻ `parameters`, `prompt`, `workflow`, `invokeai_metadata`, `dream`.
- **GPS & Thiết bị**: Xóa vĩ độ/kinh độ, Serial number, Camera Make/Model.
- **IPTC, ICC Profile & XMP**: Làm sạch thông tin bản quyền và cấu hình phần mềm chỉnh sửa.

### 3. ⚙️ Hai Chế Độ Làm Sạch Linh Hoạt
- **🛡️ Chế độ Safe (Mặc định)**: Tách toàn bộ metadata và re-encode ảnh chuẩn, bảo toàn 100% độ nét và chất lượng điểm ảnh thị giác.
- **⚡ Chế độ Paranoid (Khử Dấu Vân)**: Bổ sung nhiễu Gaussian vi mô ngẫu nhiên (Box-Muller transform) giúp xáo trộn bảng lượng tử hóa JPEG và triệt tiêu dấu vân nén encoder mà mắt thường không thể phân biệt.

### 4. 🎨 Chuẩn Thiết Kế PhongDang UI (PDUI v1.6.0)
- Tông màu chủ đạo Navy Blue (`#1e40af` / dark `#60a5fa`) sang trọng và hiện đại.
- Hỗ trợ chế độ Sáng / Tối (Light & Dark theme) mượt mà, đồng bộ với toàn hệ sinh thái qua `pd_theme`.
- Giao diện kéo thả trực quan, tối ưu cho mọi kích thước màn hình từ điện thoại di động đến máy tính để bàn.

---

## 🛠️ Công Nghệ Nền Tảng

- **Bundler / Tooling**: [Vite](https://vite.dev/) 8.x
- **Metadata Parsing**: [exifr](https://github.com/MikeKovarik/exifr)
- **Image Processing**: HTML5 Canvas API, `createImageBitmap`, Web Workers
- **UI Framework**: PhongDang UI Design System (PDUI v1.6.0)
- **Deployment Target**: Cloudflare Pages / Workers Static Assets

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Cục Bộ

### Yêu cầu môi trường:
- Node.js >= 18.0.0
- npm hoặc pnpm

### Các bước thực hiện:

```bash
# 1. Clone repository
git clone https://github.com/dqphong0302/clearshot.git
cd clearshot

# 2. Cài đặt dependencies
npm install

# 3. Khởi chạy dev server
npm run dev

# 4. Đóng gói bản phát hành production
npm run build

# 5. Xem trước bản build production
npm run preview
```

---

## 👨‍🏫 Tác Giả & Bản Quyền

- **Tác giả**: ThS. Đặng Quốc Phong (Quoc-Phong Dang, M.Sc.)
- **Đơn vị**: Giảng viên Bộ môn Tin học, Khoa Khoa học Cơ bản — Trường Đại học Y Dược TP. Hồ Chí Minh (UMP HCMC)
- **Website**: [phongdang.io.vn](https://phongdang.io.vn) • [classtools.vn](https://classtools.vn)
- **Email**: `dqphong@ump.edu.vn` • `dqphong0302@gmail.com`
- **Giấy phép**: Phát hành theo giấy phép [MIT License](LICENSE).
