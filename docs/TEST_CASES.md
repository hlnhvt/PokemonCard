# PokeScan AR — Danh sách Test Case

Phạm vi: toàn bộ ứng dụng (quét thẻ bằng camera/ảnh, OCR, tải dữ liệu online, video showcase, chi tiết thẻ, bộ sưu tập LocalStorage, âm thanh).

Ký hiệu:
- **Ưu tiên**: P1 (chặn luồng chính / sai dữ liệu) · P2 (sai chức năng phụ) · P3 (giao diện / trải nghiệm)
- **Loại**: `AUTO` = có test tự động trong `src/**/*.test.*` · `LIVE` = test gọi API thật (`npm run test:live`) · `MANUAL` = cần thiết bị thật (camera, điện thoại)
- **Kết quả**: kết quả sau vòng fix (xem mục cuối)

---

## 1. Lưu trữ LocalStorage (`src/utils/storage.js`)

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| ST-01 | P1 | AUTO | Storage rỗng → `getSavedCollection()` | Trả `[]` |
| ST-02 | P1 | AUTO | Lưu thẻ mới | `scanCount=1`, có `firstScannedAt`, `lastScannedAt`, `isFavorite=false`, thẻ nằm đầu danh sách |
| ST-03 | P1 | AUTO | Lưu lại thẻ đã có | `scanCount` +1, giữ `firstScannedAt` và `isFavorite`, không tạo bản ghi trùng |
| ST-04 | P2 | AUTO | Lưu thẻ `null` / không có `id` | Trả `null`, storage không đổi |
| ST-05 | P1 | AUTO | Dữ liệu storage là JSON hỏng | Trả `[]`, không crash |
| ST-06 | P1 | AUTO | Dữ liệu storage là JSON hợp lệ nhưng không phải mảng (vd `{}`), hoặc phần tử thiếu `id`/`name` | Trả mảng chỉ gồm phần tử hợp lệ, UI không crash |
| ST-07 | P2 | AUTO | Bật/tắt yêu thích | Đảo `isFavorite` đúng thẻ, lưu xuống storage |
| ST-08 | P2 | AUTO | `setItem` ném lỗi (hết quota / Safari private) khi bật yêu thích hoặc xoá | Trả lại danh sách hiện có (không xoá trắng UI) |
| ST-09 | P2 | AUTO | Xoá 1 thẻ | Chỉ thẻ đó bị xoá |
| ST-10 | P2 | AUTO | Xoá toàn bộ | Storage bị xoá key, trả `[]` |
| ST-11 | P2 | AUTO | `saveCardToPokedex` khi `setItem` lỗi | Trả `null` (UI phải báo không lưu được) |

## 2. Dịch vụ online (`src/services/pokemonOnlineService.js`)

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| SV-01 | P1 | AUTO | `normalizePokemonQuery`: "Pikachu ", "MR. MIME", "Ho-Oh", "porygon z", "Farfetch'd", "Nidoran♀", "25" | `pikachu`, `mr-mime`, `ho-oh`, `porygon-z`, `farfetchd`, `nidoran-f`, `25` |
| SV-02 | P1 | AUTO | Chuỗi rỗng / chỉ khoảng trắng / chỉ ký tự đặc biệt | Ném lỗi "Vui lòng nhập tên Pokémon", không gọi mạng |
| SV-03 | P1 | AUTO | Fetch thành công (mock) | Object đủ trường: `id, name, pokedexNumber, types, hp, themeColor, weakness, resistance, retreatCost, attacks, image, fallbackImage, lore` |
| SV-04 | P1 | AUTO | `/pokemon/{name}` trả 404 nhưng species tồn tại (vd `giratina`) | Lấy variety mặc định (`giratina-altered`) và trả dữ liệu |
| SV-05 | P1 | AUTO | Cả pokemon và species đều 404 | Ném lỗi "Không tìm thấy dữ liệu online..." |
| SV-06 | P2 | AUTO | Species lỗi mạng | Vẫn trả dữ liệu với lore/genus mặc định |
| SV-07 | P2 | AUTO | TCG API lỗi 500 / treo | Vẫn trả dữ liệu, dùng official artwork, có timeout (không treo vô hạn) |
| SV-08 | P2 | AUTO | Tên tiếng Nhật: ưu tiên `ja-Hrkt`/`ja` trước `roomaji` | `japaneseName` là chữ Nhật |
| SV-09 | P2 | AUTO | Species dùng URL từ `poke.species.url` (form có id > 10000) | Không gọi `/pokemon-species/10xxx` |
| SV-10 | P2 | AUTO | Tra bằng số (`25`) | Video/TCG tra theo tên thật (`pikachu`), không theo `25` |
| SV-11 | P2 | AUTO | Pokémon không có sprite official-artwork | `image`/`fallbackImage` dùng sprite thường, không `undefined` crash |
| SV-12 | P1 | AUTO | `getAllPokemonNames` lỗi mạng | Trả danh sách dự phòng nhưng **không cache vĩnh viễn**; lần sau gọi lại mạng |
| SV-13 | P1 | AUTO | `getAllPokemonNames` thành công | Dùng danh sách species (tên gốc: `giratina`, `ho-oh`, không phải `giratina-altered`), cache lại |
| SV-14 | P1 | AUTO | Gợi ý từ **tên file** khớp chính xác: `pikachu_card.png`, `Charizard-VMAX.jpg` | Trả `pikachu`, `charizard` |
| SV-15 | P1 | AUTO | Tên file không liên quan: `anh the bai.png`, `hinh.jpg`, `cat.jpg`, `pic_01.jpg`, `mon.png`, `the best.jpg`, `IMG_2024.jpg` | Trả `null` (để chạy OCR), **không** đoán bừa carvanha/shinx/caterpie/pichu… |
| SV-16 | P2 | LIVE | Gọi PokeAPI thật: `Mr. Mime`, `Ho-Oh`, `giratina`, `25`, `porygon z` | Đều trả dữ liệu hợp lệ |

## 3. Nhận diện OCR (`src/utils/cardRecognizer.js`)

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| OC-01 | P2 | AUTO | `stringSimilarity` giống hệt / khác hẳn / chuỗi ngắn / null | 1 / ~0 / 0 / không crash |
| OC-02 | P1 | AUTO | Text OCR "Charizard HP 330" | Ứng viên đầu = `charizard` điểm 100 |
| OC-03 | P1 | AUTO | Text OCR lỗi chính tả "PIKACHO" / "CHARIZAPD" | Ứng viên đầu = `pikachu` / `charizard` |
| OC-04 | P1 | AUTO | Thẻ Stage 1/2: "STAGE 1 Evolves from Charmander Charmeleon HP 90" | Ứng viên đầu = `charmeleon` (không phải `charmander`) |
| OC-05 | P2 | AUTO | Chỉ có stop word ("BASIC TRAINER ENERGY") hoặc số | Không có ứng viên |
| OC-06 | P2 | AUTO | Tên có gạch "HO-OH" | Ứng viên `ho-oh` |
| OC-07 | P2 | AUTO | Tối đa 4 ứng viên, sắp xếp giảm dần theo điểm | Đúng |
| OC-08 | P1 | AUTO | Tesseract/canvas lỗi | `recognizeCardWithOCR` trả `success:false`, `candidates:[]`, không ném lỗi |
| OC-09 | P2 | AUTO | Quét lần 2 sau khi ScannerModal unmount/mount lại | Callback tiến độ gọi về lần quét hiện tại (không kẹt ở 35%) |
| OC-10 | P2 | AUTO | Gọi OCR 2 lần đồng thời | Chỉ tạo 1 worker Tesseract |
| OC-11 | P1 | MANUAL | Chụp thẻ thật (sáng/tối, nghiêng nhẹ) | Tên đúng nằm trong 4 gợi ý |

## 4. Màn hình quét (`src/components/ScannerModal.jsx`)

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| SC-01 | P1 | AUTO | Trình duyệt không hỗ trợ `getUserMedia` | Hiện fallback + nội dung lỗi thực tế (không luôn nói "yêu cầu HTTPS") |
| SC-02 | P1 | AUTO | Người dùng từ chối quyền camera | Hiện thông báo "QUYỀN TRUY CẬP…" |
| SC-03 | P1 | AUTO | Rời tab quét khi `getUserMedia` chưa trả về | Stream trả về sau đó bị `stop()` ngay (camera không bị bật ngầm) |
| SC-04 | P1 | AUTO | Camera mở thành công → unmount | Mọi track bị stop |
| SC-05 | P2 | AUTO | Chụp khi video chưa sẵn sàng (`videoWidth=0`) | Không chạy OCR trên khung đen, hiện thông báo chờ |
| SC-06 | P1 | AUTO | Upload ảnh tên `pikachu.png` | Ô xác nhận hiện `pikachu` |
| SC-07 | P1 | AUTO | Upload ảnh tên `anh the bai.png` | Chạy OCR (không bỏ qua bằng gợi ý tên file sai) |
| SC-08 | P2 | AUTO | Chọn lại **cùng một file** lần 2 | Vẫn xử lý (input được reset) |
| SC-09 | P2 | AUTO | File không phải ảnh / ảnh hỏng | Hiện thông báo lỗi, không kẹt trạng thái |
| SC-10 | P1 | AUTO | OCR không ra ứng viên | Mở ô nhập tay, **không** tự điền `pikachu` giả |
| SC-11 | P1 | AUTO | Xoá hết chữ trong ô xác nhận | Ô xác nhận vẫn mở để gõ lại |
| SC-12 | P1 | AUTO | Bấm "Tải Dữ Liệu Online" → thành công | Gọi `onCardDetected` 1 lần với dữ liệu |
| SC-13 | P1 | AUTO | Tải online thất bại | Hiện thông báo lỗi, nút bật lại |
| SC-14 | P1 | AUTO | Đang tải online, bấm thẻ mẫu / Enter liên tục | Không gửi thêm request, `onCardDetected` chỉ 1 lần |
| SC-15 | P2 | AUTO | Nhập tay + Enter ô tìm kiếm | Gọi fetch với tên đã nhập |
| SC-16 | P2 | AUTO | Nút "Tải" khi ô trống | Disabled |
| SC-17 | P2 | AUTO | Bấm chip gợi ý | Tên trong ô đổi theo chip, chip được highlight |
| SC-18 | P2 | AUTO | Nút "Hủy" | Đóng ô xác nhận |
| SC-19 | P1 | MANUAL | Điện thoại qua HTTP IP LAN | Nút "Chụp Bằng Camera Điện Thoại" mở camera gốc |
| SC-20 | P2 | MANUAL | Đổi camera trước/sau liên tục | Không rò rỉ stream, không màn đen |

## 5. Video Showcase (`src/components/VideoShowcase.jsx`)

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| VS-01 | P1 | AUTO | Để tự chạy hết thời lượng | `onComplete` gọi **đúng 1 lần** (kể cả StrictMode) |
| VS-02 | P1 | AUTO | Bấm "Bỏ qua" rồi hết giờ | `onComplete` chỉ 1 lần |
| VS-03 | P1 | AUTO | Video `ended` + hết giờ + bấm nút | `onComplete` chỉ 1 lần |
| VS-04 | P2 | AUTO | Tạm dừng tự chuyển | Tiến độ dừng, không gọi `onComplete` |
| VS-05 | P2 | AUTO | Video lỗi | Chuyển sang animation fallback hiển thị artwork |
| VS-06 | P2 | AUTO | Trình duyệt chặn autoplay có tiếng | Thử lại ở chế độ muted thay vì bỏ video |
| VS-07 | P3 | AUTO | Hiển thị link "Xem trên YouTube" khi có `youtubeSearchUrl` | Có link mở tab mới, `rel="noreferrer"` |

## 6. Chi tiết thẻ (`src/components/PokemonCardDetail.jsx`)

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| DT-01 | P1 | AUTO | Render thẻ đầy đủ | Hiện tên, HP, hệ, chiêu, điểm yếu, lore |
| DT-02 | P1 | AUTO | Thẻ cũ trong storage thiếu `themeColor`/`weakness`/`resistance`/`attacks`/`types` | Không crash |
| DT-03 | P2 | AUTO | `retreatCost` âm / NaN / thiếu | Không ném `RangeError` |
| DT-04 | P2 | AUTO | Chia sẻ khi không có `navigator.share` và không có `navigator.clipboard` (HTTP) | Không crash |
| DT-05 | P2 | AUTO | Chia sẻ khi có clipboard | Ghi clipboard, hiện "Đã sao chép!" |
| DT-06 | P2 | AUTO | Hệ `Dark`, `Grass`, `Ice`… | Có màu badge riêng (không rơi về xám) |
| DT-07 | P1 | AUTO | Lưu storage thất bại (`savedItem=null` sau khi quét) | Hiện cảnh báo không lưu được thay vì "LƯU THÀNH CÔNG" |
| DT-08 | P2 | AUTO | Ảnh TCG lỗi | Đổi sang `fallbackImage` |
| DT-09 | P2 | AUTO | Các nút: Xem lại video, Bộ sưu tập, Quét tiếp | Gọi đúng callback |

## 7. Bộ sưu tập (`src/components/PokedexCollection.jsx`)

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| CO-01 | P2 | AUTO | Bộ sưu tập rỗng | Hiện hướng dẫn "Hãy dùng Camera…" |
| CO-02 | P2 | AUTO | Tìm theo tên (không phân biệt hoa thường) | Lọc đúng |
| CO-03 | P1 | AUTO | Tìm "#006" (như placeholder gợi ý) và "006" | Đều ra Charizard |
| CO-04 | P1 | AUTO | Bộ lọc hệ lấy từ dữ liệu thực tế (Dark, Grass, Ghost…) | Có nút lọc tương ứng và lọc đúng |
| CO-05 | P2 | AUTO | Lọc chỉ yêu thích | Chỉ hiện thẻ yêu thích |
| CO-06 | P2 | AUTO | Bấm sao | Đảo trạng thái, không mở chi tiết |
| CO-07 | P2 | AUTO | Xoá thẻ → confirm OK / Cancel | Xoá / giữ nguyên, không mở chi tiết |
| CO-08 | P2 | AUTO | Xoá tất cả → confirm | Danh sách rỗng |
| CO-09 | P2 | AUTO | Thống kê: số thẻ, tổng lượt quét, số yêu thích | Tính đúng |
| CO-10 | P2 | AUTO | Nút Video trên thẻ | Gọi `onReplayVideo(card)`, không mở chi tiết |
| CO-11 | P3 | AUTO | Không tìm thấy kết quả | Hiện "Không tìm thấy…" |

