# Vgang Online

Game web 3D thư giãn: bạn là nhân viên cửa hàng, đi làm nhận lương rồi mua nội thất trang trí căn nhà nhỏ của mình.
Thiết kế gameplay: [STORE_LIFE_GAMEPLAY_PLAN.md](STORE_LIFE_GAMEPLAY_PLAN.md).

Bản chơi: https://huynhnd53.github.io/vgang-online/ (sau khi bật GitHub Pages và merge vào `main`).

## Cách chơi

- **Cửa hàng:** đến máy chấm công để bắt đầu ca. Mỗi ca có 3 lượt khách, xong cả 3 nhận 60 tiền.
  Khách thiếu hàng sẽ đứng chờ: lấy hàng ở kho rồi đưa lên đúng kệ. Ở quầy, quét từng món rồi xác nhận thanh toán.
  Không có đồng hồ đếm ngược, không bị phạt khi chậm.
- **Nhà:** mở *Danh mục* để mua đồ (đèn trang trí 40, cây cảnh 60, bàn 120), mở *Đồ của tôi* để đặt đồ.
  Nhìn vào đồ đã đặt và tương tác để cất lại vào kho, đặt lại không mất tiền.
- **Máy tính:** WASD đi, chuột nhìn (nhấp vào màn hình để khóa chuột), E tương tác, V đổi góc nhìn, R xoay đồ, Q hủy.
- **Điện thoại:** kéo nửa trái để đi, vuốt nửa phải để nhìn, nút *Dùng* để tương tác. Nên xoay ngang.

Tiến độ (tiền, đồ, bố trí nhà, ca làm) lưu trong `localStorage` của từng trình duyệt; không đồng bộ giữa các thiết bị
và sẽ mất nếu xóa dữ liệu trình duyệt hoặc đổi địa chỉ trang.

## Phát triển

```bash
npm install
npm run dev      # chạy thử tại http://localhost:5173
npm test         # kiểm thử logic game
npm run build    # build ra thư mục dist/
```

Cấu trúc:

- `src/game/` — logic thuần (tiền, ca làm, mua/đặt đồ, lưu), có test trong `tests/`.
- `src/world/` — cảnh 3D Three.js: nhà, cửa hàng, nhân vật, khách, camera.
- `src/input/` — bàn phím/chuột và cảm ứng.
- `src/ui/` — giao diện HTML.

## Phát hành

Workflow `.github/workflows/deploy.yml` tự build và đăng lên GitHub Pages mỗi khi có commit vào `main`.
Cần bật một lần: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
