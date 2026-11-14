"""
BaseAgent + State.
Agent là "hàm thuần": nhận State -> trả output đã validate schema. Agent KHÔNG gọi agent khác,
chỉ Orchestrator mới quyết định bước tiếp theo.
"""
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from ..schemas import Plan, Report, Spec


@dataclass
class State:
    """Dữ liệu truyền giữa các agent (single source of truth của 1 lần generate)."""
    run_id: int = 0
    template: str = "ecommerce_basic"
    project_dir: Optional[Path] = None
    manifest: dict = field(default_factory=dict)
    spec: Optional[Spec] = None
    theme: dict = field(default_factory=dict)
    plan: Optional[Plan] = None
    files: Dict[str, str] = field(default_factory=dict)      # path -> nội dung do Developer ghi
    report: Optional[Report] = None
    # riêng cho pha chat
    summary: str = ""
    messages: List[dict] = field(default_factory=list)


class BaseAgent:
    name = "base"

    def run(self, state: State, **kwargs):  # pragma: no cover
        raise NotImplementedError
