"""
Dựng prompt cho LLM mà KHÔNG gửi lại toàn bộ lịch sử:
    [system cố định] + [tóm tắt hội thoại] + [spec hiện tại] + [vài tin gần nhất]
Phần cố định đặt ĐẦU prompt, giữ nguyên giữa các lượt -> DeepSeek prefix caching hoạt động (rẻ + nhanh).
"""
import json
from typing import List, Optional

MAX_RECENT = 8


def build_interview_messages(system_prompt: str, summary: str, spec: Optional[dict], recent: List[dict]) -> List[dict]:
    state = (
        "TRẠNG THÁI HIỆN TẠI (không hỏi lại những gì đã có ở đây):\n"
        f"- Tóm tắt hội thoại trước đó: {summary or '(chưa có)'}\n"
        f"- Spec hiện tại (JSON): {json.dumps(spec, ensure_ascii=False) if spec else '(chưa có)'}\n"
        "Các tin nhắn gần nhất nằm bên dưới."
    )
    msgs = [{"role": "system", "content": system_prompt}, {"role": "system", "content": state}]
    for m in recent[-MAX_RECENT:]:
        role = m["role"] if m["role"] in ("user", "assistant") else "user"
        msgs.append({"role": role, "content": m["content"]})
    return msgs
