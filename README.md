# Vgang Online

Game web 3D lái xe máy dạo phố về đêm, nhìn từ góc người lái. Thong thả chạy quanh khu phố, không điểm số, không thời gian.

Bản chơi: https://huynhnd53.github.io/vgang-online/

## Cách chơi

- **Máy tính:** W/↑ ga, S/↓/Space phanh, A D hoặc ← → lái, K nổ máy, H còi (giữ để bóp dài), Q E xi nhan,
  L đèn pha, M tắt tiếng. Kéo chuột để quay đầu nhìn quanh.
- **Điện thoại:** kéo nửa trái màn hình như cần điều khiển: đẩy lên là ga, kéo xuống là phanh, sang hai bên là lái.
  Vuốt nửa phải để nhìn. Các nút Còi, xi nhan, Đèn, Đề ở góc phải. Nên xoay ngang.
- Có thể bấm thẳng vào công tắc trên ảnh tay lái: đèn, còi, xi nhan, nút đề ⚡.
- Khi vào game, chọn xe (đầu xe) và mặt đồng hồ; đổi lại bất cứ lúc nào bằng nút *Đổi xe*.
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
- `src/world/night/` — phố đêm, giữ đơn giản để chạy mượt:
  - `facade.ts`, `surfaces.ts` — texture tự sinh cho mặt tiền nhà, nhựa đường, gạch vỉa hè, bó vỉa, mái hiên.
  - `houses.ts` — nhà ống theo tầng và gian, ban công, mái hiên, biển hiệu, cửa sổ sáng đèn.
  - `bake.ts` — ánh đèn đường được tính sẵn một lần khi tải vào màu đỉnh, nên lúc chạy không cần tính ánh sáng.
  - `billboards.ts` — vẽ ảnh asset (cột đèn, đèn giao thông, ghế, bồn cây, cọc) thành tấm luôn quay về
    phía người lái, mỗi loại một lần vẽ.
  - `simpleCity.ts` — ghép tất cả: đường, vỉa hè, vạch sơn, nhà, đồ đường phố, hồ, công viên, đèn pha xe.
- `src/cockpit/gauges.ts` — các mặt đồng hồ. Thêm mặt mới: thêm một mục vào `GAUGE_THEMES` với hàm `draw` vẽ trong khung 480×220.
- `src/cockpit/` — lớp tay lái: ảnh `public/assets/handlebar.webp` (được làm tối theo ánh đèn quanh xe),
  đồng hồ tốc độ vẽ đè lên mặt kính, vùng bấm công tắc.
- `src/audio/` — âm thanh tổng hợp bằng Web Audio (máy nổ, còi, xi nhan, va chạm), không cần file âm thanh.
- `src/input/`, `src/ui/` — điều khiển bàn phím/chuột/cảm ứng và bản đồ nhỏ.

Game tự giảm độ phân giải khi khung hình tụt.

### Thêm đầu xe

Mỗi đầu xe là một mục trong `BIKES` ở `src/cockpit/bikes.ts` cộng một ảnh trong `public/assets/`.

Yêu cầu ảnh:
- PNG hoặc WebP **nền trong suốt**, góc nhìn của người lái, có cả hai tay cầm tay lái.
- Rộng khoảng 1600px trở lên; phần đầu xe nằm ở nửa dưới ảnh, tay lái tràn gần hết chiều ngang.
- Màn hình đồng hồ nên để trống hoặc tối (game vẽ đồng hồ chạy thật đè lên).

Cấu hình (toạ độ tính bằng pixel của ảnh): `barTop` (hàng đầu tiên có đầu xe), `gauge` (khung màn hình
đồng hồ) và `gaugeClip` (`'ellipse'` cho mặt bầu dục, `'rect'` cho màn LCD), `pivot` (điểm xoay khi lái),
`hotspots` (vị trí công tắc đèn, còi, xi nhan, nút đề), `face` (mặt đồng hồ mặc định).

### Đồ đường phố

- `public/assets/lamp.png`, `traffic-light.png`, `bench.png`, `planter.png`, `cone.png` (PNG nền
  trong suốt, đã cắt sát vật). Kích thước ngoài đời và điểm chạm đất của từng ảnh nằm ở đầu
  `src/world/night/simpleCity.ts` (`LAMP`, `TRAFFIC`, `BENCH`, `PLANTER`, `CONE`).

## Phát hành

Workflow `.github/workflows/deploy.yml` tự build và đăng lên GitHub Pages mỗi khi có commit vào `main`
(Settings → Pages → Source: GitHub Actions).
