"""Agent 3 — Developer: viết/sửa TỪNG FILE theo Plan. Chỉ đọc Plan, không đọc hội thoại."""
import json
from typing import List, Optional

from .. import llm
from ..skills import registry
from ..tools import extract_code, read_file
from .base import BaseAgent, State

SYSTEM = """Bạn là lập trình viên full-stack. Bạn viết ĐÚNG MỘT FILE theo Plan đã chốt.

CÔNG NGHỆ: Frontend React 18 + Vite (JSX, react-router-dom v6, axios). Backend Node 20 + Express (CommonJS: require/module.exports) + mysql2/promise. MySQL 8.
QUY TẮC BẮT BUỘC:
  - Chỉ làm đúng file được giao, bám sát "goal". KHÔNG đổi tên API/bảng/biến ngoài Plan. KHÔNG tạo file khác.
  - Khi SỬA LỖI, đọc code liên quan FE/context/API/middleware. Không đoán tên hàm, signature, định dạng token hoặc payload.
  - Nếu sửa auth/client/cart: bảo toàn các chức năng đúng, gửi đúng JWT/cookie như backend xác thực. Không bypass authentication.
  - Frontend ưu tiên DÙNG API client và CartContext thực tế trong project; KHÔNG tự giả định tên export/addToCart. Căn cứ vào file hiện tại. Nếu gọi /api, xác thực đúng theo auth middleware.
  - Frontend gọi API qua `import api from '../api/client.js'` (đường dẫn tương đối đúng vị trí file), vd api.get('/products'). baseURL đã là /api.
    Có sẵn: useAuth() (user, isAdmin), useCart() (items, add...), money(n) từ client.js.
  - Dùng biến CSS (var(--primary), var(--surface)...) và class có sẵn trong theme.css (.container .grid .card .btn .panel .row .muted ...).
    Cần CSS riêng: tạo ở file .css cùng thư mục được Plan cho phép, hoặc dùng style inline. Không hardcode màu khác bảng màu đã chốt.
  - Giao diện tiếng Việt, responsive, đẹp, đúng phong cách skill design.
  - Backend route: `const router = require('express').Router(); const pool = require('../../db');` (từ api/routes/custom/),
    File api/routes/custom/<ten>.js được tự mount tại /api/<ten>, nên trong router CHỈ khai báo phần SAU /<ten>
    (vd api_contract "/reviews/product/:id" -> router.get('/product/:id', ...)). Frontend gọi api.get('/reviews/product/1') (KHÔNG thêm /api).
    auth: `require('../../middlewares/auth')`, quyền: `require('../../middlewares/role')('admin')`. Bọc async bằng try/catch hoặc wrap. `module.exports = router`.
  - SQL: chỉ CREATE TABLE IF NOT EXISTS / ALTER ... ADD COLUMN / INSERT. TUYỆT ĐỐI không DROP, không đụng bảng users.
    Dữ liệu seed: INSERT vào categories(name, slug) rồi products(category_id, name, description, price, image_url, stock);
    category_id tham chiếu id theo thứ tự chèn (bắt đầu từ 1). Ảnh dùng https://picsum.photos/seed/<tu-khoa-khong-dau>/600/400. Bắt đầu bằng `SET NAMES utf8mb4;`.
  - Với web/src/App.jsx: GIỮ NGUYÊN mọi route/import hiện có; chỉ thêm import vào chỗ `// CUSTOM_IMPORTS` và <Route> vào chỗ `{/* CUSTOM_ROUTES */}`.
  - package.json: nếu phải sửa chỉ được THÊM dependency, giữ nguyên phần còn lại.
  - Code đầy đủ, chạy được ngay, không placeholder, không TODO.
ĐẦU RA: CHỈ MỘT khối code markdown ```...``` chứa TOÀN BỘ nội dung file. Không giải thích gì thêm."""