## 8. Luồng tích hợp (`src/App.jsx`)

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| AP-01 | P1 | AUTO | Nhập tên → Tải → Video → Bỏ qua | Chuyển sang chi tiết, lưu 1 thẻ, `scanCount=1`, badge header = 1 |
| AP-02 | P1 | AUTO | Ở chi tiết bấm "Xem lại Video" rồi bỏ qua | `scanCount` **giữ nguyên** (xem lại không tính là quét) |
| AP-03 | P1 | AUTO | Từ bộ sưu tập bấm "Video" rồi bỏ qua | `scanCount` giữ nguyên, mở chi tiết thẻ đó |
| AP-04 | P1 | AUTO | Quét lại cùng Pokémon | `scanCount=2`, vẫn 1 thẻ |
| AP-05 | P2 | AUTO | Điều hướng tab Quét ↔ Bộ sưu tập ↔ Chi tiết | Hiển thị đúng màn hình |
| AP-06 | P2 | AUTO | Bật/tắt âm thanh | Icon đổi, `sounds.muted` đổi theo |
| AP-07 | P1 | AUTO | Mở app khi storage có dữ liệu | Badge hiện đúng số thẻ |

## 9. Build & chất lượng mã

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| BQ-01 | P1 | AUTO | `npm run build` | Build thành công |
| BQ-02 | P2 | AUTO | `npm run lint` | Không có key trùng, không import thừa |
| BQ-03 | P3 | AUTO | Class Tailwind không tồn tại (`animate-fadeIn`, `py-0.2`) | Được định nghĩa / sửa |

---

## 10. Kết quả thực thi (2026-09-25)

| Bộ test | Lệnh | Kết quả |
|---|---|---|
| Unit + component + tích hợp | `npm test` | **138/138 pass** (8 file) |
| Live PokeAPI (SV-16) | `npm run test:live` | **9/9 pass** |
| Build | `npm run build` | Pass |
| Lint | `npm run lint` | Còn 1 warning `set-state-in-effect` (khởi động camera trong effect — đồng bộ với hệ thống ngoài, chấp nhận được) |
| Hồi quy: chạy cùng bộ test trên code trước khi sửa | — | 39 fail (xem ghi chú) |

Ghi chú về chạy hồi quy: các fail ở `storage`, `VideoShowcase`, `PokedexCollection`, `PokemonCardDetail` phản ánh lỗi thật. Các fail ở `ScannerModal` và `App` trên code cũ một phần do test dùng `aria-label`/hàm export mới được thêm khi sửa, nên không dùng làm bằng chứng.

Test **MANUAL** (OC-11, SC-19, SC-20) **chưa thực hiện** — cần điện thoại và thẻ thật.

### Lỗi đã phát hiện và sửa

| # | Mức | Lỗi | Test |
|---|---|---|---|
| 1 | P1 | Gợi ý theo tên file bỏ qua OCR và trả Pokémon sai: `anh the bai.png`→carvanha, `hinh.jpg`→shinx, `cat.jpg`→caterpie, `pic_01.jpg`→pichu | SV-14/15, SC-07 |
| 2 | P1 | Chuẩn hoá tên xoá dấu gạch → 404 với 76/1025 Pokémon (`ho-oh`, `mr-mime`, `porygon-z`, `tapu-koko`…) | SV-01, SV-16 |
| 3 | P1 | Tên species nhiều dạng (`giratina`, `deoxys`…) trả 404 — thiếu fallback sang variety mặc định | SV-04, SV-16 |
| 4 | P1 | Xem lại video (từ chi tiết hoặc bộ sưu tập) bị tính thêm 1 lượt quét | AP-02, AP-03 |
| 5 | P1 | `onComplete` của video có thể chạy 2 lần (side-effect trong state updater + setTimeout không huỷ) → lưu trùng, `scanCount` tăng 2 | VS-01..03 |
| 6 | P1 | Camera bị rò rỉ (vẫn bật) khi rời tab trong lúc `getUserMedia` chưa trả về, hoặc StrictMode gọi 2 lần | SC-03 |
| 7 | P1 | OCR lỗi → tự điền `pikachu` giả | SC-10b |
| 8 | P1 | Xoá hết chữ trong ô xác nhận làm đóng luôn ô | SC-11 |
| 9 | P1 | Có thể gửi nhiều request cùng lúc (thẻ mẫu không disable, Enter liên tục) | SC-14 |
| 10 | P1 | Dữ liệu LocalStorage không phải mảng / phần tử hỏng làm crash bộ sưu tập; thẻ thiếu trường làm crash trang chi tiết | ST-06, DT-02 |
| 11 | P1 | Lưu thất bại (Safari ẩn danh / đầy bộ nhớ) vẫn báo "LƯU THÀNH CÔNG"; lỗi ghi khi bật yêu thích/xoá làm UI trống trơn | DT-07, ST-08 |
| 12 | P1 | Tìm "#006" (theo placeholder gợi ý) không ra kết quả | CO-03 |
| 13 | P1 | Bộ lọc hệ cố định có `DARKNESS` trong khi PokeAPI trả `Dark`, thiếu Grass/Ghost/Ice… | CO-04 |
| 14 | P1 | Thẻ Stage 1/2: OCR chọn tên ở dòng "Evolves from X" thay vì tên thẻ | OC-04 |
| 15 | P2 | Callback tiến độ OCR bị gắn cố định với lần quét đầu → thanh tiến độ kẹt ở 35% từ lần quét sau khi đổi tab | OC-09 |
| 16 | P2 | Gọi OCR đồng thời tạo nhiều worker Tesseract; worker lỗi khởi tạo không thử lại | OC-08, OC-10 |
| 17 | P2 | Danh sách tên dự phòng khi mất mạng bị cache vĩnh viễn (không bao giờ tải lại danh sách 1025 tên) | SV-12 |
| 18 | P2 | Không có timeout cho TCG API (đang trả 500 / có thể treo) | SV-07b |
| 19 | P2 | Tra bằng số (`25`) thì video/YouTube/TCG tra theo `"25"` thay vì `pikachu` | SV-10 |
| 20 | P2 | Tên tiếng Nhật lấy romaji thay vì chữ Nhật; species của form (id > 10000) gọi sai URL | SV-08, SV-09 |
| 21 | P2 | Chia sẻ trên HTTP (không có `navigator.clipboard`) ném lỗi | DT-04 |
| 22 | P2 | `'★'.repeat()` ném `RangeError` khi `retreatCost` âm | DT-03 |
| 23 | P2 | Trình duyệt chặn autoplay có tiếng → bỏ luôn video thay vì phát không tiếng | VS-06 |
| 24 | P2 | Chọn lại cùng 1 file không có phản hồi; file hỏng/không phải ảnh không báo lỗi; chụp khi camera chưa có khung hình → OCR ảnh đen | SC-05, SC-08, SC-09 |
| 25 | P2 | Màn fallback camera luôn nói "yêu cầu HTTPS", không hiện lỗi thật (`cameraError` không được hiển thị) | SC-01, SC-02 |
| 26 | P3 | Key `gengar` bị trùng; ~30 import thừa; class `animate-fadeIn`, `py-0.2` không tồn tại; lỗi chính tả `infernappe` trong danh sách dự phòng | BQ-02, BQ-03 |

### Vấn đề còn tồn tại (chưa sửa — cần quyết định)

1. **Video showcase không phải video Pokémon**: `DIRECT_VIDEOS` trỏ tới video mẫu của Google (quảng cáo ô tô Subaru, phim Blender "Tears of Steel"…) nhưng code ghi chú là "battle clips".
2. **ID YouTube trong `CURATED_YOUTUBE_VIDEOS` chưa được kiểm chứng** là video thật / đúng Pokémon.
3. **Dữ liệu "TCG" là dữ liệu suy diễn**: HP = base HP × 3, sát thương chiêu, độ hiếm (theo id > 150), kháng cự "Colorless -30" đều được tính ra, không phải từ thẻ thật, nhưng giao diện trình bày như thông số thẻ.
4. Header dùng breakpoint `xs:` không được khai báo → logo chữ bị ẩn trên điện thoại (< 640px).
5. SC-08 trong jsdom chỉ kiểm được `input.value` rỗng sau khi chọn; cần xác nhận thủ công trên trình duyệt thật.

---

## 11. Đánh giá độ chính xác OCR với ảnh thẻ thật (2026-09-25)

Công cụ: `tests/ocr-eval/` chạy **đúng pipeline của app** (Tesseract.js + xử lý canvas) trên Node với ảnh scan thẻ thật từ `images.pokemontcg.io`, đáp án lấy từ `PokemonTCG/pokemon-tcg-data`.

```bash
node tests/ocr-eval/build-dataset.mjs                      # tập tinh chỉnh (tải ảnh 1 lần, ~45MB, gitignored)
OCR_SETS=holdout node tests/ocr-eval/build-dataset.mjs     # tập held-out
npm run eval:ocr                                           # OCR_MANIFEST=manifest.holdout.json để đổi tập
```

Mỗi thẻ được thử 3 biến thể (tạo tất định bằng seed):
- **scan**: ảnh thẻ sạch (người dùng tải ảnh thẻ lên)
- **photo**: thẻ đặt trên nền có vân, nghiêng ±5°, mờ, nhiễu, lóa sáng; ảnh 900×1200 (ảnh điện thoại tải lên)
- **camera**: khung hình 720×1280, thẻ nằm trong khung ngắm, nghiêng ±3°, mờ, nhiễu

| Tập (mỗi tập 60 thẻ, 12 bộ từ 1999 đến 2024) | Vai trò | Biến thể | Code gốc | Pipeline mới |
|---|---|---|---|---|
| `manifest.json` | dùng để tinh chỉnh | scan / photo / camera | 68% / 67% / 23% | **92% / 87% / 90%** |
| `manifest.holdout.json` | kiểm tra; các ca sai của nó đã được dùng để sửa 3 lỗi chấm điểm | scan / photo / camera | 77% / 67% / 20% | **98% / 92% / 93%** |
| `manifest.fresh.json` | **không dùng để tinh chỉnh**, số liệu đáng tin nhất | scan / photo / camera | 70% / 65% / 28% | **88% / 82% / 92%** |

Số liệu là tỉ lệ top-1 (ứng viên đầu tiên đúng). Thời gian khoảng 200–340 ms/ảnh trên Node desktop. Tốc độ trên điện thoại chưa đo.

Giới hạn của phép đo:
- Ảnh "photo/camera" là **ảnh giả lập** từ bản scan, không phải ảnh chụp thật. Chưa mô phỏng: phối cảnh 3D, lóa foil/holo mạnh, rung tay, ánh sáng vàng. Độ chính xác trên ảnh chụp thật **chưa được đo**.
- Kích thước mẫu 60 thẻ/tập: mỗi thẻ tương ứng khoảng 1,7 điểm %.

Các kiểu lỗi còn lại: font tên cách điệu trên thẻ V/VMAX/holo, tên rất ngắn bị đọc thiếu (`Lugia`, `Azelf`), ký hiệu ♂/♀ (`Nidoran♂` lẫn với `Nidoran♀`), thẻ mà tên chính không đọc được và chỉ còn đọc được dòng "Evolves from X".

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| OC-12 | P1 | AUTO | `detectCard` trên thẻ đặt trên nền, thẻ nghiêng 6°, thẻ lấp đầy ảnh, ảnh trơn | Đúng khung thẻ / đúng góc ±1° / `null` / `null` |
| OC-13 | P1 | AUTO | `extractCard` cắt và nắn thẳng thẻ nghiêng | Tỉ lệ khung ≈ 88:63 |
| OC-14 | P2 | AUTO | `preprocess` 'binary' với chữ sáng trên nền tối | Đảo thành chữ đen trên nền trắng |
| OC-15 | P1 | AUTO | `mapRectToVideoFrame` với `object-fit: cover` và lề | Đúng toạ độ khung video |
| SC-21 | P1 | AUTO | Chụp camera | Chỉ vùng khung ngắm (+6% lề) được gửi vào OCR |
| OC-16 | P1 | EVAL | `npm run eval:ocr` trên 3 tập | Không thấp hơn bảng trên |
---

## 12. Tính năng tương tác đợt 1 & giao diện (2026-09-25)

