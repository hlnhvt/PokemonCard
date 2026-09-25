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