# AI Web Studio — Hệ thống Multi-Agent tự động tạo website bán hàng

Người dùng **trò chuyện** với AI để chốt yêu cầu → **duyệt/sửa trực tiếp** → bấm **Xác nhận** → các agent lập kế hoạch, viết code trên một **template có sẵn**, **build thật bằng Docker**, tự sửa lỗi rồi chạy web ở **cổng riêng** để xem preview.

| Thành phần | Công nghệ | Cổng mặc định |
|---|---|---|
| Studio FE (giao diện chat) | React + Vite, chạy qua Nginx | **8080** |
| Data service (đăng nhập, lưu hội thoại, quản lý preview) | Node.js 20 + Express | 5000 |
| AI service (4 agent + orchestrator) | Python 3.10 + FastAPI + DeepSeek | 8000 (nội bộ) |
| MySQL của Studio | MySQL 8 | nội bộ |
| phpMyAdmin | phpMyAdmin 5 | **8081** |
| **Web do AI tạo ra** | React/Vite + Node/Express + MySQL (mỗi web 1 bộ container riêng) | **7000–7100** |

---

## 1. Cách chạy (Ubuntu)

### Yêu cầu
- Ubuntu có Docker Engine + Docker Compose v2 (`docker compose version`)
- API key DeepSeek (https://platform.deepseek.com)

### Các bước
```bash
# 1. Giải nén và vào thư mục
unzip ai-agent.zip && cd ai-agent

# 2. Tạo file cấu hình, điền DEEPSEEK_API_KEY (và nên đổi JWT_SECRET, INTERNAL_TOKEN, ADMIN_PASS)
cp .env.example .env
nano .env

# 3. Build và chạy toàn bộ Studio (lần đầu mất vài phút)
docker compose up -d --build

# 4. Xem log nếu cần
docker compose logs -f ai data-service
```

### Mở firewall (nếu dùng ufw) để máy thật truy cập được
```bash
sudo ufw allow 8080/tcp          # Studio
sudo ufw allow 8081/tcp          # phpMyAdmin (chỉ nên mở khi cần)
sudo ufw allow 7000:7100/tcp     # web do AI tạo ra (preview)
```

### Truy cập từ máy thật
Thay `<IP>` bằng IP của máy Ubuntu (`hostname -I`):

| Địa chỉ | Dùng để |
|---|---|
| `http://<IP>:8080` | Studio (chat tạo web) |
| `http://<IP>:8081` | phpMyAdmin — user `root`, mật khẩu = `DB_ROOT_PASS` trong `.env` |
| `http://<IP>:70xx` | Web do AI tạo (Studio tự hiện iframe + link mở tab mới) |

Tài khoản admin Studio mặc định: `admin@studio.local` / `admin123` (đổi trong `.env` bằng `ADMIN_EMAIL`, `ADMIN_PASS` **trước lần chạy đầu**). Người dùng thường tự đăng ký ở trang đăng nhập.
Web do AI tạo ra luôn có admin demo: `admin@shop.local` / `admin123`.

### Dừng / xóa
```bash
docker compose down            # dừng Studio (giữ dữ liệu)
docker compose down -v         # dừng và XÓA dữ liệu MySQL của Studio
docker ps --filter name=run_   # xem các web AI đã tạo còn chạy
```

### Chạy dev không Docker (tùy chọn)
- FE: `cd fe && npm install && npm run dev` (proxy `/api` → `localhost:5000`)
- AI: `cd be/ai && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000`
- Data service: `cd be/data-service && npm install && node server.js` (cần MySQL và biến `DB_*`, `AI_URL`)

---

## 2. Cách dùng

1. Đăng nhập → bấm **+ Cuộc trò chuyện mới** → mô tả web muốn tạo (ví dụ: *“Web bán cà phê rang xay, tông nâu, có đánh giá sản phẩm”*).
2. AI (**Interviewer**) hỏi thêm từng chút một. Bảng **Yêu cầu** bên phải tự cập nhật theo hội thoại.
3. Khi đủ thông tin, bảng hiện **“Chờ bạn duyệt”**. Bạn có thể **sửa trực tiếp** mọi trường (tên shop, danh mục, sản phẩm mẫu, màu/font…) → **Lưu chỉnh sửa**.
4. Bấm **Xác nhận & tạo web**. Tab **Tiến trình & Preview** hiện từng bước: Lập kế hoạch → Viết code → Build & kiểm thử → Chạy web.
5. Xong: xem preview ngay trong iframe, **Tải ZIP** project, **Xem file** (cây file + nội dung), hoặc **Tắt web**.
6. Mỗi lần tạo web mới, hệ thống **tự tắt web cũ** (và xóa volume DB của nó) để lấy lại cổng + RAM.

---

## 3. Luồng hoạt động

### Pha 1 — Hỏi đáp thu thập yêu cầu (mỗi lượt user gửi tin)
```
FE ──POST /api/conversations/:id/messages──► data-service
      lưu tin user vào DB; lấy  [tóm tắt hội thoại] + [Spec hiện tại] + [8 tin gần nhất]
      ──POST /chat──► AI service ► Interviewer ► { reply, spec_draft, missing, ready, summary }
      lưu tin AI, lưu Spec version mới (draft), lưu summary ──► trả về FE
```
**Cache ngữ cảnh:** LLM không bao giờ nhận lại toàn bộ lịch sử, chỉ nhận *system prompt cố định + tóm tắt + Spec + vài tin cuối*. Nhờ vậy không mất ngữ cảnh, không hỏi đi hỏi lại, và phần đầu prompt giữ nguyên nên tận dụng được prefix caching của DeepSeek.

### Pha 2 — Sinh web (chỉ chạy sau khi user bấm Xác nhận)
```
FE ─POST /api/generate─► data-service: tạo run (status=queued) ─POST /generate─► AI service (chạy nền)
                                                                                      │
                                                                         ORCHESTRATOR.run_generate()
 1. Copy template ecommerce_basic ─► outputs/run_<id>/
 2. Chốt theme (CODE quyết định): yêu cầu user > skill design > mặc định  ─► ghi theme.css, tokens.json, index.html
 3. PLANNER  ─► Plan (file sửa/thêm + hợp đồng API + thay đổi DB)  ─► VALIDATOR kiểm Plan (sai thì bắt làm lại, ≤3 lần)
 4. DEVELOPER viết từng file (4 luồng song song, App.jsx làm cuối)  ─► VALIDATOR kiểm từng file (sai thì làm lại, ≤3 lần)
 5. TESTER:  (a) kiểm liên-file bằng code  (b) gọi data-service build + chạy docker compose THẬT
        ├─ lỗi ─► Developer chỉ sửa đúng file bị lỗi ─► quay lại bước 5   (tối đa 3 vòng sửa)
        └─ ok  ─► PreviewManager: tắt web cũ → cấp cổng trống → compose up → chờ web trả lời HTTP
 6. Ghi danh sách file, status=running ─► FE hiện iframe tới http://<IP>:<cổng>
```
Mọi bước đều báo tiến trình về data-service (`/internal/runs/:id/status`), FE hỏi lại mỗi 3 giây.

---

## 4. Các AI (agent) — đầu vào/đầu ra và cách giữ cho chúng không “đá nhau”

**Chỉ Orchestrator quyết định bước tiếp theo.** Agent là hàm thuần (nhận State → trả output đã validate), không gọi agent khác. Các agent giao tiếp qua **tài liệu JSON có schema cố định** (`schemas.py`), không bằng văn bản tự do:

```
Spec (yêu cầu) ──► Plan (hợp đồng) ──► Files (code) ──► Report (kết quả test)
```

| Agent | File | Gọi LLM? | Đầu vào | Đầu ra |
|---|---|---|---|---|
| **Interviewer** | `agents/interviewer.py` | Có (nhiều lượt) | tóm tắt + Spec hiện tại + tin gần nhất | `{reply, spec_draft, missing, ready, summary}` |
| **Planner** | `agents/planner.py` | Có (1 lần) | Spec đã duyệt + cây file template (LOCKED/EDITABLE) + theme đã chốt + danh sách API lõi | `Plan {files_to_edit, files_to_add, api_contract, db_changes}` |
| **Developer** | `agents/developer.py` | Có (mỗi file 1 lần) | Plan nguyên vẹn + mục tiêu của file + nội dung hiện tại + vài file liên quan | nội dung 1 file (khối code) |
| **Tester** | `agents/tester.py` | **Không** | thư mục project | `Report {ok, errors[{file, message}], log, port}` |

**8 cơ chế để các AI không lệch ý nhau:**
1. **Một nguồn sự thật:** Developer chỉ đọc `Plan` (không đọc hội thoại) nên không thể hiểu khác Planner.
2. **Output ép theo schema** (JSON mode + pydantic); sai schema → yêu cầu làm lại, chưa cho đi tiếp.
3. **Hợp đồng API trước, code sau:** FE và BE mới đều sinh từ cùng bảng `api_contract`.
4. **Vùng khóa / vùng sửa** (`manifest.yaml`): Validator từ chối nếu ghi vào file locked (auth, phân quyền, docker, bảng lõi…).
5. **Validator cứng bằng code** (`validator.py`): kiểm đường dẫn, JSON hợp lệ, SQL không DROP/đụng bảng `users`, import tương đối trỏ đúng file, FE chỉ gọi API có thật.
6. **Quyền sửa hẹp:** khi lỗi, Developer chỉ sửa đúng file bị báo lỗi.
7. **Giới hạn vòng lặp:** tối đa 3 vòng sửa; hết vòng vẫn lỗi → dừng, báo lỗi cho user (không lặp vô hạn).
8. **Thứ tự ưu tiên do code quyết định** (`skills/registry.py`): yêu cầu của user > skill design > mặc định template. Theme (màu/font/tên shop) được **code ghi thẳng** vào file, không phụ thuộc LLM.

---

## 5. Công dụng từng file

### Gốc dự án
| File | Công dụng |
|---|---|
| `docker-compose.yml` | Chạy cả Studio: mysql, phpmyadmin, ai, data-service, fe. Mount `docker.sock` cho data-service để chạy web preview |
| `.env.example` | Mẫu cấu hình: key DeepSeek, mật khẩu DB, JWT, token nội bộ, dải cổng preview |
| `.gitignore` | Bỏ qua `node_modules`, `.env`, `outputs/*`… |
| `HUONG_DAN.md` | Tài liệu này |
| `outputs/` | Nơi lưu web do AI sinh (`outputs/run_<id>/`), dùng chung giữa `ai` và `data-service` |

### `fe/` — Studio (React + Vite)
| File | Công dụng |
|---|---|
| `Dockerfile`, `nginx.conf` | Build FE, Nginx phục vụ SPA và proxy `/api` → data-service (không hardcode IP) |
| `vite.config.js`, `package.json`, `index.html` | Cấu hình Vite (`host: true`), thư viện, trang gốc |
| `src/main.jsx`, `src/App.jsx` | Khởi động React, khai báo route + chặn khi chưa đăng nhập |
| `src/api/client.js` | axios gắn JWT, hàm `get/post/put/del`, tải ZIP, dựng URL preview theo IP hiện tại |
| `src/pages/LoginPage.jsx` | Đăng nhập / đăng ký |
| `src/pages/ChatPage.jsx` | **Trang chính:** danh sách hội thoại, khung chat, bảng Yêu cầu, tiến trình + preview |
| `src/pages/HistoryPage.jsx` | Lịch sử các lần tạo web |
| `src/pages/RunDetailPage.jsx` | Chi tiết 1 run: Plan, Report, cây file, nội dung file, tải ZIP |
| `src/components/ChatBox.jsx` | Khung hội thoại kiểu ChatGPT |
| `src/components/SpecEditor.jsx` | Duyệt + sửa trực tiếp Spec, nút Lưu / **Xác nhận & tạo web** |
| `src/components/ProgressBar.jsx` | Thanh tiến trình theo agent |
| `src/components/PreviewFrame.jsx` | iframe tới web AI tạo (cùng IP, khác cổng) |
| `src/components/FileTree.jsx` | Cây file project |
| `src/components/Header.jsx`, `src/styles.css` | Thanh điều hướng, giao diện |

### `be/data-service/` — Cổng API + dữ liệu (Node.js)
| File | Công dụng |
|---|---|
| `Dockerfile` | Node 20 + Docker CLI/compose (lấy từ image `docker:27-cli`) |
| `server.js` | Chờ MySQL, tự tạo admin mặc định, mở cổng 5000 |
| `app.js` | Gắn middleware và routes (`/api/*` cần JWT, `/internal/*` cần token nội bộ) |
| `db.js` | Pool MySQL (`mysql2/promise`) |
| `database/init.sql` | Tạo 6 bảng của Studio (MySQL tự chạy lần đầu) |
| `database/seed.sql` | Dữ liệu mẫu (admin do `server.js` tạo) |
| `middlewares/auth.js` | Xác thực JWT |
| `middlewares/role.js` | Phân quyền admin/user |
| `middlewares/internal.js` | Chỉ AI service (có `INTERNAL_TOKEN`) được gọi `/internal` |
| `middlewares/errorHandler.js` | Bắt lỗi toàn cục |
| `models/userModel.js` | Truy vấn người dùng |
| `models/conversationModel.js` | Hội thoại + tin nhắn (lấy N tin gần nhất) |
| `models/specModel.js` | Spec có phiên bản (sửa/AI cập nhật = version mới) |
| `models/runModel.js` | Run, danh sách file, cổng đang dùng |
| `routes/auth.js` | Đăng ký / đăng nhập / `me` |
| `routes/conversations.js` | CRUD hội thoại; **gửi tin → gọi AI Interviewer → lưu Spec nháp** |
| `routes/specs.js` | User sửa Spec, xác nhận Spec |
| `routes/generate.js` | Bắt đầu sinh web (chỉ khi Spec đã xác nhận); tắt web |
| `routes/runs.js` | Lịch sử run, đọc file (chặn path traversal), tải ZIP |
| `routes/templates.js` | Danh sách template + skill design |
| `routes/internal.js` | AI báo tiến trình, lưu danh sách file, **nhờ build + chạy web** |
| `services/previewManager.js` | **Cấp cổng 7000–7100, `compose up/down`, tắt web cũ, đọc log lỗi theo file** |
| `utils/response.js` | Format trả về `{success, data, message}` |

### `be/ai/` — AI service (Python 3.10)
| File | Công dụng |
|---|---|
| `Dockerfile`, `requirements.txt` | Python 3.10, FastAPI, openai SDK (gọi DeepSeek), pydantic, PyYAML |
| `app/main.py` | API: `/chat`, `/generate` (chạy nền), `/templates`, `/runs/{id}/zip` |
| `app/config.py` | Đọc biến môi trường, hằng số (số vòng sửa, số file tối đa) |
| `app/llm.py` | Gọi DeepSeek: retry, timeout, JSON mode + kiểm schema và yêu cầu làm lại |
| `app/schemas.py` | **“Hợp đồng”**: Spec, Plan, Report… (pydantic) |
| `app/orchestrator.py` | **ĐẦU NÃO**: điều phối pipeline, vòng sửa lỗi, áp theme, báo tiến trình |
| `app/validator.py` | **Kiểm tra cứng giữa các bước (không dùng LLM)** |
| `app/context.py` | Dựng prompt: system cố định + tóm tắt + Spec + vài tin gần nhất |
| `app/tools.py` | Bóc code từ markdown, ghi file an toàn, copy template, nén ZIP |
| `app/agents/base.py` | `BaseAgent` + `State` (dữ liệu dùng chung) |
| `app/agents/interviewer.py` · `planner.py` · `developer.py` · `tester.py` | 4 agent (mục 4) |
| `app/skills/registry.py` | Nạp skill design, **gộp với yêu cầu user (user ghi đè skill)**, tự chỉnh màu chữ khi user đổi nền |
| `app/skills/design/*.yaml` | 4 phong cách: `coffee_warm`, `minimal`, `tech_neon`, `vibrant` (màu, font, bo góc, quy tắc) |
| `app/templates/ecommerce_basic/manifest.yaml` | Khai báo vùng **locked / editable** (glob) |
| `app/templates/ecommerce_basic/skill_bindings.yaml` | Loại hình kinh doanh → skill mặc định (cafe → coffee_warm…) |
| `app/templates/ecommerce_basic/files/` | **Project mẫu chạy được ngay** (mục 6) |

---

## 6. Template web `ecommerce_basic` (web do AI tạo ra)

Khi generate, thư mục `files/` được copy sang `outputs/run_<id>/` rồi AI chỉ tùy biến phần **editable**.

```
files/
├── docker-compose.yml        [LOCKED]  db + api + web (không bind mount; có healthcheck, giới hạn RAM)
├── .env                      [LOCKED]  do PreviewManager ghi: PORT_WEB, COMPOSE_PROJECT_NAME=run_<id>
├── db/
│   ├── Dockerfile            [LOCKED]  nhúng sẵn SQL vào image MySQL
│   ├── 01_init.sql           [LOCKED]  bảng lõi: users, categories, products, cart_items, orders, order_items, payments
│   ├── 02_extra.sql          [EDITABLE] bảng/cột AI thêm (đánh giá, mã giảm giá…)
│   └── 03_seed.sql           [EDITABLE] dữ liệu mẫu theo chủ đề
├── api/  (Node + Express)
│   ├── server.js, app.js, db.js, middlewares/*   [LOCKED]  app.js TỰ MOUNT routes/custom/*.js
│   ├── routes/auth|products|categories|cart|orders|payments.js   [LOCKED]
│   └── routes/custom/        [EDITABLE] AI thêm route mới: reviews.js → /api/reviews
└── web/  (React + Vite + Nginx)
    ├── Dockerfile, nginx.conf (proxy /api → api), vite.config.js, main.jsx, api/, context/   [LOCKED]
    ├── src/App.jsx           [EDITABLE] có 2 điểm đánh dấu CUSTOM_IMPORTS / CUSTOM_ROUTES
    ├── src/theme/            [EDITABLE] theme.css + tokens.json (do orchestrator ghi từ skill + yêu cầu user)
    ├── src/components/       [EDITABLE] Header, Footer, ProductCard
    ├── src/pages/            [EDITABLE giao diện] Home, ProductList, ProductDetail, Cart, Checkout, Login, admin/*
    └── src/custom/           [EDITABLE] trang/component AI thêm mới
```

**Chức năng có sẵn (AI không phải viết lại):** đăng ký/đăng nhập (JWT), phân quyền `admin`/`customer`, admin thêm–sửa–xóa sản phẩm và danh mục, giỏ hàng, đặt hàng, thanh toán **mô phỏng** (COD, chuyển khoản giả lập), admin đổi trạng thái đơn và xác nhận thu tiền.

**AI thêm tính năng mới thế nào:** bảng mới → `db/02_extra.sql`; API mới → `api/routes/custom/<ten>.js` (tự mount); trang mới → `web/src/pages|custom/…` rồi đăng ký ở `App.jsx`. Mọi file mới phải được khai báo trong `Plan`, nếu không Validator từ chối.

**Thêm template khác:** tạo `be/ai/app/templates/<ten>/` gồm `files/`, `manifest.yaml`, `skill_bindings.yaml` — AI service tự nhận. **Thêm phong cách:** thêm 1 file YAML vào `skills/design/` (cùng cấu trúc các file có sẵn) và thêm tên vào dropdown trong `SpecEditor.jsx`.

---

## 7. Cơ sở dữ liệu của Studio (`be/data-service/database/init.sql`)

| Bảng | Công dụng |
|---|---|
| `users` | Tài khoản, mật khẩu băm bcrypt, `role` admin/user |
| `conversations` | Mỗi chat = 1 dự án; có `status` (interviewing → spec_ready → generating → done) và `summary` (cache ngữ cảnh) |
| `messages` | Tin nhắn; index `(conversation_id, id)` để lấy nhanh các tin gần nhất |
| `specs` | Yêu cầu dạng JSON, có `version`, `status` draft/confirmed, `edited_by_user`. Chỉ bản **confirmed** mới được dùng để generate |
| `runs` | Mỗi lần generate: trạng thái, agent hiện tại, `plan` JSON, `report` JSON, số vòng sửa, `port`, `project_name`, lỗi |
| `run_files` | Danh sách file của run + loại (template / generated / edited); nội dung đọc từ `outputs/run_<id>/` |

Xóa hội thoại sẽ xóa dây chuyền messages, specs, runs, run_files. DB của web do AI tạo là **MySQL riêng** nằm trong từng project (không dùng chung).

## 8. Bảng API của data-service

| Method | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` | Đăng ký / đăng nhập |
| GET | `/api/auth/me` | Thông tin bản thân |
| GET/POST | `/api/conversations` | Danh sách / tạo hội thoại |
| GET/DELETE | `/api/conversations/:id` | Chi tiết (kèm tin + Spec mới nhất) / xóa |
| POST | `/api/conversations/:id/messages` | Gửi tin → AI trả lời + cập nhật Spec nháp |
| PUT | `/api/specs/:id` | User sửa Spec (tạo version mới) |
| POST | `/api/specs/:id/confirm` | Xác nhận Spec |
| POST | `/api/generate` | `{conversation_id}` → bắt đầu tạo web |
| POST | `/api/generate/:runId/stop` | Tắt web đang chạy |
| GET | `/api/runs` · `/api/runs/:id` | Lịch sử / chi tiết (Plan, Report, file) |
| GET | `/api/runs/:id/file?path=` · `/api/runs/:id/zip` | Đọc 1 file / tải ZIP project |
| GET | `/api/templates` | Template + skill design |
| POST | `/internal/runs/:id/status`, `/files`, `/build` | **Chỉ AI service** (header `x-internal-token`) |

---

## 9. Xử lý sự cố thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| Chat báo “AI lỗi” | Kiểm tra `DEEPSEEK_API_KEY` trong `.env`; `docker compose logs ai`; sau khi sửa `.env` chạy `docker compose up -d` |
| Máy thật không vào được `:8080` | `sudo ufw allow 8080/tcp`; kiểm tra `docker compose ps` |
| Preview trắng / không mở được cổng 70xx | `sudo ufw allow 7000:7100/tcp`; xem `docker ps --filter name=run_`; log: `docker compose -p run_<id> logs` |
| Run `failed` “Build vẫn lỗi sau 3 vòng” | Xem tab **Chi tiết run → Báo cáo Tester**; có thể bấm **Tạo lại web** (LLM không tất định, thường lần sau sẽ qua) |
| `docker: permission denied` | `sudo usermod -aG docker $USER` rồi đăng nhập lại |
| Hết cổng preview | Tăng `PREVIEW_PORT_MAX` trong `.env`; hoặc `docker compose -p run_<id> down -v` các run cũ |
| Muốn đổi mật khẩu admin Studio | Sửa `.env` rồi `docker compose down -v` (xóa DB) và chạy lại; hoặc đổi trực tiếp trong phpMyAdmin |
| Sửa `.env` không có tác dụng với MySQL | Mật khẩu MySQL chỉ áp dụng lần khởi tạo đầu; cần `docker compose down -v` |

**Lưu ý bảo mật (đồ án/demo):** `data-service` mount `/var/run/docker.sock` ⇒ có quyền tương đương root trên máy chủ. Chỉ chạy trong mạng tin cậy, đổi mọi mật khẩu/secret mặc định, không mở phpMyAdmin ra Internet. Code do LLM sinh ra chạy trong container có giới hạn RAM; `DEEPSEEK_API_KEY` không được đưa vào project sinh ra.

---

## 10. Trạng thái kiểm thử và việc còn lại

**Đã kiểm tra:**
- Cú pháp toàn bộ JS (data-service + API template) và Python; `docker compose config` của cả 2 file compose hợp lệ.
- Build thành công cả 2 frontend bằng Vite (Studio FE và web template).
- Backend khởi động và các lớp bảo vệ trả đúng mã (401/403/404).
- Logic Python bằng test riêng: ưu tiên user > skill, áp theme, Validator Plan/File/Project, chặn path traversal.
- Chạy thử **toàn bộ orchestrator** với LLM và data-service giả: pipeline đi đúng thứ tự, Validator từ chối bản lỗi và bắt làm lại, file do code sở hữu (theme) không bị Plan ghi đè, danh sách file + ZIP đúng.

**Chưa kiểm tra được (môi trường tạo file không chạy được Docker daemon, không có key DeepSeek):**
- Chạy thật `docker compose up` trên Ubuntu, kết nối MySQL thật, và chất lượng code do DeepSeek sinh ra. Lần chạy đầu hãy theo dõi `docker compose logs -f ai data-service`.
- Đường dẫn plugin compose trong `be/data-service/Dockerfile` (`COPY --from=docker:27-cli …/docker-compose`). Nếu build báo thiếu file này, thay bằng cài `docker-compose-plugin` qua apt.

**Chưa làm (đề xuất bước tiếp):**
1. **Chỉnh sửa web sau khi tạo (`/revise`)**: user nói “đổi màu nút” → cập nhật Spec → Planner xuất Plan diff → Developer chỉ sửa file bị ảnh hưởng. Hạ tầng (Spec có version, Plan, vòng sửa lỗi theo file) đã sẵn sàng; hiện nút **Tạo lại web** sinh lại từ đầu.
2. Tự động tóm tắt hội thoại dài bằng lần gọi riêng (hiện `summary` do Interviewer cập nhật mỗi lượt).
3. Giới hạn tần suất / hạn mức token theo user, bảng thống kê token DeepSeek.