Đối tượng: trẻ em. Minigame là phần thêm, việc lưu thẻ vào Pokédex vẫn tự động như trước.

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| CR-01..04 | P1 | AUTO | Tiếng kêu thật: trình duyệt không hỗ trợ Ogg / hỗ trợ / tải lỗi / đang tắt tiếng | Âm thanh tổng hợp / tiếng thật (URL tính từ số Pokédex với thẻ cũ) / dự phòng / im lặng |
| SH-01..02 | P1 | AUTO | Shiny xác suất 1/8 khi quét; quét lại bản thường | Hiện banner "SHINY siêu hiếm", nút chuyển sang Shiny; `shinyUnlocked` được giữ vĩnh viễn |
| CG-01..04 | P1 | AUTO | Luật ném bóng: tỉ lệ bắt theo `capture_rate` thật, dễ hơn cho trẻ (30–95%) | Pokémon nào cũng bắt được; ném lúc vòng nhỏ → tỉ lệ cao hơn, nhiều sao hơn |
| CA-01..04 | P1 | AUTO | Minigame: ném trúng + bắt được / thoát ra / vuốt trượt đến hết 5 bóng / chạm nhẹ không phải vuốt | Ghi nhận lần bắt / còn bóng thì chơi tiếp / nút "Chơi lại" / không ném |
| ST-12 | P1 | AUTO | `recordCatch` | Cộng số lần bắt, giữ nguyên khi quét lại |
| GG-01..04, GU-01..03 | P1 | AUTO | Đoán bóng đen: 40 Pokémon phổ biến khớp đúng số Pokédex; 4 lựa chọn khác nhau, không lặp; 10 câu; gợi ý; đúng/sai | Hiện màu + tên sau khi chọn, tính điểm, sao, kỷ lục |
| SV-17..21 | P1 | AUTO | Dữ liệu mới từ PokeAPI; mô tả điều kiện tiến hóa tiếng Việt; chuỗi rẽ nhánh (Eevee); cache; lỗi mạng | Đúng trường; "Đạt cấp 16", "Dùng Đá Sấm", "Rất thân thiết (ban đêm)"...; trả `[]` khi lỗi |
| EV-01..06 | P1 | AUTO | Cây tiến hóa: tải, chưa đủ 3 lần quét, đủ lần quét (mỗi nhánh 1 nút), dạng cuối, không tiến hóa, form không có species | Đúng thông báo / thanh tiến độ / nút "Tiến hóa thành X!" |
| ES-01..02 | P2 | AUTO | Màn tiến hóa: phát sáng tối thiểu 2,6 giây rồi lộ dạng mới; lỗi mạng | Nút "Xem X"; thông báo thân thiện |
| BU-01..03 | P2 | AUTO | "Pokémon của bé": chạm vào → nhảy lên, bay tim, phát tiếng kêu; nút Shiny; nút minigame | Đúng |
| AP-08..13 | P1 | AUTO | Tích hợp: quét trúng shiny; tiến hóa thêm thẻ mới; xem thử Pokémon chưa có (không lưu); tab Trò chơi; đổi theme; lần bắt được ghi lại | Đúng |
| TH-01..04 | P1 | AUTO | Theme: mặc định Tối, nhớ lựa chọn, chuyển vòng Tối → Sáng → Xanh biển, vẫn hoạt động khi storage bị chặn | `data-theme`, meta theme-color, localStorage đúng |
| UI-01 | P1 | MANUAL (Chrome headless) | Chụp 4 màn × 3 theme ở 412×915, cùng minigame và màn tiến hóa | Chữ đọc được, nền xanh phủ toàn trang, minigame phủ header, không có lỗi JS |
| UI-02 | P1 | MANUAL | iPhone Safari: tiếng kêu `.ogg`, thao tác vuốt, gradient | **Chưa thực hiện** |

Lỗi phát hiện khi chụp màn hình thật và đã sửa:
- Nền Xanh biển chỉ phủ một màn hình (`background-attachment: fixed`).
- Minigame bị header và nút nổi đè lên (stacking context của `<main>`; đã chuyển sang render qua portal).
- Vị trí Pokémon khi bóng tới được tính bằng công thức dự đoán, lệch với vị trí đang hiển thị (phát hiện qua test CA-01).
### 12.1 Sửa lỗi "ném thế nào cũng trượt" và thêm hiệu ứng ném bóng

Nguyên nhân (đo bằng mô phỏng theo đúng code cũ): bóng bay mất 650ms và luôn nhắm vào giữa, trong khi Pokémon vẫn di chuyển. Bấm NÉM khi Pokémon ở giữa (đúng như hướng dẫn trên màn hình) thì trúng **0%**, bấm bất kỳ lúc nào thì trúng 19%. Vùng tính trúng chỉ ±36px trong khi hình Pokémon rộng ±64px.

Sửa: nút NÉM nhắm vào vị trí Pokémon lúc bấm; bóng tự lượn 30% quãng lệch về phía Pokémon; vùng trúng khớp với thân Pokémon; Pokémon chạy chậm hơn; bóng luôn đáp ở đúng vị trí mà phần tính toán dùng để quyết định trúng/trượt.

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| CG-05 | P1 | AUTO | Mô phỏng bấm NÉM ở mọi thời điểm | Trúng ≥90% (Pokémon dễ), ≥65% (capture rate 45), 40–80% (huyền thoại) |
| CG-06 | P1 | AUTO | Bấm khi Pokémon ở giữa / ở hai bên | >30% / 100% |
| CG-07..08 | P2 | AUTO | Hỗ trợ nhắm, ném quá xa; quỹ đạo vòng cung, thu nhỏ, xoay 3 vòng | Đúng |
| CA-01 | P1 | AUTO | Chuỗi hiệu ứng khi trúng: bay (vệt sáng) → bùng sáng + Pokémon hóa ánh đỏ thu vào bóng, nắp mở → rơi nảy → lắc 3 lần → tia sao + nút sáng | Đúng thứ tự phase |
| CA-02 | P1 | AUTO | Thoát ra: Pokémon bật ra, mất 1 bóng, chơi tiếp | Đúng |
| CA-03 | P1 | AUTO | Vuốt quá xa: bóng bay vụt qua và mờ dần, hết 5 bóng thì hiện "Chơi lại" | Đúng |
| CA-05 | P2 | AUTO | Bóng thay đổi vị trí theo từng khung hình, có vệt sáng | Đúng |
| UI-03 | P1 | MANUAL (Chrome, đồng hồ thật) | Bấm NÉM ở thời điểm ngẫu nhiên, 3 ván × 3 Pokémon | Lần chạy cuối: Pikachu 4/4, Charmander 4/5, Mewtwo 5/8 lần trúng; không có lỗi JS |
---

## 13. Minigame "Pokémon Chạy Nhảy" (2026-09-26)

Mô phỏng game khủng long của Chrome khi mất mạng. Nhân vật chạy là Pokémon được chọn: ở trang chi tiết thì là Pokémon đó, ở tab Trò Chơi thì chọn từ bộ sưu tập, chưa có thẻ thì là Pikachu. Chướng ngại vật là đá, cụm đá, bụi cỏ và gốc cây (thay cho xương rồng); đôi khi là Pokémon khác trên mặt đất (Diglett, Geodude, Voltorb, Shellder, Slowpoke, Sudowoodo, Ferroseed, Snorlax) hoặc Pokémon bay ở 3 độ cao (Pidgey, Zubat, Butterfree, Hoothoot, Wingull, Fletchling; thay cho thằn lằn bay). Điều chỉnh cho trẻ em: 3 mạng, bất tử 1,5 giây sau mỗi lần va chạm, vùng va chạm thu hẹp 7px mỗi cạnh, quả mọng +20 điểm, ngày/đêm đổi mỗi 500 điểm, lưu kỷ lục.

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| RU-01..03 | P1 | AUTO | Chạm để nhảy (đỉnh ~126px, ~0,65s) / giữ để nhảy cao hơn / không nhảy kép / cúi trên mặt đất và cúi trên không để rơi nhanh | Đúng |
| RU-04..05 | P2 | AUTO | Chưa bắt đầu thì đứng yên; tốc độ tăng dần đến mức tối đa; khung hình dài bị giới hạn (không xuyên qua chướng ngại) | Đúng |
| RU-06 | P1 | AUTO | Số Pokédex của các Pokémon chướng ngại | Khớp danh sách 1025 loài |
| RU-07 | P1 | AUTO | Chướng ngại cao nhất và rộng nhất vẫn nhảy qua được ở tốc độ khởi đầu | Đúng |
| RU-08..10 | P1 | AUTO | Pokémon bay chỉ xuất hiện từ 150 điểm; khoảng 25–50% chướng ngại là Pokémon; có đủ các loại chướng ngại; cùng seed ra cùng đường chạy | Đúng |
| RU-11..15 | P1 | AUTO | Mất mạng + bất tử; hết mạng thì thua; va chạm sát mép không tính; tầng bay thấp phải nhảy, tầng giữa phải cúi, tầng cao chỉ va khi đang nhảy; quả mọng; mốc 100 điểm, đêm, số sao | Đúng |
| RU-16 | P1 | AUTO | **Kiểm tra công bằng**: bot chơi theo luật đơn giản chạy 90 giây với 5 seed | Không bị va lần nào, điểm >2500 |
| RU-17 | P2 | AUTO | Đứng yên | Thua nhanh |
| RG-01..04 | P1 | AUTO | Màn chờ, chạm để chạy, bàn phím (Space/↓/Esc), thua → kỷ lục mới → chơi lại, 3 tim, nút CÚI/NHẢY | Đúng |
| GH-01..03 | P2 | AUTO | Tab Trò Chơi: chưa có thẻ thì dùng Pikachu, chọn Pokémon từ bộ sưu tập, vẫn có trò đoán bóng đen và đường vào trò ném bóng | Đúng |
| UI-04 | P1 | MANUAL (Chrome) | Chơi thật ở màn dọc 412×915 và màn ngang 915×412 | Vẽ đúng, không lỗi JS, vừa màn hình |

Lỗi phát hiện và đã sửa: tầng bay "giữa" đứng im cũng không va (nút CÚI vô dụng, phát hiện qua RU-13); nhân vật chạy giật lùi vì artwork quay mặt trái; màn ngang bị cắt mất nút; sân chơi quá nhỏ ở màn dọc; bảng kết thúc chật trên màn nhỏ.
---

## 14. Chăm sóc Pokémon (2026-09-26)

Quả mọng nhặt được trong game Chạy Nhảy được cất vào túi dùng chung (lần đầu mở app được tặng 3 quả Oran), dùng để cho Pokémon ăn. Thân thiết tăng từ 0 đến 100 qua 5 cấp: Mới quen, Bạn bè, Bạn thân, Tri kỷ, Bạn thân nhất. Mỗi quả +10; quả yêu thích (tùy theo số Pokédex) +20 và sau khi thử sẽ hiện tên quả. Vuốt ve +1 (tối đa 10 lần/ngày). Mỗi Pokémon ăn tối đa 5 quả/ngày. Nhánh tiến hóa cần "thân thiết" (Pichu, Espeon, Umbreon, Sylveon…) mở khóa khi thân thiết đạt 80 thay vì phải quét 3 lần.

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| CARE-01..05 | P1 | AUTO | Cấp độ; +10/+20 món yêu thích (nhớ đã khám phá); 5 quả/ngày và đặt lại vào ngày hôm sau; dừng ở 100; vuốt ve có giới hạn/ngày | Đúng |
| BAG-01..02 | P1 | AUTO | Quà khởi đầu; dữ liệu hỏng; thêm/bớt quả; không bớt được quả khi đã hết | Đúng |
| CARE-06..09 | P1 | AUTO | Cho ăn thì trừ 1 quả và lưu thân thiết, quét lại vẫn giữ; hết quả / thẻ không tồn tại / no bụng thì túi không đổi; lưu thất bại thì hoàn quả; vuốt ve | Đúng |
| RU-18, RG-05 | P1 | AUTO | Game Chạy Nhảy đếm quả theo loại; cất vào túi đúng 1 lần, khi kết thúc ván hoặc khi đóng giữa chừng | Đúng |
| BU-04..07 | P1 | AUTO | Quả bay vào miệng → nhai → "+20 Món yêu thích!" → "Giờ là Bạn bè!"; hết quả / no bụng; hiện cấp, số tim, số quả đã ăn hôm nay, quả yêu thích; Pokémon chưa có thẻ thì không cho ăn | Đúng |
| EV-07..08 | P1 | AUTO | Tiến hóa bằng thân thiết (Pichu); Eevee: nhánh dùng đá theo số lần quét, nhánh thân thiết theo thanh thân thiết | Đúng |
| AP-14 | P1 | AUTO | Cho ăn từ trang chi tiết: túi giảm, thân thiết tăng, bộ sưu tập hiện "❤ Bạn bè" | Đúng |
| UI-05 | P1 | MANUAL (Chrome) | Hiệu ứng cho ăn và cây tiến hóa 8 nhánh của Eevee (dữ liệu PokeAPI thật) | Hiển thị đúng, không lỗi JS |
---

## 15. Đấu Pokémon 1v1 (2026-09-26)

Đấu theo lượt giữa Pokémon của bé và một Pokémon hoang dã. Chỉ số gốc và 4 chiêu thức (sức mạnh, độ chính xác, hệ, số đòn, ra đòn trước) lấy từ PokeAPI; mất mạng thì dùng dữ liệu đã lưu hoặc bộ chiêu dự phòng. Bảng khắc chế 18 hệ nhúng sẵn và đã đối chiếu với PokeAPI (324/324 cặp khớp). Sát thương tính theo công thức gốc (cùng hệ ×1.5, khắc hệ, chí mạng, dao động ngẫu nhiên). Đánh trúng/siêu hiệu quả/chí mạng/bị đánh sẽ tích năng lượng; khi đầy mở **Tuyệt Kỹ Liên Hoàn**: 4 chiêu liên tiếp luôn trúng với hệ số ×1 → ×1.2 → ×1.45 → ×1.8.

Hiệu ứng: hạt riêng từng hệ trên canvas (dòng lửa, bong bóng, sét, lá xoáy, mảnh băng, bùn độc lượn, đá phun, đá rơi, nhát gió, vòng sóng tâm linh, cầu bóng tối, tia rồng…); đòn vật lý thì Pokémon lao tới; rung màn hình, chớp sáng, khựng hình khi chí mạng; số sát thương bay lên; thanh máu có vệt đỏ tụt chậm; băng rôn "Siêu hiệu quả!", "CHÍ MẠNG!", "TUYỆT KỸ LIÊN HOÀN!"; bộ đếm x1–x4; pháo hoa kết thúc chuỗi; Pokémon gục thì chìm và mờ dần.

