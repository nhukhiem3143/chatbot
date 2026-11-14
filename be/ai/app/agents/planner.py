"""Agent 2 — Planner: Spec đã duyệt + template + skill design -> Plan (kế hoạch + HỢP ĐỒNG API/DB/file)."""
import json
from typing import List

from .. import llm, validator
from ..schemas import Plan
from ..skills import registry
from ..tools import list_files
from .base import BaseAgent, State

CORE_API = """API LÕI ĐÃ CÓ SẴN (KHÔNG được tạo lại / sửa):
  POST /auth/register, POST /auth/login, GET /auth/me
  GET /categories ; POST|PUT|DELETE /categories[/:id] (admin)
  GET /products?category=&q= ; GET /products/:id ; POST|PUT|DELETE /products[/:id] (admin)
  GET|POST /cart ; PUT|DELETE /cart/:productId   (user)
  POST /orders ; GET /orders ; GET /orders/:id ; PUT /orders/:id/status (admin)
  GET /payments/order/:orderId ; POST /payments/order/:orderId/pay ; POST /payments/order/:orderId/confirm (admin)
Bảng DB lõi: users, categories, products(id,category_id,name,description,price,image_url,stock), cart_items, orders, order_items, payments."""

SYSTEM = """Bạn là kiến trúc sư phần mềm. Nhiệm vụ: lập PLAN để tùy biến một template web bán hàng ĐÃ CHẠY ĐƯỢC cho đúng Spec của user.
Plan là "hợp đồng" duy nhất: Developer chỉ làm theo Plan, nên phải rõ ràng, nhất quán, tối giản.

NGUYÊN TẮC:
  - Template đã đủ chức năng lõi. CHỈ lập kế hoạch cho phần KHÁC BIỆT theo Spec: giao diện trang chủ, dữ liệu mẫu, tính năng thêm, trang thêm.
  - Không đụng file thuộc vùng LOCKED. files_to_edit chỉ gồm file EDITABLE ĐANG TỒN TẠI. files_to_add chỉ nằm trong vùng editable.
  - KHÔNG đưa web/src/theme/** và web/index.html vào Plan (hệ thống tự áp theme từ skill design).
  - BẮT BUỘC có db/03_seed.sql trong files_to_edit (dữ liệu mẫu đúng chủ đề: danh mục + sản phẩm từ Spec).
  - Tính năng thêm (vd đánh giá): thêm bảng vào db/02_extra.sql (files_to_add hoặc edit), route mới tại api/routes/custom/<ten>.js
    (tự mount ở /api/<ten>), trang/component FE mới, rồi đăng ký route trong web/src/App.jsx (files_to_edit).
  - api_contract chỉ liệt kê API MỚI (method, path, auth: public|user|admin, request, response). Tên path phải khác API lõi.
  - Mỗi file có "goal" 1-2 câu cụ thể (nội dung gì, dùng API/bảng nào) để Developer làm đúng không cần hỏi lại.
  - Tối đa 15 file. Ít file hơn thì tốt hơn.
  - Có thể tùy biến Home.jsx/ProductList/Header/Footer cho hợp chủ đề (nội dung chữ, bố cục), nhưng giữ nguyên cách dùng context/api.

CHỈ TRẢ VỀ MỘT JSON:
{"summary": str, "files_to_edit": [{"path": str, "goal": str}], "files_to_add": [{"path": str, "goal": str}],
 "api_contract": [{"method": str, "path": str, "auth": str, "request": any, "response": any, "purpose": str}], "db_changes": [str]}"""


def _tree(state: State) -> str:
    lines = []
    for rel in list_files(state.project_dir):
        tag = "LOCKED" if validator.is_locked(rel, state.manifest) else ("EDITABLE" if validator.is_editable(rel, state.manifest) else "-")
        lines.append(f"[{tag}] {rel}")
    return "\n".join(lines)


class Planner(BaseAgent):
    name = "planner"

    def run(self, state: State, errors: List[str] = None, **kwargs) -> Plan:
        user = (
            "SPEC (đã được user duyệt):\n" + json.dumps(state.spec.model_dump(), ensure_ascii=False, indent=1)
            + "\n\nSKILL DESIGN ĐÃ CHỐT (yêu cầu riêng của user > skill):\n" + registry.design_prompt(state.theme)
            + "\n\n" + CORE_API
            + "\n\nCÂY FILE CỦA TEMPLATE:\n" + _tree(state)
            + "\n\nHãy trả Plan JSON."
        )
        if errors:
            user += "\n\nPLAN TRƯỚC BỊ TỪ CHỐI vì:\n- " + "\n- ".join(errors) + "\nHãy sửa đúng các lỗi này."
        plan = llm.chat_json(
            [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
            Plan, temperature=0.2, max_tokens=4000,
        )
        plan.theme = state.theme
        return plan
