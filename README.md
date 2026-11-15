# Hướng dẫn truy cập các dịch vụ trên Ubuntu

**IP máy Ubuntu:** `192.168.100.2`

Thay vì sử dụng IP động, các địa chỉ bên dưới đã được cấu hình sẵn theo IP máy Ubuntu `192.168.100.2`.

Mở trình duyệt trên máy thật (Windows) và truy cập các địa chỉ tương ứng.

## 1. Bảng cổng dịch vụ

| Thành phần | Cổng | Địa chỉ truy cập từ máy thật | Ghi chú |
|---|---:|---|---|
| **Studio FE** (giao diện chat) | **8080** | `http://192.168.100.2:8080` | Cổng chính của hệ thống |
| **phpMyAdmin** | **8081** | `http://192.168.100.2:8081` | User `root`, mật khẩu = `DB_ROOT_PASS` trong `.env` |
| **API của Studio** (data-service) | **5000** | `http://192.168.100.2:5000/health` | Dùng để kiểm tra API |
| **Web con** (do AI tạo) | **7000–7100** | `http://192.168.100.2:70xx` | Mỗi web được cấp một cổng riêng |
| **AI Service** (Python) | 8000 | Không truy cập trực tiếp | Chỉ giao tiếp nội bộ giữa các container |
| **MySQL của Studio** | 3306 | Không truy cập trực tiếp | Quản lý thông qua phpMyAdmin |

## 2. Chi tiết từng thành phần

### 2.1. Studio FE – Cổng 8080

- Địa chỉ: `http://192.168.100.2:8080`
- Nginx phục vụ giao diện frontend.
- Nginx chuyển tiếp các request `/api/...` đến data-service.
- Frontend không cần hardcode IP của backend.
- Người dùng chỉ cần truy cập cổng `8080` để sử dụng hệ thống.

### 2.2. API Studio – Cổng 5000

- Địa chỉ kiểm tra: `http://192.168.100.2:5000/health`
- Cổng này được mở ra ngoài để thuận tiện cho việc debug và kiểm tra API.
- Ví dụ sử dụng:

```bash
curl http://192.168.100.2:5000/health
```

Kết quả mong đợi:

```json
{
  "ok": true
}
```

**Lưu ý:** Người dùng thông thường không cần truy cập cổng này.

Nếu muốn ẩn API khỏi mạng bên ngoài, có thể xóa phần `ports` của service `data-service` trong `docker-compose.yml`. Frontend vẫn hoạt động bình thường thông qua Nginx tại cổng `8080`.

### 2.3. phpMyAdmin – Cổng 8081

- Địa chỉ: `http://192.168.100.2:8081`
- Tài khoản: `root`
- Mật khẩu: Giá trị `DB_ROOT_PASS` trong file `.env`.

phpMyAdmin chỉ dùng để quản lý database của **Studio**, bao gồm:

- Users
- Conversations
- Specs
- Runs
- Các dữ liệu khác của Studio.

**Lưu ý:** Database của từng web con nằm trong container riêng, không được quản lý trực tiếp thông qua phpMyAdmin của Studio.

### 2.4. Web con do AI tạo – Cổng 7000–7100

- Dải cổng: `7000–7100`.
- Địa chỉ truy cập: `http://192.168.100.2:70xx`.
- Mỗi web con được cấp một cổng riêng.

**Cơ chế hoạt động:**

- Cổng bên ngoài là cổng Web (Nginx).
- API và MySQL của web con không mở trực tiếp ra bên ngoài.
- Các thành phần này chỉ giao tiếp trong mạng nội bộ của project tương ứng.
- Web con gọi API thông qua:

```text
http://192.168.100.2:70xx/api/...
```

Nginx của web con tự động chuyển tiếp request đến container `api`.

Do đó, web con không cần mở thêm cổng API riêng.

**Cách xem cổng của từng web con:**

1. Truy cập Studio.
2. Mở tab **Tiến trình & Preview**.
3. Xem địa chỉ trong iframe hoặc sử dụng nút **Mở tab mới**.

Ngoài ra, có thể xem cổng tại trang **Lịch sử**, trong cột **Cổng**.

**Tài khoản Admin demo của web con:**

| Thông tin | Giá trị |
|---|---|
| Email | `admin@shop.local` |
| Mật khẩu | `admin123` |

### 2.5. AI Service – Cổng 8000

- Cổng nội bộ: `8000`.
- Chạy service Python xử lý các chức năng AI.
- Không mở trực tiếp ra mạng bên ngoài.
- Các container khác giao tiếp với AI Service thông qua Docker network.

### 2.6. MySQL Studio – Cổng 3306

- Cổng nội bộ: `3306`.
- Lưu trữ dữ liệu của Studio.
- Không mở trực tiếp ra mạng bên ngoài.
- Quản lý dữ liệu thông qua phpMyAdmin tại cổng `8081`.

## 3. Tổng kết sơ đồ truy cập

| Nguồn truy cập | Đích đến | Giao thức |
|---|---|---|
| Máy thật (Windows) | Studio FE | `http://192.168.100.2:8080` |
| Máy thật (Windows) | phpMyAdmin | `http://192.168.100.2:8081` |
| Máy thật (Windows) | API Studio | `http://192.168.100.2:5000` |
| Máy thật (Windows) | Web con | `http://192.168.100.2:70xx` |
| Studio FE | data-service | Qua Nginx `/api` |
| data-service | AI Service | Docker network |
| data-service | MySQL Studio | Docker network |
| Web con | API và MySQL riêng | Docker network nội bộ |

**Lưu ý chung:**
- Máy thật và máy Ubuntu cần kết nối được với nhau qua mạng.
- Nếu không truy cập được, kiểm tra IP Ubuntu bằng `hostname -I`.
- Kiểm tra trạng thái container bằng `docker ps`.
- Kiểm tra firewall nếu các cổng đã được publish nhưng máy thật vẫn không kết nối được.