Cho trẻ: máu Pokémon của bé ×1.15, độ chính xác +10, tình bạn tăng tới +10% sát thương và tỉ lệ chí mạng; đối thủ được ghép vừa sức (tổng chỉ số chênh ≤25%, tránh đối thủ khắc hệ bé) và cân cấp độ; thắng +2 quả mọng, thua +1 quả an ủi; ghi số trận thắng.

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| BT-01 | P1 | AUTO | Bảng khắc chế, hệ kép (×4, ×0.25), nhãn | Đúng |
| LIVE | P1 | LIVE | So bảng khắc chế với PokeAPI 18×18 | Không lệch |
| BT-02..05 | P1 | AUTO | Đọc chiêu PokeAPI, bỏ chiêu trạng thái, chiêu nhiều đòn; chọn chiêu cùng hệ + phủ hệ + ra đòn trước; bộ dự phòng | Đúng |
| BD-01..04 | P1 | AUTO | Tải dữ liệu trận, cache bộ nhớ + localStorage (đấu lại khi mất mạng), dự phòng chiêu, lỗi thân thiện | Đúng |
| BT-06..09 | P1 | AUTO | Công thức chỉ số cấp 50; sát thương đúng từng hệ số (khớp tính tay); miễn nhiễm; tình bạn ≤+10%; cân cấp độ | Đúng |
| BT-10..15 | P1 | AUTO | Thứ tự lượt (tốc độ, ra đòn trước); trượt; miễn nhiễm; nhiều đòn; gục ngã kết thúc trận; năng lượng và chuỗi x1–x4 luôn trúng; AI thường chọn chiêu tốt nhất nhưng không phải lúc nào cũng vậy | Đúng |
| BT-16 | P1 | AUTO | Mô phỏng 400 trận (dữ liệu mẫu) | Chọn chiêu hợp lý thắng >75% (đo được 81%), bấm bừa >30% (64%) |
| BT-17..20 | P1 | AUTO | Ghép đối thủ vừa sức, không trùng loài, tránh đối thủ khắc hệ, Pokémon rất mạnh/yếu | Đúng |
| LIVE | P1 | LIVE | Cân bằng với dữ liệu thật: 10 Pokémon × 200 trận | Chọn chiêu hợp lý 81–99%, bấm bừa 51–98% (Magikarp 81%/64%) |
| BA-01..06 | P1 | AUTO | Vào trận, gợi ý khắc hệ trên nút; đánh thắng, báo kết quả 1 lần; thua; tích năng lượng → Tuyệt Kỹ Liên Hoàn (viền tối, băng rôn, x1→x4); lỗi mạng → thử lại; đấu tiếp/đóng | Đúng |
| BA-07 | P1 | AUTO | **Hồi quy**: trang cha render lại (sau khi cộng thưởng) không được khởi động lại trận | Màn kết quả giữ nguyên |
| UI-06 | P1 | MANUAL (Chrome) | Đánh trận thật, chụp khung hình chiêu thức, liên hoàn, màn thắng | Không lỗi JS |

Lỗi phát hiện và đã sửa:
- Trận tự khởi động lại ngay khi có kết quả: trang cha tạo object `card` mới → effect chạy lại. Phát hiện khi đánh thật trên Chrome.
- Đối thủ quá mạnh (thua sau 2 lượt): chọn ngẫu nhiên trong 40 Pokémon không xét sức mạnh → thêm ghép cặp và chỉnh hệ số cấp độ bằng mô phỏng dữ liệu thật.
- Băng rôn cầu vồng lệch và bị cắt: class `rainbow-bg` có animation riêng, ghi đè hiệu ứng căn giữa.
- Tầng khắc hệ, sát thương, chuỗi liên hoàn: kiểm tra bằng test đơn vị.
---

## 16. Chỉnh sửa theo phản hồi và 2 game mới (2026-09-26)

**Game Chạy Nhảy**: bỏ hai nút NHẢY/CÚI. Chạm bất kỳ đâu trên màn hình để nhảy (giữ lâu thì nhảy cao hơn), vuốt xuống để cúi. Nếu cú vuốt bắt đầu bằng một cú chạm đã làm nhân vật nhảy lên, cú nhảy mới bắt đầu (<24px) sẽ bị hủy để cúi ngay. Màn dọc: khung cao 323px (trước đây 170px), phóng to (hiển thị 340/600 đơn vị chiều ngang, hình to hơn khoảng 45%), trời mở rộng phía trên; tốc độ màn dọc thấp hơn (230→460) để giữ khoảng 0,5 giây phản ứng ở tốc độ tối đa.

**Đấu Pokémon**: mặc định chậm 1,5 lần (thời gian chờ, hoạt ảnh CSS và cả chuyển động hạt, quay chậm đồng bộ); nút 🐢 Chậm / 🐇 Nhanh, ghi nhớ lựa chọn.

**Bếp Pokémon**: 5 khách mỗi lượt; công thức 3 nguyên liệu trước, 4 nguyên liệu sau; bấm sai 2 lần thì nguyên liệu đúng phát sáng; khuấy bằng cách vẽ vòng tròn trên nồi (3 vòng) hoặc bấm nút/chạm nồi; nấu, món ăn bật ra, khách ăn, chấm sao; thưởng quả mọng.

**Cửa hàng Pokémon**: 6 khách, độ khó tăng dần (1 loại hàng tổng ≤5 xu → 3 loại tổng ≤10 xu); chọn hàng vào giỏ (bấm vào món trong giỏ để bỏ ra); chọn tổng tiền trong 3 đáp án, có hình đồng xu để đếm; thưởng quả mọng.

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| RU-19 | P1 | AUTO | Hủy cú nhảy vừa bắt đầu khi vuốt xuống; cú nhảy thật thì không hủy | Đúng |
| RU-16b, RU-20 | P1 | AUTO | Bot vượt qua với tốc độ màn dọc; thời gian phản ứng ở tốc độ tối đa >0,5 giây | Đúng |
| RG-04, RG-06 | P1 | AUTO | Không còn nút NHẢY/CÚI, có gợi ý cử chỉ; chạm (kể cả ngoài khung game) để nhảy; vuốt xuống thì cúi ngay, thả tay thì đứng lên; chạm nút đóng không bắt đầu game | Đúng |
| BA-08 | P1 | AUTO | Mặc định chậm (tempo 1.5, lời thoại thứ hai sau ~1,95 giây thay vì 1,3 giây); nút đổi tốc độ và ghi nhớ | Đúng |
| CK-01..06 | P1 | AUTO | Công thức, kệ luôn có đủ nguyên liệu, đúng thứ tự, gợi ý sau 2 lần sai, khuấy bằng vòng tròn/chạm, góc quay vòng, sao, thưởng | Đúng |
| SH-01..04, SH-03b | P1 | AUTO | Đơn hàng theo cấp độ, tổng tiền, giỏ khớp, thêm/bớt, 3 đáp án khác nhau (kể cả khi random cố định), sao, câu mô tả, thưởng | Đúng |
| CO-01..05 | P1 | AUTO | Bếp: khách vào, sai thì rung, gợi ý; nguyên liệu bay vào nồi; khuấy; nấu → món → ăn → khách tiếp theo; vẽ vòng tròn; trọn 5 khách thì tổng kết và thưởng 1 lần; nhân vật không chắn thao tác trên nồi | Đúng |
| SG-01..03 | P1 | AUTO | Cửa hàng: từ chối món không mua, đủ giỏ thì tính tiền, sai thì nhắc đếm lại, đúng thì xu rơi đúng số lượng, sao; bỏ món khỏi giỏ; 6 khách thì tổng kết và thưởng 1 lần | Đúng |
| UI-07 | P1 | MANUAL (Chrome) | Chạy Nhảy màn dọc (chạm, vuốt, kích thước), Bếp (vẽ vòng tròn bằng chuột), Cửa hàng | Không lỗi JS |

Lỗi phát hiện và đã sửa:
- `answerChoices` có thể lặp vô hạn (vòng thử lại với random cố định): test bị treo đã phát hiện ra; viết lại theo cách tất định.
- Trong trình duyệt thật, khung khách hàng che nửa cái nồi nên vẽ vòng tròn không khuấy được (jsdom không phát hiện được): nhân vật không nhận chạm, nồi nằm lớp trên.
- Khung chơi màn dọc lần đầu có quá nhiều khoảng trời trống: điều chỉnh tỉ lệ khung và độ phóng to.
---

## 17. Giao diện Pokédex, bảng chọn game, màn quét mới (2026-09-26)

- **Giao diện Pokédex** (theme thứ 4): vỏ máy đỏ có vân và ánh sáng, khung nội dung như màn hình LCD xanh ngọc tối với viền xám dày, header như nắp máy. Nút giao diện ở header thành **menu chọn** 4 giao diện, mỗi giao diện có ô màu xem trước.
- **Bảng chọn game**: khu "Pokémon của bé" chỉ còn 1 nút "Chơi cùng X · N trò", bấm vào mở bảng trượt từ dưới lên với 5 game (Ném bóng, Chạy nhảy, Đấu Pokémon nếu đã có thẻ, Bếp, Cửa hàng), mỗi game có biểu tượng, mô tả và thành tích. Đóng bằng cách chạm nền, nút X hoặc phím Esc.
- **Màn quét**: icon Pokéball; nút chụp tròn hình Pokéball lớn ở giữa, hai bên là Tải ảnh và Đổi camera/Thử lại; ô tìm kiếm có gợi ý tên kèm ảnh và số Pokédex khi gõ từ 2 ký tự; hàng **Pokémon gần đây** (mới nhất trước) mở thẳng thẻ đã lưu, không cần tải lại; lưới **Pokémon nổi tiếng** có ảnh; bảng xác nhận "Có phải Pokémon này không?" với các thẻ gợi ý có ảnh, cùng 3 lối ra: **Quét lại** (đóng bảng và mở lại camera), **Nhập tên khác**, **Hủy**; khi đang tải có nút **Hủy tải** (kết quả về muộn sẽ bị bỏ qua).

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| TH-02, AP-12 | P1 | AUTO | 4 giao diện; chọn từ menu; chạm ngoài thì đóng menu, không đổi giao diện | Đúng |
| BU-03, BU-08 | P1 | AUTO | Không còn danh sách nút game trên trang; bảng chọn mở/đóng (nền, X, Esc); chọn game thì chạy game và đóng bảng; hiện thành tích | Đúng |
| SC-22 | P1 | AUTO | Gõ "pika" thì gợi ý Pikachu #025 có ảnh; chạm vào gợi ý thì tải | Đúng |
| SC-23 | P1 | AUTO | Pokémon gần đây sắp xếp mới nhất trước; chạm thì mở thẻ, không gọi mạng | Đúng |
| SC-24 | P1 | AUTO | Hủy khi đang tải; kết quả về muộn không mở video | Đúng |
| SC-25 | P1 | AUTO | Quét lại: đóng bảng xác nhận, mở trình chọn camera | Đúng |
| SC-26 | P1 | AUTO | Gợi ý từ OCR là thẻ có ảnh, chọn được | Đúng |
| UI-08 | P1 | MANUAL (Chrome) | Pokédex ở màn quét, chi tiết, bộ sưu tập; menu giao diện; gợi ý tìm kiếm; bảng chọn game | Không lỗi JS |
---

## 18. Thi đấu thể thao với Pokémon khác (2026-09-26)

4 game thi đấu mới, mở từ bảng chọn game của mỗi Pokémon (nhãn "Thi đấu") và từ tab Trò Chơi (mục "Thi đấu thể thao cùng X"). Đối thủ là Pokémon nổi tiếng ngẫu nhiên, không trùng Pokémon của bé. Trận nào cũng mở đầu bằng màn **VS** (chạm để bỏ qua), có bảng điểm hai bên và kết thúc bằng màn kết quả. Bé luôn được quà: thắng 1 Oran + 1 Razz, hòa hoặc thua 1 Oran; quà chỉ trao 1 lần mỗi trận.

- **Bowling** (5 frame mỗi bên): chạm lần 1 để dừng mũi tên đang lắc chậm (ngắm), chạm lần 2 để dừng thanh lực. Bóng là Pokéball lăn trên đường băng gỗ phối cảnh 3D. Camera phóng to và quay chậm khi bóng chạm ki, ki văng và đổ dây chuyền. STRIKE +5 điểm, SPARE +3. Không có bóng rơi rãnh (đầu mũi tên vẫn trúng vài ki).
- **Sút penalty** (5 lượt sút, 5 lượt bắt): chạm vào khung thành để sút; các ô mục tiêu nhấp nháy; góc cao khó bắt hơn. Khi bắt bóng, đối thủ "nhìn" về một hướng (👀, đúng khoảng 70%), bé chọn Trái/Giữa/Phải. Thủ môn bay người, lưới rung, khán giả nhảy, pháo giấy.
- **Bóng rổ** (5 quả mỗi bên): kéo ngược như ná cao su rồi thả; chấm trắng chỉ đoạn đầu đường bay. Bóng nảy vành/bảng; ném sạch lưới thì hiện "SWISH!". Mỗi quả vào 2 điểm.
- **Đua xe máy** (4 tay đua, 3 làn, khoảng 27 giây): đếm 3-2-1 rồi XUẤT PHÁT. Chạm nửa trái/phải màn hình, bấm nút hoặc phím ←/→ để đổi làn. Vũng dầu làm chậm, cọc làm khựng và rung màn hình, mũi tên vàng tăng tốc (có lửa và vệt gió). Bên phải có thanh tiến độ, góc trên hiện hạng hiện tại. Về nhất tính là thắng, nhì/ba là hòa, thứ 4 là thua.

Cân bằng độ khó được đo bằng mô phỏng (xem log khi chạy test):

| Game | Đo được |
|---|---|
| Bowling | Bé chạm ngẫu nhiên thắng ~39%; bé canh mũi tên thắng ~74%; máy trung bình 7 ki/lượt đầu |
| Penalty | Bé sút bất kỳ trong khung vào ~76% (góc cao 86%, giữa thấp 78%); theo hướng nhìn thì bắt được 60%, đoán bừa 28%; đoán bừa vẫn thắng ~56% số trận |
| Bóng rổ | Máy ném vào ~37%; cú ném chuẩn ở góc 55–65° luôn vào; ném quá thẳng (<50°) chạm vành |
| Đua xe | Bé biết né: nhất ~48%, vào top 3 ~91%; bé không điều khiển: nhất ~25%, top 3 ~71% |

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| SP-01 | P1 | AUTO | Kết quả thắng/hòa/thua, quà, dao động lắc/nhấp nháy trong giới hạn | Đúng |
| BW-01..08 | P1 | AUTO | Bố trí 10 ki; ném vào "túi" hay strike; đầu mũi tên đổ ít ki; lần 2 chỉ còn ki đứng; lượt ném luôn kết thúc; tính điểm strike/spare; máy vừa sức; tỉ lệ thắng theo mô phỏng | Đúng |
| PK-01..04 | P1 | AUTO | Cột khung thành; tỉ lệ vào của bé; theo hướng nhìn thì bắt tốt hơn đoán; bé đoán bừa vẫn thắng >30% | Đúng |
| BB-01..06 | P1 | AUTO | Cú ném chuẩn vào ở nhiều góc; ném yếu/lệch thì trượt; có vùng sai số cho phép; máy vào 35–70%; kéo ngược thì bay tới, lực có giới hạn; quả nào cũng kết thúc | Đúng |
| RC-01..04 | P1 | AUTO | Đếm ngược rồi về đích; không ra khỏi đường; bé né tốt thì về nhất nhiều hơn; dầu làm chậm, mũi tên tăng tốc | Đúng |
| SPT-01, SPT-02 | P1 | AUTO | Bowling: VS → ngắm → lực → lăn → thông báo; trọn 5 frame thì hiện kết quả và trao quà 1 lần | Đúng |
| SPT-03, SPT-04 | P1 | AUTO | Penalty: chạm khung thành để sút, đổi lượt thì có nút bay người và hướng nhìn; 10 lượt thì kết thúc, trao quà 1 lần | Đúng |
| SPT-05, SPT-06 | P1 | AUTO | Bóng rổ: kéo quá ngắn thì không ném; kéo chuẩn thì +2; máy tự ném; hết 5 quả thì kết quả | Đúng |
| SPT-07, SPT-08 | P1 | AUTO | Đua xe: đếm 3-2-1, chưa xuất phát thì không đổi làn; phím và nút đổi làn; về đích thì hiện hạng, bảng xếp hạng, quà 1 lần | Đúng |
| SPT-09, SPT-10 | P1 | AUTO | Tab Trò Chơi có 4 môn và mở được; nút X và Esc đóng trận | Đúng |
| UI-09 | P1 | MANUAL (Chrome) | Cả 4 môn trên màn dọc 412px: VS, thao tác chạm/kéo, camera phóng to bowling, thủ môn bay, lưới rung, SWISH, đua xe tăng tốc, màn kết quả; bảng chọn game có 4 môn | Không lỗi JS |

