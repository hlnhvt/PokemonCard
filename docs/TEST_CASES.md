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