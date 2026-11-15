
"""
BaseAgent + State.

Agent nhận State -> trả output đã validate schema.
Agent KHÔNG gọi agent khác.
Chỉ Orchestrator quyết định bước tiếp theo.
"""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from ..schemas import Plan, Report, Spec


@dataclass
class State:
    """
    Dữ liệu dùng chung giữa các Agent.
    Single source of truth cho một lần generate/revise.
    """

    # Thông tin run
    run_id: int = 0
    template: str = "ecommerce_basic"
    project_dir: Optional[Path] = None

    # Cấu hình dự án
    manifest: dict = field(default_factory=dict)
    spec: Optional[Spec] = None
    theme: dict = field(default_factory=dict)

    # Planner
    plan: Optional[Plan] = None

    # Developer
    files: Dict[str, str] = field(default_factory=dict)

    # Tester
    report: Optional[Report] = None
    build_started: bool = False

    # Pha chat
    summary: str = ""
    messages: List[dict] = field(default_factory=list)

    # Pha sửa website đã tạo
    change_request: str = ""
    revise: bool = False


class BaseAgent:
    name = "base"

    def run(self, state: State, **kwargs):
        raise NotImplementedError