Lỗi phát hiện và đã sửa:
- Bowling ban đầu lần nào cũng strike (va chạm dây chuyền quá mạnh): giảm lực văng, ngưỡng dây chuyền và ma sát.
- Máy chơi bowling quá mạnh so với bé chạm ngẫu nhiên (bé chỉ thắng 15%): máy ngắm đều như bé, mũi tên phủ rộng hơn, lực ít ảnh hưởng hơn.
- Vành rổ quá hẹp nên ném theo đường thấp luôn chạm vành: nới vành và nâng điểm ném; cú ném hụt "dài" của máy từng dội bảng vào rổ nên máy vào tới 70%: cú hụt dài giờ bay qua bảng.
- Máy đua xe luôn về trước (tốc độ và "dây thun" quá mạnh): bé chạy nhanh hơn một chút, đối thủ chỉ được đẩy tối đa 5% khi bị bỏ xa.
- Trong Chrome: dòng gợi ý bị lệch vì hoạt ảnh nhấp nháy ghi đè `translate`, emoji trong chữ gradient thành vết mờ, chữ "Hạng 1/4" chồng lên nhau, màn kết quả còn thấy hình phía sau. Đã sửa cả 4.

---

## 19. Game trí tuệ, khóa Pokémon chưa quét, vàng và Tiệm quà (2026-09-26)

**Khóa Pokémon chưa quét thẻ**
- Chỉ Pokémon đã quét thẻ mới được xem chi tiết và chơi game cùng.
- Ô tìm kiếm ở màn quét:
  - Chỉ mở được Pokémon bé đã có.
  - Pokémon khác hiện hình bóng đen kèm 🔒 và lời nhắc "Hãy chụp thẻ bằng camera để mở khóa".
- Lưới "Pokémon nổi tiếng" thành mục tiêu sưu tầm (Đã có x/8).
- Pokémon mới chỉ được thêm bằng ảnh thẻ. Nếu không đọc được tên, bảng xác nhận sau khi chụp vẫn cho nhập tên.
- Cây tiến hóa: dạng chưa có hiện bóng đen 🔒. Chạm vào chỉ hiện thông báo, không tải dữ liệu và không mở trang chi tiết. Tiến hóa sau khi quét đủ số lần hoặc đủ thân thiết vẫn mở khóa dạng mới như trước.
- Tab Trò Chơi khi chưa có thẻ nào: mọi game bị khóa, có nút "Quét thẻ ngay". Game đoán bóng Pokémon vẫn mở.

**Vàng 🪙** (bắt đầu với 20 vàng, số vàng hiện trên thanh đầu trang, chạm vào để mở Tiệm quà):

| Game | Vàng |
|---|---|
| Thi đấu thể thao, Đấu Pokémon | Thắng 15 · hòa 10 · thua 5 |
| Game trí tuệ | 5 vàng mỗi sao (1–3 sao) |
| Bếp, Cửa hàng | 1 vàng mỗi sao của cả lượt |
| Chạy nhảy | 5 vàng mỗi sao; điểm dưới 100 không được vàng (mở rồi đóng ngay không được thưởng) |
| Ném bóng bắt Pokémon | 5 mỗi lần bắt được |
| Đoán bóng Pokémon | 2 mỗi câu đúng |

Mỗi lần nhận vàng hiện thông báo "+N vàng" có đồng xu xoay. Màn tổng kết có mưa đồng xu.

**Tiệm quà Pokémon** (Meowth bán hàng), 3 nhóm với 18 món:
- **Đồ ăn:** ăn là hết, tăng thân thiết, tối đa 5 món mỗi ngày.
- **Đồ chơi:** mua 1 lần là giữ mãi. Mỗi món chơi 1 lần mỗi ngày với mỗi Pokémon.
- **Vật dụng:** tặng hẳn cho 1 Pokémon và được thưởng thân thiết lần đầu. Mũ, nơ, vương miện hiện trên đầu Pokémon. Giường, chậu cây, nhà hiện quanh Pokémon.
- Mua hàng: món đồ bay vào túi. Thiếu vàng thì Meowth nói "cần thêm N vàng".
- Tặng quà ở mục 🎁 Tặng quà trên trang Pokémon:
  - Quà bay vào Pokémon.
  - Đồ ăn: nhai. Đồ chơi: tung quanh Pokémon. Vật dụng: vòng lấp lánh.
  - Hiện "+N ❤️"; lên cấp thân thiết thì có pháo giấy.

**5 game trí tuệ** (bảng chọn game của Pokémon được chia thành Vui chơi / Thi đấu / Trí tuệ):
- **Thoát mê cung:**
  - 3 mê cung, mỗi cái lớn hơn cái trước: 5×5, 6×7, 7×9.
  - Điều khiển bằng vuốt, bàn phím mũi tên hoặc nút mũi tên. Pokémon tự đi theo lối rẽ và dừng ở ngã rẽ.
  - Quả mọng ở ngõ cụt là phần thưởng thêm. Nút Gợi ý hiện đường vàng.
  - Sao tính theo số bước so với đường ngắn nhất.
- **Làm toán:**
  - 9 câu: đếm, cộng, trừ trong phạm vi 10.
  - Đáp án là bóng bay. Câu trừ thì Pokémon "ăn mất" vài hình.
  - Sai thì Pokémon đếm to từng hình (số hiện trên hình) để gợi ý.
- **Học tiếng Anh:**
  - 36 từ có hình, nghĩa tiếng Việt và từ cùng nghĩa (kitty, bunny, ocean, glad/joyful…).
  - 8 câu xen kẽ: "nghe chọn hình" và "nhìn hình chọn từ".
  - Đúng thì thẻ lật ra, đọc to từ và từ cùng nghĩa (giọng tiếng Anh), sau đó đọc nghĩa (giọng tiếng Việt).
  - Giọng đọc dùng Web Speech API có sẵn trên máy, miễn phí. Giọng có sẵn tùy thiết bị.
- **Nhớ thứ tự:**
  - Pokémon lần lượt xuất hiện dưới đèn sân khấu, mỗi con kèm một nốt nhạc.
  - Bé chạm lại theo đúng thứ tự vào khay. Độ dài tăng từ 2 đến 6. Có 3 tim.
- **Chơi nhạc:**
  - Đàn gỗ 8 phím (Đô → Đố).
  - 4 bài: Ngôi sao lấp lánh, Chú cừu nhỏ, Chuông ngân vang, Khúc hoan ca.
  - Phím cần gõ phát sáng và có Pokéball nảy phía trên. Hàng nốt sắp tới hiện trước.
  - Chơi xong thì phát lại cả bài, Pokémon nhảy múa.
  - Có chế độ chơi tự do (không có vàng).

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| GD-01..03, SI-01..05, BG-01..03 | P1 | AUTO | Ví vàng (khởi đầu, cộng, trừ, không âm, dữ liệu hỏng); danh mục; đồ ăn tối đa 5 mỗi ngày; đồ chơi 1 lần mỗi ngày và không mất; vật dụng giữ mãi, đổi món đang đội; mua thiếu tiền; tặng quà trừ túi và lưu thẻ | Đúng |
| MZ-01..04, MT-01..02, EN-01..03, MM-01..02, MU-01..02 | P1 | AUTO | Mê cung hoàn hảo, bot đi đường ngắn nhất được 3 sao ở cả 3 mê cung, trượt theo hành lang, quả mọng; câu toán trong phạm vi 10, đáp án luôn có trong 3 lựa chọn; ngân hàng từ, bài học không trùng từ; trí nhớ chơi đúng thì thắng, sai mất tim; giai điệu Twinkle đúng nốt, đếm lỗi, thời gian phát lại | Đúng |
| LG-01..08 | P1 | AUTO | Chơi trọn từng game qua giao diện: gợi ý đếm khi sai, thẻ lật có nghĩa và từ cùng nghĩa, xem đèn sân khấu rồi chạm đúng thứ tự, sai thì mất tim, gõ đàn theo phím sáng rồi phát lại, chơi tự do không có vàng, 3 mê cung bằng bàn phím, đâm vào tường không đi được; vàng trao đúng 1 lần | Đúng |
| GS-01..03, PB-01..03 | P1 | AUTO | Tiệm quà: 3 nhóm, mua, thiếu vàng, đồ chơi "Đã có", đóng bằng Esc; tặng quà bay vào và hiện +❤️; lý do không nhận quà; món đang đội và đồ trang trí hiển thị; túi trống thì dẫn tới Tiệm quà | Đúng |
| AP-10, AP-15, AP-16 | P1 | AUTO | Dạng tiến hóa chưa quét bị khóa (không tải dữ liệu, không lưu); mua quà từ đầu trang rồi tặng thì tăng thân thiết; chơi xong game thì có thông báo +15 và số vàng trên đầu trang tăng | Đúng |
| SC-15, SC-22, SC-27, GH-01, GH-04 | P1 | AUTO | Ô tìm kiếm, gợi ý và lưới nổi tiếng chỉ mở Pokémon đã có; tab Trò Chơi khóa khi chưa có thẻ; có 3 nhóm game | Đúng |
| UI-10 | P1 | MANUAL (Chrome) | Màn quét khi đang khóa, tab Trò Chơi, 5 game trí tuệ, Tiệm quà, tặng quà, vương miện trên đầu, cây tiến hóa có ổ khóa | Không lỗi JS |

Lỗi phát hiện và đã sửa (qua ảnh chụp Chrome):
- Nhiều hình Pokémon lặp lại (ở Làm toán lúc sang câu trừ và ở Tiệm quà khi Meowth nói), bong bóng câu hỏi biến mất. Nguyên nhân: hai phần tử cạnh nhau dùng key dạng số trùng nhau, React giữ lại phần tử cũ. Đã thêm tiền tố cho key, gồm cả Chơi nhạc và khung Pokémon (lỗi tiềm ẩn từ trước).
- Cờ 🇻🇳 hiện thành chữ "VN" trên Windows: thay bằng nhãn "Nghĩa:".

---

## 20. Đấu đội 5 vs 5 (2026-09-26)

Mở từ banner "🏆 Đấu đội 5 vs 5" ở tab Trò Chơi. Banner vẫn mở được khi bé chưa có thẻ nào, vì bé có thể quét thẻ ngay trong màn lập đội.

**Lập đội**
- Có 5 ô Pokéball.
- Nút **📷 Quét thẻ thêm Pokémon** mở màn quét thẻ.
  - Quét thành công: thẻ holo viền cầu vồng lật ra, có vệt sáng quét qua, pháo giấy và câu "X gia nhập đội!", rồi Pokémon bay vào ô.
  - Thẻ vừa quét cũng được lưu vào bộ sưu tập như một lần quét bình thường.
- Pokémon đã quét trước đó có thể chạm để thêm vào đội.
- Không cho thêm trùng Pokémon hoặc thêm quá 5 con.
- Nút **🎲 Cho mượn ngẫu nhiên N Pokémon**: mỗi ô trống quay như máy xèng (hình Pokémon chạy nhanh rồi chậm dần, có tiếng tích tắc), dừng lại thì chớp sáng và gắn nhãn "🎲 Mượn".
- Mỗi Pokémon có nhãn nguồn: 📷 Vừa quét / ⭐ Của bé / 🎲 Mượn. Chạm ✕ để bỏ Pokémon khỏi đội.

**Sàn đấu (6 sàn)**

| Sàn | Hệ được tăng sức mạnh |
|---|---|
| Đồng cỏ xanh | Cỏ, Côn trùng, Thường |
| Núi lửa rực cháy | Lửa, Đất, Đá |
| Bãi biển nắng | Nước, Bay |
| Núi băng tuyết | Băng, Tiên |
| Thành phố đêm | Điện, Thép, Bóng tối |
| Vũ trụ huyền bí | Siêu linh, Rồng, Ma |

- Chiêu thuộc hệ được tăng mạnh hơn ×1.2 cho cả hai đội. Nút chiêu hiện nhãn "Sân nhà ↑".
- Mỗi sàn có cảnh nền và hạt bay riêng: lá, tàn lửa, bong bóng, tuyết, tia neon, sao và sao băng.
- Thẻ sàn cho biết sàn đó "Hợp với N Pokémon của bé".

**Trận đấu**
- Màn đối đầu: hai đội chạy vào từ hai bên, chữ VS bật ra, hiện tên sàn và các hệ được tăng.
- Mỗi lần đổi Pokémon: Pokéball bay theo đường cong và xoay, bung ra chớp sáng theo màu hệ, Pokémon lớn lên từ vùng sáng, có tiếng kêu.
- Pokémon gục thì đỏ lên và thu nhỏ về bóng, có dòng "HẠ GỤC!".
- Hàng đội hình trên và dưới cho thấy máu, ai đang đấu, ai đã gục (✕).
- Máu giữ nguyên qua các cặp đấu. Năng lượng Tuyệt Kỹ Liên Hoàn dùng chung cho cả đội.
- Pokémon của bé gục thì bé tự chọn Pokémon tiếp theo, có nhãn "Khắc hệ!". Đối thủ ra lần lượt.
- Tất cả hiệu ứng chiêu, số sát thương, rung màn hình, chí mạng, siêu hiệu quả giống trận 1v1. Có nút 🐢 Chậm / 🐇 Nhanh.

