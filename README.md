# Vgang Online

Game web 3D lái xe máy dạo phố về đêm, nhìn từ góc người lái. Thong thả chạy quanh khu phố, không điểm số, không thời gian.

Bản chơi: https://huynhnd53.github.io/vgang-online/

## Cách chơi

- **Máy tính:** W/↑ ga, S/↓/Space phanh, A D hoặc ← → lái, K nổ máy, H còi (giữ để bóp dài), Q E xi nhan,
  L đèn pha, M tắt tiếng. Kéo chuột để quay đầu nhìn quanh.
- **Điện thoại:** kéo nửa trái màn hình như cần điều khiển: đẩy lên là ga, kéo xuống là phanh, sang hai bên là lái.
  Vuốt nửa phải để nhìn. Các nút Còi, xi nhan, Đèn, Đề ở góc phải. Nên xoay ngang.
- Có thể bấm thẳng vào công tắc trên ảnh tay lái: đèn, còi, xi nhan, nút đề ⚡.
- Xi nhan tự tắt sau khi rẽ xong. Đứng yên giữ phanh để dắt lùi xe.

Quãng đường (đồng hồ km), vị trí, đèn và âm thanh được lưu trong `localStorage` của từng trình duyệt.

## Phát triển

```bash
npm install
npm run dev      # chạy thử tại http://localhost:5173
npm test         # kiểm thử vật lý xe và bố cục khu phố
npm run build    # build ra thư mục dist/
```

Cấu trúc:

- `src/sim/` — logic thuần: vật lý xe máy, bố cục khu phố (sinh ngẫu nhiên có seed cố định, gồm loại tầng trệt,
  cửa sổ từng tầng, mái hiên, biển hiệu). Có test trong `tests/`.
- `src/world/night/` — phố đêm bằng Three.js, không dùng ảnh hay model ngoài:
  - `surfaces.ts`, `facade.ts` — texture tự sinh (nhựa đường, gạch vỉa hè, bó vỉa, vữa tường cũ, cửa cuốn,
    cửa xếp, tiệm sáng đèn, cửa sổ chớp, ban công, lá cây, mái hiên, biển hiệu).
  - `houses.ts`, `streets.ts` — nhà ống theo tầng và gian, gờ tầng, ban công, mái hiên; đường, vạch sơn,
    cột đèn natri, cây, chậu cây, đèn giao thông, dây điện, hồ, công viên, quảng trường.
  - `lighting.ts` — hàng trăm nguồn sáng: các đèn gần nhất được tính trong shader của mọi vật liệu,
    vài đèn gần xe là SpotLight thật (đổ bóng, phản chiếu trên mặt đường ướt), cộng quầng sáng và vệt phản chiếu.
  - `post.ts` — bloom, tối viền, hạt phim.
- `src/cockpit/` — lớp tay lái: ảnh `public/assets/handlebar.webp` (được làm tối theo ánh đèn quanh xe),
  đồng hồ tốc độ vẽ đè lên mặt kính, vùng bấm công tắc.
- `src/audio/` — âm thanh tổng hợp bằng Web Audio (máy nổ, còi, xi nhan, va chạm), không cần file âm thanh.
- `src/input/`, `src/ui/` — điều khiển bàn phím/chuột/cảm ứng và bản đồ nhỏ.

### Chất lượng hình ảnh

Game tự chọn mức chất lượng (điện thoại và máy yếu: ít đèn hơn, không đổ bóng, không khử răng cưa) và tự giảm
độ phân giải khi khung hình tụt. Có thể ép bằng tham số `?quality=low` hoặc `?quality=high` trên địa chỉ trang.

### Thay asset

- Ảnh tay lái: `public/assets/handlebar.webp` (1672×940, nền trong suốt). Nếu đổi ảnh khác kích thước,
  sửa các hằng số `IMG_W`, `IMG_H`, `BAR_TOP`, `GAUGE` và `HOTSPOTS` trong `src/cockpit/cockpit.ts`.

## Phát hành

Workflow `.github/workflows/deploy.yml` tự build và đăng lên GitHub Pages mỗi khi có commit vào `main`
(Settings → Pages → Source: GitHub Actions).
