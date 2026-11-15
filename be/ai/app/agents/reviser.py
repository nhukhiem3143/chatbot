
"""
Agent Reviser — Xử lý hội thoại và chỉnh sửa website đã tạo.

Chức năng:
1. intent(): Phân loại chat hoặc revise.
2. plan(): Lập kế hoạch sửa tối thiểu.
3. report(): Thông báo kết quả sửa website.

Reviser không trực tiếp ghi file hoặc lưu lịch sử.
Orchestrator điều phối và Data Service lưu hội thoại.
"""

import json
import re
from typing import List, Optional

from .. import llm, validator
from ..schemas import ApiEndpoint, Plan, RevisionIntent
from ..tools import list_files
from .base import BaseAgent, State


def _json_response(value: str) -> dict:
    """Chuyển phản hồi của LLM thành JSON object."""

    if isinstance(value, dict):
        return value

    raw = str(value or "").strip()

    if raw.startswith("```"):
        raw = re.sub(
            r"^```(?:json)?\s*",
            "",
            raw,
            flags=re.I
        )
        raw = re.sub(r"\s*```$", "", raw).strip()

    try:
        parsed = json.loads(raw)

    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")

        if start < 0 or end <= start:
            raise ValueError(
                "LLM không trả JSON object hợp lệ"
            )

        try:
            parsed = json.loads(raw[start:end + 1])
        except json.JSONDecodeError as e:
            raise ValueError(
                f"JSON của LLM không hợp lệ: {e}"
            ) from e

    if not isinstance(parsed, dict):
        raise ValueError(
            "LLM phải trả về JSON object"
        )

    return parsed


def _ask(
    system: str,
    payload: dict,
    limit: int = 2500
) -> dict:
    """Gọi LLM và phân tích kết quả JSON."""

    out = llm.chat(
        [
            {
                "role": "system",
                "content": system
            },
            {
                "role": "user",
                "content": json.dumps(
                    payload,
                    ensure_ascii=False
                )
            }
        ],
        temperature=0.1,
        max_tokens=limit
    )

    return _json_response(out)