**Kết thúc**
- **Thắng:** lễ trao cúp.
  - Sân khấu có tia sáng xoay và hai đèn rọi lắc qua lại.
  - Bục 5 bậc xếp theo số lần hạ gục; bậc giữa cao nhất có nhãn ⭐ MVP.
  - Cúp vàng rơi xuống, nảy nhẹ rồi phát sáng.
  - Pháo giấy nổ 3 đợt, số vàng đếm tăng dần.
- **Thua:** cả đội lắc lư buồn bã, kèm lời khuyên chọn chiêu và sàn đấu.
- **Vàng:** thắng được 30 + 5 cho mỗi Pokémon còn đứng (tối đa 55), thua được 10. Vàng chỉ trao 1 lần mỗi trận.

**Cân bằng** (mô phỏng 180 trận, 3 đội mạnh/trung bình/yếu, cả 6 sàn):
- Đối thủ của đấu đội mạnh hơn trận 1v1: cấp độ ×1.16, vì bé có 5 Pokémon, được cộng thêm máu và năng lượng liên hoàn dùng chung.
- Không có hệ số này thì bé thắng 100%.
- Với hệ số này: chạm chiêu bất kỳ thắng khoảng 61%, chọn chiêu mạnh thắng khoảng 82%.

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| TB-01, TB-02 | P1 | AUTO | Mượn ngẫu nhiên không trùng, không lấy Pokémon đã có trong đội; đội đối thủ có 5 con khác nhau và không trùng đội bé | Đúng |
| AR-01 | P1 | AUTO | 6 sàn; chiêu cùng hệ mạnh hơn ×1.2 và có nhãn; mã sàn lạ thì về sàn mặc định | Đúng |
| TM-01..05 | P1 | AUTO | Hạ gục thì đối thủ tiếp theo vào, máu và năng lượng liên hoàn giữ nguyên; bé chọn Pokémon tiếp theo (chỉ con còn đứng); mọi trận đều kết thúc, đếm KO và MVP đúng; tỉ lệ thắng trong khoảng mong muốn; công thức vàng | Đúng |
| TT-01..03 | P1 | AUTO | Lập đội từ Pokémon đã quét; không thêm trùng; vòng quay mượn 3 ô có tiếng rồi gắn nhãn; bỏ Pokémon; quét thẻ trong màn lập đội thì có màn chúc mừng, lưu vào bộ sưu tập, gắn nhãn "Vừa quét"; 6 sàn, chọn được, có dòng "Hợp với" | Đúng |
| TT-04 | P1 | AUTO | Cả trận thắng: tải 10 Pokémon, màn đối đầu, ném Pokéball, đấu hết 5 đối thủ, lễ trao cúp (VÔ ĐỊCH, MVP, cúp), vàng trao 1 lần đúng số, "Đấu trận mới" quay về lập đội | Đúng |
| TT-05 | P1 | AUTO | Trận thua: hiện màn chọn Pokémon tiếp theo, kết thúc thua, vẫn có 10 vàng | Đúng |
| TT-06, TT-07 | P1 | AUTO | Lỗi tải dữ liệu có nút Thử lại; tab Trò Chơi mở đấu đội cả khi chưa có thẻ; Esc đóng | Đúng |
| UI-11 | P1 | MANUAL (Chrome, dữ liệu PokeAPI thật) | Lập đội, vòng quay mượn, chọn sàn, màn đối đầu, ném Pokéball, trận đấu trên sàn Núi lửa, chọn Pokémon tiếp theo, lễ trao cúp | Không lỗi JS |

Lỗi phát hiện qua ảnh chụp Chrome và đã sửa:
- Nền sàn đấu không hiện ở màn đối đầu, trận đấu và lễ trao cúp. Nguyên nhân 1: class `relative` thắng `absolute` theo thứ tự CSS của Tailwind. Nguyên nhân 2: lệnh sửa đầu tiên vô tình ghi ký tự backspace vào regex. Đã sửa cả hai.
- Nút Tuyệt Kỹ Liên Hoàn trông như bấm được trong lúc chọn Pokémon tiếp theo: giờ mờ đi.
- Bot trong test chọn chiêu thứ 4 cho Pokémon hệ Thường chỉ có 3 chiêu dự phòng. Giao diện không bị lỗi này vì chỉ hiện đúng số chiêu có.

---

## 21. Cài đặt, thao tác vuốt, thêm màn chơi (2026-09-26)

**Cài đặt ⚙️** (nút mới trên thanh đầu trang)
- Công tắc **"Cho phép chọn Pokémon đã quét"** cho Đấu đội 5 vs 5. **Mặc định tắt.**
  - **Tắt:** trong màn lập đội không có danh sách Pokémon đã quét, và có dòng nhắc "Mỗi Pokémon cần được quét thẻ lại". Trong màn quét, chạm vào Pokémon gần đây / nổi tiếng sẽ bị từ chối kèm lời nhắc "Hãy chụp thẻ X bằng camera". Chỉ ảnh chụp thẻ mới thêm được Pokémon vào đội (thiếu thì vẫn được mượn).
  - **Bật:** cho chọn Pokémon trong bộ sưu tập như trước.
- Cài đặt được lưu trên máy (`pokescan_settings_v1`).

**Sút penalty: điều khiển bằng vuốt (không còn chạm hoặc nút bấm)**
- Sút: vuốt lên về phía khung thành. Độ nghiêng quyết định góc (vuốt 45° tới góc khung thành), độ dài quyết định độ cao.
  - Trong lúc vuốt có đường chấm từ bóng tới khung thành và vòng ngắm vàng tại điểm bóng sẽ tới.
  - Chạm nhẹ hoặc vuốt xuống không sút, có lời nhắc "Vuốt lên thật mạnh nhé!".
- Bắt bóng: vuốt trái hoặc phải để bay sang bên, vuốt lên để bắt giữa.
- Có bàn tay động và mũi tên nhún chỉ cách vuốt.

**Đua xe: điều khiển bằng vuốt (bỏ nút Trái / Phải)**
- Vuốt sang trái / phải để đổi làn. Một cú vuốt dài không nhấc tay có thể đổi 2 làn.
- Chạm hoặc vuốt dọc không làm gì. Bàn phím ← → vẫn dùng được.
- Trong lúc đếm ngược có bàn tay động hướng dẫn.

**Thêm màn chơi**
- **Mê cung:** 9 màn trong 3 thế giới. Mỗi thế giới có nền và màu tường riêng.
  - Vườn hoa: 5×5 → 6×7.
  - Rừng rậm: 6×8 → 7×9.
  - Lâu đài băng: 7×9 → 9×11. Quả Pokéball bị khóa 🔒; chìa khóa 🔑 nằm ở ngõ cụt xa nhất, phải nhặt trước. Nút Gợi ý chỉ đường tới chìa khóa trước.
- **Chơi nhạc:** 10 bài trong 3 mức.
  - Dễ: Hot Cross Buns, Au Clair de la Lune, Twinkle.
  - Vừa: Old MacDonald, Mary Had a Little Lamb, London Bridge.
  - Khó: Row Your Boat, Jingle Bells, Ode to Joy, Twinkle cả bài.
- Cả hai có **bản đồ màn chơi**:
  - Mỗi màn hiện số sao cao nhất, tổng sao, và viền vàng ở màn nên chơi tiếp.
  - Màn sau mở khóa khi màn trước có ít nhất 1 sao.
  - Kết thúc màn có nút "Màn tiếp theo" / "Bài tiếp theo".
- **Vàng:** lần đầu hoặc khi phá kỷ lục sao được 5 vàng mỗi sao; chơi lại không phá kỷ lục được 2 vàng. Tiến độ lưu trên máy (`pokescan_progress_v1`).

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| TT-08 | P1 | AUTO | Cài đặt tắt: không có danh sách Pokémon đã quét, có lời nhắc; lối tắt tới thẻ đã lưu trong màn quét bị từ chối; quét thật thì thêm được | Đúng |
| AP-17 | P1 | AUTO | Nút ⚙️ mở Cài đặt; mặc định tắt; bật lên thì lưu và màn lập đội hiện Pokémon đã quét | Đúng |
| PK-05, PK-06 | P1 | AUTO | Vuốt lên: nghiêng quyết định góc, dài quyết định độ cao; vuốt ngắn, vuốt xuống, vuốt ngang không sút; vuốt bay người trái / phải / giữa | Đúng |
| SPT-03, SPT-04 | P1 | AUTO | Penalty: chạm và vuốt xuống không sút, vuốt lên thì sút; không còn nút bay người; vuốt ngang để bắt; cả trận 10 lượt bằng vuốt | Đúng |
| SPT-07 | P1 | AUTO | Đua xe: không có nút; vuốt trái đổi làn; chạm và vuốt dọc không đổi; vuốt dài đổi 2 làn; phím vẫn dùng được | Đúng |
| MZ-03, MZ-05, MZ-06 | P1 | AUTO | 9 màn, 3 thế giới, lớn dần; bot giải cả 9 màn với 3 sao (lấy chìa khóa trước ở lâu đài); tới Pokéball khi chưa có chìa thì vẫn khóa | Đúng |
| MU-01 | P1 | AUTO | 10 bài, mỗi mức ít nhất 3 bài, bài khó dài hơn bài dễ, chỉ dùng 8 phím | Đúng |
| LG-05, LG-05b | P1 | AUTO | Bài 2 bị khóa tới khi xong bài 1; xong bài lưu sao, trả 15 vàng, nút "Bài tiếp theo"; chơi lại không phá kỷ lục trả 2 vàng | Đúng |
| LG-07, LG-07b, LG-08 | P1 | AUTO | Bản đồ mê cung; thắng liên tiếp 3 màn đầu (mỗi màn 15 vàng), màn 4 mở còn màn 5 khóa; lâu đài: nhặt chìa rồi mới thoát | Đúng |
| UI-12 | P1 | MANUAL (Chrome) | Nút và bảng Cài đặt; penalty vuốt có đường ngắm; bắt bóng có mũi tên hướng dẫn; đua xe vuốt đổi làn; bản đồ mê cung, lâu đài có chìa khóa và gợi ý; bản đồ bài nhạc có khóa và sao | Không lỗi JS |

Thay đổi kỹ thuật: `useCanvas` giờ đặt kích thước canvas khi vẽ (trước đây chỉ đặt một lần khi mở game). Nhờ vậy canvas mê cung xuất hiện sau bản đồ màn vẫn sắc nét.

---

## 22. Sửa lỗi: đấu đội báo "Không tải được dữ liệu trận đấu" khi mạng vẫn tốt (2026-09-26)

Nguyên nhân (đã kiểm chứng với PokeAPI thật):
1. **Tra sai tên với Pokémon có nhiều dạng.** Thẻ đã quét được tra bằng tên loài (`speciesName`). Với Pokémon có nhiều dạng, tên loài không phải tên Pokémon trong PokeAPI: `/pokemon/giratina`, `mimikyu`, `lycanroc`, `aegislash`, `deoxys`, `toxtricity` đều trả về 404 (tên đúng là `giratina-altered`...). Lỗi 404 lại hiện thành "kiểm tra mạng". Trận 1v1 cũng dính lỗi này.
2. **Quá nhiều yêu cầu cùng lúc.** Một trận 5 vs 5 cần khoảng 145 yêu cầu (10 Pokémon và chiêu thức của chúng), tất cả được gửi cùng lúc. Bộ đếm giờ 8 giây tính từ lúc gửi, kể cả khi yêu cầu còn đang xếp hàng trong trình duyệt. Vì vậy thi thoảng yêu cầu chính của một Pokémon bị hủy, và cả trận báo lỗi.

Đã sửa:
- Thẻ được tra theo thứ tự: **số Pokédex** (luôn đúng), rồi tên Pokémon, rồi tên loài. Gặp 404 thì thử cách tiếp theo.
- Hàng đợi yêu cầu: tối đa 6 yêu cầu chạy cùng lúc, dữ liệu Pokémon được ưu tiên trước chiêu thức. Thời gian chờ (10 giây) chỉ tính khi yêu cầu thực sự chạy. Lỗi mạng tự thử lại 2 lần.
- Thông báo lỗi tách riêng "Không tìm thấy dữ liệu…" và "Kiểm tra mạng", có kèm tên Pokémon bị lỗi.

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| BD-04 | P1 | AUTO | 404 báo "Không tìm thấy", không báo lỗi mạng | Đúng |
| BD-05, BD-06 | P1 | AUTO | Thẻ Giratina tra bằng số 487, không gọi `/pokemon/giratina`; thẻ cũ không có số thì thử tên tiếp theo sau 404 | Đúng |
| BD-07, BD-08 | P1 | AUTO | Mạng chập chờn 2 lần vẫn tải được; mất mạng thật thì báo kiểm tra mạng | Đúng |
| BD-09 | P1 | AUTO | Tải 10 Pokémon: không bao giờ quá 6 yêu cầu cùng lúc | Đúng |
| UI-13 | P1 | MANUAL (Chrome, PokeAPI thật, xóa bộ nhớ đệm) | Đội Giratina, Mimikyu, Lycanroc, Aegislash, Pikachu: bắt đầu trận 3 lần liên tiếp | 3/3 vào trận (khoảng 145 yêu cầu mỗi lần), không lỗi |

---

## 23. Penalty không gợi ý hướng sút; tăng nhẹ độ khó bowling và đua xe (2026-09-26)

**Penalty, lượt bé bắt bóng:** đã bỏ bong bóng "👀 + mũi tên", ba mũi tên ← ↑ →, và dáng nghiêng người để lộ hướng sút của đối thủ. Bé phải tự đoán. Chỉ còn bàn tay động minh họa thao tác vuốt, và dòng chữ "Đoán xem X sút về đâu…".

**Độ khó** (đo bằng mô phỏng với random cố định, giống các mục trước):