def _related(state: State, path: str) -> str:
    """Chỉ đưa các file liên quan tới file đang làm (giảm nhiễu, tiết kiệm token)."""
    rels: List[str] = []
    if path.startswith("web/src/") or path.startswith("api/"):
        rels = [
            "web/src/api/client.js", "web/src/context/CartContext.jsx",
            "web/src/context/AuthContext.jsx", "web/src/pages/ProductDetail.jsx",
            "web/src/components/ProductCard.jsx", "web/src/pages/Cart.jsx",
            "api/routes/cart.js", "api/routes/auth.js", "api/middlewares/auth.js",
            "api/app.js", "web/src/theme/theme.css",
        ]
        rels = [r for r in rels if r != path]
    elif path.startswith("db/"):
        rels = ["db/01_init.sql"]
    out = []
    for r in rels:
        c = read_file(state.project_dir, r)
        if c:
            out.append(f"--- {r} (chỉ để tham khảo, KHÔNG sửa) ---\n{c[:4800]}")
    # FE cần biết endpoint mới; App.jsx cần biết các trang mới
    if path.startswith("web/src/") and state.plan.api_contract:
        out.append("--- api_contract (API mới) ---\n" + json.dumps([e.model_dump() for e in state.plan.api_contract], ensure_ascii=False))
    if path == "web/src/App.jsx":
        out.append("--- Các file mới trong Plan (cần import + Route) ---\n" + "\n".join(
            f"{t.path}: {t.goal}" for t in state.plan.files_to_add if t.path.startswith("web/src/pages") or t.path.startswith("web/src/custom")))
    return "\n\n".join(out)


class Developer(BaseAgent):
    name = "developer"

    def _plan_text(self, state: State) -> str:
        p = state.plan
        return json.dumps({
            "summary": p.summary,
            "files": [{"path": t.path, "goal": t.goal} for t in p.files_to_add + p.files_to_edit],
            "api_contract": [e.model_dump() for e in p.api_contract],
            "db_changes": p.db_changes,
        }, ensure_ascii=False)

    def _base_user(self, state: State, path: str, goal: str) -> str:
        s = (
            "PLAN (hợp đồng chung, giữ nhất quán):\n" + self._plan_text(state)
            + "\n\nSPEC:\n" + json.dumps(state.spec.model_dump(), ensure_ascii=False)
            + "\n\nTHEME ĐÃ CHỐT:\n" + registry.design_prompt(state.theme)
        )
        if state.change_request:
            s += (
                "\n\nĐÂY LÀ CHỈNH SỬA MỘT WEB ĐÃ CHẠY. YÊU CẦU CỦA USER:\n" + state.change_request
                + "\nChỉ thay đổi đúng phần liên quan tới yêu cầu và mục tiêu của file này; GIỮ NGUYÊN mọi thứ còn lại "
                  "(import, route, tên hàm, logic, style không liên quan). Không viết lại từ đầu."
            )
        return s + f"\n\n=== FILE CẦN VIẾT: {path} ===\nMục tiêu: {goal}\n"

    def run(self, state: State, path: str = "", goal: str = "", validation_errors: Optional[List[str]] = None, **kwargs) -> str:
        current = read_file(state.project_dir, path)
        user = self._base_user(state, path, goal)
        user += ("\nNỘI DUNG HIỆN TẠI (hãy sửa dựa trên bản này):\n```\n" + current + "\n```\n") if current else "\n(File mới, chưa tồn tại.)\n"
        rel = _related(state, path)
        if rel:
            user += "\nFILE LIÊN QUAN:\n" + rel
        if validation_errors:
            user += "\n\nBẢN TRƯỚC BỊ TỪ CHỐI vì:\n- " + "\n- ".join(validation_errors) + "\nHãy sửa đúng các lỗi này."
        out = llm.chat([{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}], temperature=0.25, max_tokens=8000)
        return extract_code(out)

    def fix(self, state: State, path: str, errors: List[str]) -> str:
        """Sửa 1 file đã có theo lỗi của Tester (chỉ file đó)."""
        current = read_file(state.project_dir, path)
        goal = next((t.goal for t in state.plan.files_to_add + state.plan.files_to_edit if t.path == path), "Sửa lỗi")
        user = self._base_user(state, path, goal)
        user += "\nNỘI DUNG HIỆN TẠI:\n```\n" + current + "\n```\n"
        rel = _related(state, path)
        if rel:
            user += "\nFILE LIÊN QUAN:\n" + rel
        user += "\n\nLỖI KHI BUILD/CHẠY THẬT (hãy sửa gọn, giữ nguyên phần đúng):\n- " + "\n- ".join(errors)
        out = llm.chat([{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}], temperature=0.1, max_tokens=8000)
        return extract_code(out)