class Reviser(BaseAgent):
    name = "reviser"

    # =====================================================
    # 1. PHÂN LOẠI HỘI THOẠI
    # =====================================================

    def intent(
        self,
        state: State,
        base_plan: Optional[dict] = None
    ) -> RevisionIntent:
        """
        Phân loại tin nhắn khi website đã tồn tại.

        action = chat:
            Trả lời bình thường, không sửa website.

        action = revise:
            Người dùng muốn chỉnh sửa website.

        Lịch sử được Data Service lưu vào MySQL.
        """

        messages = [
            {
                "role": m.get("role", "user"),
                "content": str(
                    m.get("content") or ""
                )[:1500]
            }
            for m in state.messages[-8:]
            if isinstance(m, dict)
        ]

        last_user = next(
            (
                m["content"]
                for m in reversed(messages)
                if m["role"] == "user"
            ),
            ""
        )

        system = """
Bạn là AI hỗ trợ người dùng khi website đã được tạo.

NHIỆM VỤ:
Đọc hội thoại và xác định người dùng muốn:
- CHAT: Trò chuyện, hỏi đáp, giải thích.
- REVISE: Chỉnh sửa website đang tồn tại.

=== ACTION = CHAT ===

Sử dụng khi:
- Chào hỏi.
- Trò chuyện bình thường.
- Hỏi chức năng website.
- Hỏi cách sử dụng website.
- Yêu cầu giải thích code hoặc hệ thống.
- Không có yêu cầu thay đổi website.

Khi chat:
- Trả lời tự nhiên bằng tiếng Việt.
- Sử dụng lịch sử hội thoại gần nhất.
- Không yêu cầu xác nhận lại Spec.
- Không tự tạo Run hoặc chỉnh sửa file.

=== ACTION = REVISE ===

Sử dụng khi:
- Người dùng yêu cầu sửa lỗi website.
- Muốn thay đổi hoặc thêm chức năng.
- Muốn thay đổi nội dung website.
- Muốn chỉnh sửa giao diện hoặc bố cục.
- Muốn sửa nút bấm, API hoặc logic hoạt động.

Khi revise:
- Chỉ ghi nhận đúng yêu cầu người dùng.
- Không mở rộng sang các tính năng khác.
- Không tự thay đổi CSS/theme nếu không yêu cầu.
- Không đề nghị tạo lại toàn bộ website.
- change_request phải rõ ràng và cụ thể.

=== QUY TẮC ===

1. Đọc tin nhắn mới nhất cùng lịch sử gần nhất.
2. Không nhầm câu hỏi với yêu cầu sửa code.
3. Không lấy toàn bộ Spec làm yêu cầu sửa.
4. Nếu chỉ sửa một nút, không yêu cầu sửa cả website.
5. summary lưu ngữ cảnh quan trọng.
6. spec_draft chỉ cập nhật khi thật sự cần.
7. Trả lời bằng tiếng Việt.

CHỈ TRẢ JSON OBJECT:

{
    "action": "chat",
    "reply": "Nội dung trả lời người dùng",
    "change_request": "",
    "summary": "",
    "spec_draft": null
}

action chỉ được là "chat" hoặc "revise".
Không trả Markdown.
"""

        data = _ask(
            system,
            {
                "messages": messages,
                "summary": state.summary or "",
                "existing_spec": (
                    state.spec.model_dump()
                    if state.spec else None
                ),
                "base_plan": base_plan or {},
                "latest_user_message": last_user
            },
            limit=2500
        )

        # Chuẩn hóa action
        action = str(
            data.get("action") or "chat"
        ).strip().lower()

        data["action"] = (
            "revise"
            if action == "revise"
            else "chat"
        )

        # Xử lý khi LLM không trả reply
        if not data.get("reply"):
            data["reply"] = (
                "Mình đã nhận yêu cầu chỉnh sửa website."
                if data["action"] == "revise"
                else "Bạn cần mình hỗ trợ điều gì?"
            )

        # Xử lý trường hợp LLM trả null
        data["summary"] = (
            data.get("summary")
            or state.summary
            or ""
        )

        data["change_request"] = (
            data.get("change_request")
            or ""
        )

        # Nếu revise nhưng thiếu mô tả,
        # sử dụng tin nhắn mới nhất của user.
        if data["action"] == "revise":
            if not data["change_request"].strip():
                data["change_request"] = last_user

        return RevisionIntent.model_validate(data)

    # =====================================================
    # 2. LẬP KẾ HOẠCH SỬA WEBSITE
    # =====================================================

    def plan(
        self,
        state: State,
        base_plan: Optional[dict],
        errors: Optional[List[str]] = None
    ) -> Plan:
        """
        Lập kế hoạch sửa website.

        Chỉ chọn file liên quan trực tiếp đến yêu cầu.
        Không tự sinh lại toàn bộ website.
        """

        if (
            not state.project_dir
            or not state.project_dir.is_dir()
        ):
            raise ValueError(
                "Thiếu thư mục website hiện tại"
            )

        paths = sorted(
            p for p in list_files(state.project_dir)
            if not p.startswith(
                ("node_modules/", ".git/")
            )
            and not p.endswith(".env")
        )

        editable = [
            p for p in paths
            if validator.is_editable(p, state.manifest)
        ]
        # Chẩn đoán từ SOURCE thật trước khi Plan. Không đoán API/token.
        from ..tools import read_file
        request = (state.change_request or "").lower()
        evidence_paths = [
            "web/src/api/client.js", "web/src/context/CartContext.jsx",
            "web/src/context/AuthContext.jsx", "web/src/pages/ProductDetail.jsx",
            "web/src/components/ProductCard.jsx", "web/src/pages/ProductList.jsx",
            "api/routes/cart.js", "api/routes/auth.js", "api/middlewares/auth.js",
            "api/app.js", "web/src/App.jsx",
        ] if any(x in request for x in ("giỏ", "cart", "mua ngay", "đăng nhập", "token")) else []
        evidence = {}
        for rel in evidence_paths:
            if rel in paths:
                content = read_file(state.project_dir, rel)
                if content:
                    evidence[rel] = content[:6000]
        # Cho model thêm danh sách file: còn thiếu mới được dựa trên file tree.


        system = """
Bạn là lập trình viên chuyên sửa lỗi website đã tồn tại.

NHIỆM VỤ:
Lập PLAN SỬA TỐI THIỂU theo yêu cầu hiện tại.

QUY TẮC:

1. Chỉ sửa những file thật sự cần thiết.
2. Ưu tiên sửa một file nếu có thể.
3. Yêu cầu nhỏ thường chỉ cần 1-3 file.
4. Không tự thêm trang hay chức năng.
5. Không tự thay đổi CSS, theme, font, màu sắc.
6. Không sửa Home, Header, Footer nếu không liên quan.
7. Không sửa App.jsx nếu không thay đổi route/import.
8. Không thêm bảng SQL hoặc API không được yêu cầu.
9. Giữ nguyên logic, giao diện và chức năng đang đúng.
10. base_plan chỉ dùng làm ngữ cảnh, không phải danh sách việc phải làm lại.
11. Chỉ chọn path hợp lệ theo manifest.
12. files_to_edit phải là file đã tồn tại.
13. files_to_add chỉ dùng khi thật sự cần file mới.
14. Goal phải nêu chính xác cần sửa phần nào.
15. Nếu thiếu thông tin xác định file lỗi, không đoán bừa.
16. Đọc source_evidence và chọn file nguyên nhân thật: auth, context, API client, API route đều có quyền sửa.
17. Không được bỏ qua API/middleware chỉ vì lỗi biểu hiện ở nút bấm.

ĐẦU RA:
Chỉ trả JSON object theo schema:

{
    "summary": "Mục tiêu sửa",
    "files_to_edit": [
        {
            "path": "web/src/components/ProductCard.jsx",
            "goal": "Sửa handler nút thêm giỏ hàng"
        }
    ],
    "files_to_add": [],
    "api_contract": [],
    "db_changes": [],
    "theme": {}
}

Không trả Markdown.
"""

        data = _ask(
            system,
            {
                "change_request": (
                    state.change_request or ""
                ),
                "spec": (
                    state.spec.model_dump()
                    if state.spec else {}
                ),
                "base_plan": base_plan or {},
                "editable_files": editable[:300],
                "manifest_editable_patterns": (
                    state.manifest.get(
                        "editable",
                        []
                    )
                ),
                "validation_errors": errors or [],
                "source_evidence": evidence
            },
            limit=3500
        )

        # Chuẩn hóa dữ liệu Plan
        for key in (
            "files_to_edit",
            "files_to_add",
            "api_contract",
            "db_changes"
        ):
            if data.get(key) is None:
                data[key] = []

        if not isinstance(data.get("theme"), dict):
            data["theme"] = {}

        if not isinstance(data.get("summary"), str):
            data["summary"] = str(
                data.get("summary") or ""
            )

        plan = Plan.model_validate(data)

        # Giữ hợp đồng API của website cũ
        # để Validator không báo nhầm API bị thiếu.
        previous = (
            (base_plan or {}).get("api_contract", [])
            if isinstance(base_plan, dict)
            else []
        )

        known = {
            (ep.method.upper(), ep.path)
            for ep in plan.api_contract
        }

        for entry in previous:
            ep = ApiEndpoint.model_validate(entry)

            key = (
                ep.method.upper(),
                ep.path
            )

            if key not in known:
                plan.api_contract.append(ep)
                known.add(key)

        return plan

    # =====================================================
    # 3. THÔNG BÁO KẾT QUẢ SỬA
    # =====================================================

    def report(
        self,
        state: State,
        changed: List[str]
    ) -> str:
        """
        Tạo thông báo sau khi Orchestrator
        đã kiểm tra website.
        """

        if not changed:
            return (
                "Đã kiểm tra website. "
                "Không có file nào cần thay đổi."
            )

        shown = ", ".join(
            f"`{p}`"
            for p in changed[:12]
        )

        suffix = (
            f" và {len(changed) - 12} file khác"
            if len(changed) > 12
            else ""
        )

        return (
            "Đã cập nhật website và kiểm tra preview "
            "thành công. Các file thực sự thay đổi: "
            f"{shown}{suffix}."
        )