| Game | Thay đổi | Trước | Sau |
|---|---|---|---|
| Bowling | Máy ngắm chuẩn hơn (độ lệch 1.1 → 1.0), ném mạnh hơn (lực tối thiểu 0.2 → 0.28) | Bé chạm bừa thắng 39%, canh mũi tên thắng 74%; máy trung bình 7.0 ki mỗi lượt đầu | 31% / 67%; máy 7.4 ki |
| Đua xe | Đối thủ nhanh hơn (142/148/153 thay vì 140/146/151), né chướng ngại giỏi hơn (72% → 78%) | Bé biết né về nhất 48%, top 3 91%; không điều khiển về nhất 25% | 39% / 84%; 15% |

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| SPT-03 | P1 | AUTO | Lượt bắt bóng không có bong bóng hướng nhìn, không có mũi tên hướng, dòng chữ là "Đoán xem" | Đúng |
| BW-08 | P1 | AUTO | Chạm bừa thắng 30–36%, canh mũi tên thắng ≥65% | Đúng |
| RC-03 | P1 | AUTO | Bé biết né về nhất 33–45%, luôn nhiều hơn khi không điều khiển; không điều khiển vẫn vào top 3 trên 30% | Đúng |
| GH-01 | P2 | AUTO | Sửa test chạy lúc đạt lúc không: game đoán bóng trên cùng trang có thể hiện chữ "Pikachu", nên test giờ chỉ kiểm tra rằng không có Pokémon chạy nhảy mặc định | Đúng (chạy 3 lần liên tiếp) |

---

## 24. Sân vận động Pokémon (5 vs 5) và hạng Pokémon mở khóa trò chơi (2026-09-26)

**Sàn mới: 🏟️ Sân vận động Pokémon** (đứng đầu danh sách và được chọn sẵn)
- Tăng sức mạnh chiêu hệ Giác đấu và Thường.
- Cảnh sân vận động: khán đài kín khán giả nhún nhảy cổ vũ, hai tháp đèn pha, màn hình lớn "POKÉMON LEAGUE", vạch sân và Pokéball giữa sân, đèn flash máy ảnh lóe trên khán đài và pháo giấy.
- Đã sửa thanh tiêu đề đấu đội bị xuống dòng khi tên sàn dài.

**Hạng Pokémon** (`utils/pokemonRank.js`)
- Sức mạnh = máu + tấn công + phòng thủ + tốc độ gốc, là các chỉ số đã lưu trên thẻ.
- Số liệu đo trên PokeAPI thật: Pichu 135, Pikachu 220, Charmeleon 260, Gengar 295, Charizard 340, Snorlax 365, Dragonite 400, Mewtwo 436, Arceus 480.

| Hạng | Sức mạnh | Ví dụ | Số trò (trên 14) |
|---|---|---|---|
| 🥉 Đồng | < 250 | Pichu, Pikachu, Eevee, các starter | 5: Ném bóng, Chạy nhảy, Mê cung, Toán, Tiếng Anh |
| 🥈 Bạc | 250–329 | Charmeleon, Gengar, Raichu, Venusaur | 9: thêm Bếp, Cửa hàng, Nhớ thứ tự, Chơi nhạc |
| 🥇 Vàng | 330–399 | Charizard, Lucario, Snorlax, Gyarados | 12: thêm Đấu Pokémon, Bowling, Penalty |
| 💎 Huyền thoại | ≥ 400 | Dragonite, Mew, Mewtwo | 14: thêm Bóng rổ, Đua xe |

- **Lên hạng thêm:** thẻ Shiny được +1 hạng; thân thiết đạt "Tri kỷ" (≥ 80) được +1 hạng. Vì vậy bé chăm Pokémon yếu mình thích (ví dụ Pikachu) vẫn mở được nhiều trò hơn.
- Thẻ cũ chưa lưu chỉ số được tính là hạng Bạc.
- Các trò học tập (Mê cung, Toán, Tiếng Anh) mở cho mọi Pokémon.
- Đấu đội 5 vs 5 và game đoán bóng không giới hạn theo hạng.
- Giao diện:
  - Huy hiệu hạng trên khung "Pokémon của bé".
  - Nút "Chơi cùng X · 5/14 trò".
  - Bảng chọn game ghi hạng và số trò đã mở. Trò bị khóa hiện xám kèm ổ khóa và hạng cần có; bấm vào thì hiện cách lên hạng.
  - Tab Trò Chơi: hạng hiện dưới từng Pokémon, ô trò bị khóa ghi hạng cần có.

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| RK-01..04 | P1 | AUTO | Pokémon thật vào đúng hạng; Shiny và Tri kỷ cộng hạng, tối đa Huyền thoại; thẻ cũ là Bạc; hạng càng cao càng nhiều trò, trò học tập luôn mở | Đúng |
| RK-05 | P1 | AUTO | Huy hiệu hạng; "1/2 trò"; bấm trò bị khóa không chạy game mà hiện hướng dẫn "Tri kỷ"; trò được mở thì chạy | Đúng |
| GH-05, SPT-09 | P1 | AUTO | Tab Trò Chơi: Pichu (Đồng) chỉ mở trò hạng Đồng, các ô khác ghi hạng cần có; đổi sang Mewtwo thì mở đua xe; Charizard (Vàng) chơi Bowling và Penalty, còn Bóng rổ và Đua xe bị khóa | Đúng |
| AR-01, TT-03 | P1 | AUTO | 7 sàn, Sân vận động đứng đầu và được chọn sẵn | Đúng |
| UI-14 | P1 | MANUAL (Chrome, PokeAPI thật) | Bảng chọn game của Pikachu (5/14, có thông báo khóa), trận đấu trên Sân vận động | Không lỗi JS |

---

## 25. Lật thẻ tìm cặp, Nhảy theo nhạc, Giải đấu Liên minh, Đấu trường Pokémon (2026-09-26)

**🃏 Lật thẻ tìm cặp** (nhóm Trí tuệ, hạng Đồng)
- 3 màn liên tiếp: hình giống nhau (6 cặp) → hình và bóng đen (8 cặp) → Pokémon và hệ của nó (8 cặp, mỗi Pokémon một hệ khác nhau).
- Thẻ lật 3D. Cặp đúng thì phát sáng vàng và có tiếng xu; cặp sai thì rung rồi úp lại sau 0,9 giây.
- Sao tính theo số lượt so với số cặp; vàng trả 1 lần khi xong cả 3 màn.

**💃 Nhảy theo nhạc** (nhóm Trí tuệ, hạng Bạc)
- 4 bài: Bánh nóng giòn, Ngôi sao lấp lánh, Chú cừu nhỏ, Khúc hoan ca.
- Nốt nhạc rơi xuống 4 làn (nốt thấp bên trái, nốt cao bên phải) trong 2,2 giây. Bé chạm làn đúng lúc nốt chạm vòng (PERFECT ±0,13 giây, GOOD ±0,28 giây).
- Mỗi lần trúng phát đúng nốt của bài, nên chơi tốt là "đánh" được cả giai điệu.
- Có combo và điểm thưởng theo combo; mỗi 10 combo có pháo hoa. Pokémon nhảy múa.
- Điều khiển: nút làn, chạm vào làn trên sân khấu, hoặc phím ← ↓ ↑ → / D F J K.
- Sao tính theo độ chính xác.

**🏆 Giải đấu Liên minh** (nhóm Vui chơi, hạng Bạc, cần thẻ đã lưu)
- Chơi một mạch: 8 nhà thi đấu (Đá · Nước · Điện · Cỏ · Độc · Siêu linh · Lửa · Đất) rồi đến Nhà Vô địch (Dragonite). Đối thủ mạnh dần (×0,85 → ×1,12 so với cấp cân bằng).
- Dùng lại màn đấu 1v1, tiêu đề là tên nhà thi đấu.
- Thắng: huy hiệu bay vào hộp huy hiệu kèm vàng (10 → 24; Nhà Vô địch 60), rồi có nút sang nhà tiếp theo ngay.
- Thua: lời khuyên về hệ, có nút thử lại ngay.
- Hạ Nhà Vô địch thì có lễ đăng quang: cúp, đèn rọi và đủ 9 huy hiệu.

**🗺️ Đấu trường Pokémon** (banner ở tab Trò Chơi; không giới hạn hạng)
- Chơi màn ngang, thời gian thực. Khi điện thoại cầm dọc, cả trận và bảng tổng quan tự xoay 90°. Ứng dụng cũng thử bật toàn màn hình và khóa hướng ngang trên các máy hỗ trợ.
- **Lập đội:** giống Đấu đội 5 vs 5 (quét thẻ, mượn ngẫu nhiên, theo cài đặt "Cho phép chọn Pokémon đã quét").
- **Chuẩn bị:** chọn thời gian trận (1 / 2 / 3 / 5 phút, nhớ lựa chọn) và Pokémon điều khiển đầu tiên; xem trước đội đối thủ và cách chơi.
- **Bản đồ** 1600×900, hai nửa đối xứng:
  - Mỗi đội có nhà chính: bệ đá có biểu tượng Pokéball và pha lê phát sáng. Trong nhà chính, đồng đội được hồi máu còn đối phương bị mất máu.
  - Sông giữa bản đồ có 3 cầu gỗ tạo thành 3 đường đất.
  - Cây tròn, cây thông, đá chặn đường và chặn đạn; bụi cây chỉ để trang trí. Có hoa, cỏ, sóng nước lấp lánh và bản đồ nhỏ.
- **Điều khiển:**
  - Joystick nổi (chạm nửa trái màn hình) hoặc phím WASD / mũi tên.
  - Tự đánh thường khi đối thủ ở gần.
  - Chiêu 1 là đạn xuyên (phím Q), chiêu 2 là vòng nổ đẩy lùi (phím E), ⚡ Tuyệt kỹ liên hoàn khi đầy năng lượng (phím R hoặc Space).
  - Chạm chân dung đồng đội (hoặc phím 1–5) để đổi Pokémon điều khiển; các Pokémon còn lại do máy điều khiển.
- **Chiêu thức theo hệ:** 18 hệ, mỗi hệ có tên chiêu riêng (ví dụ Lửa: Tàn lửa, Phun lửa, Vòng lửa, Hỏa Long Liên Hoàn). Sát thương tính theo khắc hệ.
- **Tuyệt kỹ:** lướt tới mục tiêu để lại bóng mờ, rồi 4 đòn liên tiếp với số x1 → x4!!. Có chậm hình và viền tối, chớp sáng, rung màn hình, camera phóng to, vòng nổ trắng ở đòn cuối, và dòng tên Tuyệt kỹ.
- **Hạ gục:**
  - Có bảng tin hạ gục, thông báo "HẠ GỤC ĐẦU TIÊN" và "HẠ GỤC ĐÔI / TAM SÁT / TỨ SÁT / HUYỀN THOẠI".
  - Pokémon gục hồi sinh ở nhà chính sau 5 giây (cột sáng); chân dung hiện đếm ngược.
- **Hết giờ:** đội có nhiều mạng hạ gục hơn thắng, bằng nhau là hòa.
- **Bảng tổng quan:** tỉ số, thời gian, hai cột đội. Mỗi Pokémon có H/C/HT (hạ gục / chết / hỗ trợ), thanh sát thương gây ra, sát thương nhận vào, lượng hồi máu và huy hiệu MVP.
- **Vàng:** thắng 40, hòa 25, thua 15, cộng 1 cho mỗi mạng đội bé hạ gục (tối đa +20). Có nút đấu lại.
- **Cân bằng** (bot tự đấu 16 trận 3 phút, bot điều khiển cả Pokémon của bé): đội bé thắng 63%, khoảng 26 mạng mỗi trận (một pha hạ gục mỗi khoảng 7 giây). Đội bé được hỗ trợ nhẹ (sát thương 1,02 so với 0,99; máy đối thủ tung chiêu ít hơn một chút), vì [Inference] trẻ thật có thể điều khiển kém bot.

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| PR-01, PR-02, NG-01 | P1 | AUTO | Mỗi cặp đúng 2 thẻ, màn hệ không trùng hệ; cặp sai úp lại; giải cả 3 màn thì trả 15 vàng 1 lần | Đúng |
| RH-01..04, NG-02, NG-03 | P1 | AUTO | Bản nhạc đúng thứ tự thời gian; chạm đúng lúc là PERFECT, trễ là GOOD, quá trễ hoặc sai làn không tính; nốt bị bỏ là MISS và mất combo; bé chạm gần đúng (±0,2 giây, 80% nốt) được ≥2 sao; chơi hết bài thì trả vàng, không chạm gì vẫn kết thúc | Đúng |
| LE-01, LE-02, NG-04, NG-05 | P1 | AUTO | 8 nhà thi đấu khác hệ, mạnh dần, rồi Nhà Vô địch; thua ở lại nhà đó; thắng hết thì 9 huy hiệu, trả vàng 9 lần, có lễ đăng quang; thua thì có nút thử lại | Đúng |
| MB-01..05 | P1 | AUTO | Bản đồ đối xứng, sông chỉ qua được ở cầu; bot đi vòng qua cầu và cây; chỉ số được nén lại; chiêu 1, chiêu 2 đẩy lùi, Tuyệt kỹ lướt và 4 đòn; hạ gục tính điểm, hồi sinh sau 5 giây; 16 trận bot: kết thúc đúng giờ, ai cũng rời nhà, 15–45 mạng, đội bé thắng 50–90% | Đúng (63%, 26 mạng) |
| MG-01..04 | P1 | AUTO | Màn chuẩn bị (thời gian, Pokémon điều khiển, đội đối thủ); trận 1 phút: đếm ngược, đổi Pokémon, bấm chiêu, phím WASD, bảng tổng quan 10 dòng có MVP, vàng trả 1 lần đúng số; banner ở tab Trò Chơi | Đúng |
| UI-15 | P1 | MANUAL (Chrome) | Đấu trường ở màn ngang 915×412 và điện thoại cầm dọc 412×860 (tự xoay), trận thật 1 phút, Tuyệt kỹ, bảng tổng quan; Lật thẻ; Nhảy theo nhạc; bản đồ Liên minh và trận Nhà thi đấu Đá với PokeAPI thật | Không lỗi JS |

