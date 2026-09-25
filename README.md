# ⚡ PokeScan AR - Ứng Dụng Quét Thẻ Bài Pokémon & Pokedex TCG

Ứng dụng Web App tối ưu cho thiết bị di động (Responsive Mobile & Desktop), xây dựng bằng **Vite**, **React**, **Tailwind CSS v3** và lưu trữ dữ liệu tự động với **LocalStorage**.

---

## 🌟 Các Tính Năng Nổi Bật

1. **Quét Thẻ Bài Bằng Camera Điện Thoại (AR Scanner Viewfinder)**:
   - Khung ngắm chuẩn tỉ lệ thẻ bài Pokémon (63/88) với 4 góc căn chỉnh holographic và hiệu ứng tia quét laser.
   - Hỗ trợ đổi Camera trước/sau, chụp ảnh trực tiếp từ camera.
   - Hỗ trợ tải ảnh thẻ bài từ thư viện máy hoặc chụp snapshot.
   - **Bộ Thẻ Mẫu Sắc Nét (Quick Test Deck)**: 8 thẻ bài siêu hiếm (Charizard VMAX, Pikachu VMAX, Mewtwo VSTAR, Rayquaza VMAX, Gengar VMAX, Greninja ex, Lucario VSTAR, Blastoise VMAX) bấm là quét ngay để thử nghiệm nhanh mà không cần thẻ thật.

2. **Video Ngắn Trình Diễn Ấn Tượng (Cinematic Video Showcase)**:
   - Khi quét trúng thẻ bài, màn hình chuyển sang chế độ chiếu Video ngắn đậm chất điện ảnh.
   - Hiệu ứng hạt năng lượng phát sáng đa chiều (Canvas FX) đồng bộ theo hệ nguyên tố (Lửa, Điện, Tâm linh, Rồng,...).
   - Âm thanh sống động được mô phỏng qua Web Audio API (Tiếng quét radar, tiếng tích điện, tiếng gầm chiến đấu của Pokémon).
   - Thanh đếm tiến trình (Progress Bar) và nút "Bỏ qua" để vào thẳng chỉ số thẻ.

3. **Thông Tin Chi Tiết Thẻ Bài & Hiệu Ứng 3D Holographic Foil**:
   - Thẻ bài 3D tương tác: nghiêng theo chuyển động ngón tay (Touch / Gyro trên Mobile) hoặc con trỏ chuột trên Desktop, kèm dải cầu vồng phản quang chân thực (`holo-foil`).
   - Đầy đủ thông số TCG: Lượng máu (HP), Hệ thuộc tính (Fire, Water, Lightning,...), Độ hiếm (Secret Rare, Ultra Rare), Bộ thẻ & số hiệu.
   - Chiêu thức tấn công & Kỹ năng đặc biệt (VSTAR Power / Ability) kèm lượng sát thương chi tiết.
   - Điểm yếu (Weakness), Kháng cự (Resistance), Phí rút lui (Retreat Cost), Họa sĩ và cốt truyện Pokédex Lore.
   - Nút nghe lại tiếng gầm và xem lại video bất kỳ lúc nào.

4. **Lưu Trữ Tự Động Vào LocalStorage (Pokedex Collection)**:
   - Sau khi chiếu xong video, thẻ bài được tự động lưu vào `LocalStorage` của thiết bị.
   - Ghi nhận thời điểm quét đầu tiên, thời điểm quét gần nhất và **bộ đếm số lần quét**.
   - Tab **Bộ Sưu Tập**: Xem danh sách các thẻ đã sở hữu, lọc theo hệ thuộc tính, tìm kiếm theo tên hoặc mã số, đánh dấu thẻ yêu thích (Favorites).

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### 1. Khởi động máy chủ phát triển
```bash
npm install
npm run dev -- --host
```

### 2. Mở trên trình duyệt máy tính:
Truy cập: [http://localhost:5173/](http://localhost:5173/)

### 3. Mở trên điện thoại di động (Mobile):
- Đảm bảo điện thoại kết nối cùng mạng Wi-Fi với máy tính.
- Mở trình duyệt trên điện thoại và nhập địa chỉ mạng cục bộ (ví dụ: `http://10.15.189.64:5173/` hoặc IP hiển thị trên terminal).
- Cấp quyền Camera khi trình duyệt yêu cầu để bắt đầu quét trực tiếp thẻ thật!
