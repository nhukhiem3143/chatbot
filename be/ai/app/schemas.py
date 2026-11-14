"""
"HỢP ĐỒNG" giữa các agent: mọi tài liệu trao đổi đều có schema cố định (pydantic).
    Spec (yêu cầu) -> Plan (kế hoạch + hợp đồng API) -> Files (code) -> Report (kết quả test)
Agent KHÔNG nói chuyện bằng văn bản tự do; output sai schema thì bị yêu cầu làm lại.
"""
import re
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class _Base(BaseModel):
    model_config = ConfigDict(extra="ignore")


# ---------------------------------------------------------------- SPEC
class DesignPref(_Base):
    style: str = ""              # tên skill design (coffee_warm, minimal, tech_neon, vibrant) hoặc rỗng
    primary_color: str = ""      # hex #rrggbb nếu user yêu cầu màu riêng
    secondary_color: str = ""
    background_color: str = ""
    font: str = ""
    notes: str = ""

    @field_validator("*", mode="before")
    @classmethod
    def _none_to_empty(cls, v):
        return "" if v is None else v


class SampleProduct(_Base):
    name: str
    price: int = 0
    category: str = ""
    description: str = ""

    @field_validator("price", mode="before")
    @classmethod
    def _price(cls, v):
        if isinstance(v, (int, float)):
            return int(v)
        digits = re.sub(r"\D", "", str(v or ""))
        return int(digits) if digits else 0


class Spec(_Base):
    site_name: str = ""
    business_type: str = ""
    description: str = ""
    tagline: str = ""
    pages: List[str] = Field(default_factory=list)
    features: List[str] = Field(default_factory=list)       # tính năng thêm ngoài lõi (đánh giá, mã giảm giá...)
    design: DesignPref = Field(default_factory=DesignPref)
    categories: List[str] = Field(default_factory=list)
    sample_products: List[SampleProduct] = Field(default_factory=list)
    notes: str = ""

    @field_validator("site_name", "business_type", "description", "tagline", "notes", mode="before")
    @classmethod
    def _none_to_empty(cls, v):
        return "" if v is None else v


class InterviewerOut(_Base):
    reply: str                                   # câu trả lời / câu hỏi tiếp theo cho user
    spec_draft: Spec                             # Spec đầy đủ đã cập nhật
    missing: List[str] = Field(default_factory=list)
    ready: bool = False                          # True -> FE hiện SpecEditor để user duyệt
    summary: str = ""                            # tóm tắt hội thoại (cache ngữ cảnh)


# ---------------------------------------------------------------- PLAN
class FileTask(_Base):
    path: str
    goal: str


class ApiEndpoint(_Base):
    method: str
    path: str                                    # ví dụ /reviews/:productId
    auth: str = "public"                         # public | user | admin
    request: Any = None
    response: Any = None
    purpose: str = ""


class Plan(_Base):
    summary: str = ""
    files_to_edit: List[FileTask] = Field(default_factory=list)
    files_to_add: List[FileTask] = Field(default_factory=list)
    api_contract: List[ApiEndpoint] = Field(default_factory=list)   # chỉ API MỚI (API lõi đã có sẵn)
    db_changes: List[str] = Field(default_factory=list)
    theme: dict = Field(default_factory=dict)                       # do code điền, không phải LLM

    def all_paths(self) -> List[str]:
        return [t.path for t in self.files_to_edit] + [t.path for t in self.files_to_add]


# ---------------------------------------------------------------- REPORT
class ErrorItem(_Base):
    file: str = "(chung)"
    message: str = ""


class Report(_Base):
    ok: bool
    errors: List[ErrorItem] = Field(default_factory=list)
    log: str = ""
    port: Optional[int] = None