Lỗi phát hiện qua ảnh chụp Chrome và đã sửa:
- Thông báo "+vàng" chung đè lên bảng tổng quan: Đấu trường giờ nằm ở lớp trên cùng (bảng tổng quan đã có phần thưởng vàng riêng).
- Bảng tổng quan không xoay khi điện thoại cầm dọc: dùng chung khung xoay ngang với trận đấu.
- Nhảy theo nhạc: hình Pokémon che các nốt mới rơi, đã thu nhỏ và làm hơi trong suốt.
- Test App (AP-01/02/04) chạy lúc đạt lúc không khi chạy cả bộ test cùng các trận mô phỏng: thời gian chờ trong hàm hỗ trợ quét của test được tăng lên 5 giây. Đây là lỗi của test, không phải của ứng dụng. Đã chạy cả bộ 2 lần liên tiếp đều đạt.

---

## 26. Đấu trường: chiêu hồi 0,5 giây, bỏ hiệu ứng giật màn hình, Tốc biến, bỏ sông (2026-09-26)

- **Chiêu 1 và 2 hồi sau 0,5 giây** (trước đây 3,5 và 7 giây). Để trận không quá dồn dập, sát thương mỗi lần giảm (chiêu 1: 2,3 → 1,2; chiêu 2: 2,5 → 1,1; lực đẩy lùi nhỏ hơn).
- **Bỏ mọi hiệu ứng làm giật màn hình:** rung màn hình khi trúng đòn, rung và phóng to camera khi dùng Tuyệt kỹ hay đòn liên hoàn, chậm hình kèm viền tối, chớp trắng toàn màn hình. Camera chỉ đi theo Pokémon một cách êm. Hiệu ứng combo vẫn còn nhưng chỉ nằm quanh Pokémon: vòng sáng, hạt, số x1–x4, bóng lướt và tên Tuyệt kỹ.
- **💨 Tốc biến** (nút riêng, phím F hoặc Shift):
  - Dịch chuyển 170 đơn vị theo hướng đang đi (hoặc hướng đang nhắm). Không bao giờ đáp vào trong cây hay đá: tự rút ngắn tới chỗ trống xa nhất.
  - Hồi sau 10 giây, nút hiện vòng đếm ngược.
  - Hiệu ứng: bóng mờ ở chỗ cũ, vệt sáng nối hai điểm, bụi sáng ở hai đầu, vòng sáng nơi đáp.
  - Máy cũng biết dùng: tốc biến chạy về khi máu dưới 25% và đang bị đuổi, hoặc tốc biến lao tới Pokémon đối thủ sắp gục.
- **Bỏ dòng sông:** giữa bản đồ giờ là bãi đất trống có vòng đá và huy hiệu Pokéball vẽ trên nền, thêm 2 tảng đá ở giữa các đường để giữ cấu trúc 3 đường. Máy đi thẳng qua giữa bản đồ, không còn phải đi vòng qua cầu.
- **Sửa lỗi phát hiện nhờ test mới:** nếu một Pokémon bị đẩy đúng vào tâm cây hay đá, hàm đẩy ra không biết hướng nên để Pokémon kẹt trong đó. Nay có hướng dự phòng.
- **Cân bằng sau thay đổi** (16 trận bot 3 phút): đội bé thắng 56%, khoảng 23 mạng mỗi trận. Cả hai nằm trong khoảng mục tiêu (thắng 50–90%, 15–45 mạng).

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| MB-01, MB-02 | P1 | AUTO | Bản đồ đối xứng không có sông, giữa các đường là đất trống, đá giữa bản đồ vẫn chặn; máy đi thẳng qua giữa | Đúng |
| MB-06 | P1 | AUTO | Chiêu 1 và 2 hồi sau 0,5 giây; Tốc biến dịch chuyển 170 đơn vị, không dùng lại được trước 10 giây; không đáp vào trong cây | Đúng |
| MB-05 | P1 | AUTO | 16 trận bot: kết thúc đúng giờ, ai cũng rời nhà, 15–45 mạng, đội bé thắng 50–90% | 56%, 23 mạng |
| MG-02 | P1 | AUTO | Trong trận bấm Tốc biến thì nút hiện đếm ngược 10 giây | Đúng |
| UI-16 | P1 | MANUAL (Chrome) | Trận thật: không rung hay giật màn hình khi có combo hoặc Tuyệt kỹ; Tốc biến có vệt sáng; bản đồ không có sông | Không lỗi JS |

---

## 27. Nút Nhảy theo nhạc, Liên minh 5 vs 5, tên Tuyệt kỹ gọn, nút Quét thẻ mới (2026-09-26)

- **Nút Nhảy theo nhạc:** 4 nút tròn có viền màu theo làn, lòng nút dạng kính và mũi tên vẽ bằng vector (trái / xuống / lên / phải). Nút lún xuống khi bấm. Vòng đích và nốt nhạc trên nền cũng dùng mũi tên vector thay cho emoji. Nhãn cho trình đọc màn hình: "Làn N (Trái|Xuống|Lên|Phải)".
- **Giải đấu Liên minh giờ đấu 5 vs 5:**
  - Lập đội như Đấu đội 5 vs 5: quét thẻ, máy cho mượn ngẫu nhiên chỗ còn trống, và chỉ được chọn Pokémon đã quét khi phụ huynh bật cài đặt.
  - Mỗi nhà thi đấu có đội 5 Pokémon, át chủ bài ra cuối. Nhà Vô địch dùng đội hệ Rồng.
  - Sàn đấu hợp với hệ của nhà thi đấu (ví dụ nhà Lửa đấu ở Núi lửa, nhà Nước ở Đại dương). Nếu không có sàn nào hợp thì đấu ở Sân vận động.
  - Độ mạnh đối thủ tăng dần qua các nhà (0,80 → 1,05), cộng thêm hệ số chung của chế độ đội.
  - Thưởng 20 + 3 × thứ tự nhà thi đấu; Nhà Vô địch thưởng 80.
  - Liên minh nay là một banner trong tab Trò chơi, không còn nằm trong danh sách trò chơi theo từng Pokémon và không còn bị khóa theo hạng.
  - Phần tải trận đấu và màn giới thiệu VS được tách ra dùng chung (loadTeam.js, TeamIntro.jsx).
- **Đấu trường: tên Tuyệt kỹ gọn hơn.** Tên hiện thành một nhãn nhỏ ngay dưới bảng tỉ số thay vì chữ to giữa màn hình. Thông báo lớn giữa màn hình (hạ gục, hết giờ...) vẫn giữ nguyên.
- **Nút nổi "Quét thẻ mới" (điện thoại):** nút dạng viên thuốc màu đỏ sang cam, có biểu tượng Pokéball trong vòng tròn trắng với hiệu ứng tỏa sóng. Pokéball xoay khi bấm.

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| NG-02, NG-03 | P1 | AUTO | Nhảy theo nhạc với 4 nút mới: bấm đúng nhịp thì PERFECT hoặc GOOD, bỏ qua thì MISS | Đúng |
| LE-01 | P1 | AUTO | 9 đội đều có 5 Pokémon khác nhau, át chủ bài ra cuối; nhà Lửa → Núi lửa, nhà Nước → Đại dương, nhà Độc → Sân vận động | Đúng |
| NG-04 | P1 | AUTO | Đội 5 thắng lần lượt 9 đội 5: tải đúng đội của từng nhà, nhận thưởng 9 lần, đủ 9/9 huy hiệu, có lễ Nhà Vô địch | Đúng |
| NG-05 | P1 | AUTO | Tắt cài đặt thì bắt buộc quét thẻ; thua thì không có thưởng và bấm "Thử lại" được | Đúng |
| UI-17 | P2 | MANUAL (Chrome) | Xem nút nhạc, nút Quét thẻ mới, đường Liên minh, màn VS, trận 5 vs 5, nhãn Tuyệt kỹ nhỏ ở Đấu trường | Hiển thị đúng, không lỗi JS |

---

## 28. Đấu trường: hiệu ứng chiêu 1 và 2 theo từng hệ (2026-09-26)

- Hiệu ứng mới nằm trong `src/components/moba/skillFx.js`. Mỗi hệ có một kiểu riêng: Lửa, Nước, Băng, Điện, Cỏ/Bọ, Huyền bí (Siêu linh/Tiên/Ma/Bóng tối/Độc), Đá (Đá/Đất/Thép/Giác đấu), Gió (Thường/Bay/Rồng).
- **Chiêu 1 (phóng):**
  - Lúc tung chiêu: chớp sáng hình nón ở tay, Pokémon phồng nhẹ, dưới chân có quầng màu theo hệ.
  - Đường bay: vệt sáng như dải lụa, quầng sáng quanh đạn, dọc đường rơi hạt theo hệ.
  - Hình đạn theo hệ:
    - Lửa: sao chổi có lưỡi lửa lập lòe.
    - Nước: bong bóng có giọt nước xoay quanh.
    - Điện: tia chớp nổ lách tách.
    - Cỏ/Bọ: phi tiêu 3 lá xoay.
    - Băng: bông tuyết pha lê.
    - Huyền bí: quả cầu tối có sao bay quanh.
    - Đá: tảng đá lăn.
    - Gió: 2 lưỡi gió hình trăng khuyết.
  - Khi trúng đích hoặc bay hết tầm: nổ hình ngôi sao 8 cánh kèm vòng sáng.
- **Chiêu 2 (quanh mình):**
  - Đĩa sáng trên mặt đất đúng bằng vùng trúng đòn, 2 vòng sóng xung kích.
  - Phần riêng theo hệ:
    - Lửa: vòng cột lửa bùng lên.
    - Băng và Đá: gai nhọn trồi lên từ mép rồi thụt xuống.
    - Điện: 7 tia sét lóe từ Pokémon ra mép.
    - Huyền bí: vòng phép có sao 5 cánh và chấm ký tự xoay.
    - Cỏ và Gió: xoáy lốc.
    - Nước: bắn tung giọt nước.
- Hạt có nhiều hình (lửa, giọt, tia, lá, mảnh băng, sao, đá, khói) và có trọng lực riêng: tàn lửa bay lên, giọt nước và đá rơi xuống. Giới hạn 700 hạt để máy yếu vẫn mượt.
- Không có hiệu ứng nào làm rung, phóng to hay chớp toàn màn hình.

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| MB-01..06, MG-01..02 | P1 | AUTO | Test Đấu trường hiện có vẫn đạt (sự kiện 'cast' có thêm vị trí và hướng, 'pop' có thêm id đạn) | Đạt |
| UI-18 | P1 | MANUAL (Chrome) | Lần lượt điều khiển Charizard, Pikachu, Lapras, Gengar, Lucario và bấm chiêu 1, chiêu 2 | Mỗi hệ một kiểu hiệu ứng riêng, không lỗi JS |

---

## 29. Đấu trường: chọn chế độ 1 vs 1, 3 vs 3 hoặc 5 vs 5 (2026-09-26)

- **Chọn chế độ** ở đầu màn lập đội: 3 thẻ 🥊 1 vs 1 (Đấu tay đôi), ⚔️ 3 vs 3 (Đội nhỏ), 🏟️ 5 vs 5 (Đội đầy đủ). Mặc định 5 vs 5 và lần sau mở lại vẫn nhớ chế độ đã chọn (`pokescan_moba_mode`).
- Số ô trong đội, lời "Lập đội hình N Pokémon", số Pokémon cho mượn và số đối thủ đều theo chế độ. Đổi sang chế độ nhỏ hơn thì chỉ giữ lại những Pokémon đầu tiên.
- Tiêu đề hiện chế độ đang chơi (ví dụ "1 vs 1"). Ở 1 vs 1 không hiện lời nhắc đổi Pokémon.
- **Trong trận:**
  - Pokémon đứng thành hình quạt trước nhà chính, căn giữa theo số lượng.
  - Máy chia đường: 1 Pokémon đi đường giữa; 3 Pokémon mỗi Pokémon một đường; 5 Pokémon như cũ.
- **Nhịp trận (`PACE`):** ít Pokémon thì ít va chạm, nên đòn mạnh hơn (1 vs 1: ×1,8; 3 vs 3: ×1,25; 5 vs 5: ×1). Kết quả mô phỏng bot, trận 2 phút:
  - 1 vs 1: trung bình 3,7 lần hạ gục; đội bé thắng 5/6 trận.
  - 3 vs 3: trung bình 11,5 lần hạ gục; đội bé thắng 6/6 trận.
  - 5 vs 5 không đổi: 56% thắng, khoảng 23 lần hạ gục mỗi trận 3 phút.
  - Mẫu chỉ 6 trận cho mỗi chế độ nên tỉ lệ thắng mới là ước lượng.
- Công thức vàng không đổi (thắng / hòa / thua + số lần hạ gục, tối đa 20).

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| MB-07 | P1 | AUTO | Vị trí xuất phát căn giữa cho 1 và 3 Pokémon; 6 trận bot mỗi chế độ 1 vs 1 và 3 vs 3: kết thúc đúng giờ, ai cũng rời nhà, bảng tổng kết có đủ 2 hoặc 6 dòng, đủ số lần hạ gục, đội bé thắng ít nhất 3/6 | Đạt |
| MG-05 | P1 | AUTO | Chọn 3 vs 3 thì còn 3 ô (đội đã đủ, không còn nút cho mượn); chọn 1 vs 1 thì còn 1 ô, chế độ được lưu; đối thủ có 1 Pokémon; đấu xong bảng tổng kết có 2 dòng | Đạt |
| MB-05, MG-01, MG-02 | P1 | AUTO | 5 vs 5 vẫn như cũ | Đạt |
| UI-19 | P2 | MANUAL (Chrome) | Thẻ chọn chế độ, lập đội 3 và 1 Pokémon, màn chuẩn bị 1 vs 1, trận 1 vs 1 | Hiển thị đúng, không lỗi JS |

---

## 30. Chuyển trang luôn về đầu trang (2026-09-26)

- Khi chuyển tab (Quét thẻ, Bộ sưu tập, Trò chơi) hoặc mở trang chi tiết của một Pokémon khác, trang luôn cuộn về đầu ngay lập tức, không còn dừng ở giữa trang như trước.

| ID | Ưu tiên | Loại | Kịch bản | Kết quả mong đợi |
|---|---|---|---|---|
| AP-18 | P1 | AUTO | Bấm tab Bộ sưu tập rồi tab Trò chơi | Mỗi lần chuyển đều gọi cuộn về vị trí 0 |
| UI-20 | P1 | MANUAL (Chrome) | Cuộn xuống 1200px rồi bấm Bộ sưu tập; cuộn xuống 600px rồi mở Charizard | Cả hai lần vị trí cuộn đều là 0 |
