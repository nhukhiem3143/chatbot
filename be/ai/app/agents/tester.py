"""
Agent 4 — Tester: KHÔNG dùng LLM. Chạy kiểm tra thật:
  1) Validator liên-file (import có thật, FE gọi API tồn tại)
  2) data-service build + chạy docker compose thật, đọc log -> lỗi gắn theo file
"""
import requests

from .. import config, validator
from ..schemas import ErrorItem, Report
from .base import BaseAgent, State


class Tester(BaseAgent):
    name = "tester"

    def run(self, state: State, changed=None, **kwargs) -> Report:
        changed = changed or list(state.files.keys())
        static = validator.check_project(state.project_dir, changed, state.plan)
        if static:
            return Report(ok=False, errors=[ErrorItem(**e) for e in static], log="static check")

        try:
            r = requests.post(
                f"{config.DATA_SERVICE_URL}/internal/runs/{state.run_id}/build",
                headers={"x-internal-token": config.INTERNAL_TOKEN},
                timeout=900,
            )
            r.raise_for_status()
            data = r.json()["data"]
        except Exception as e:  # noqa: BLE001
            # Kiểm tra nếu là lỗi kết nối mạng hoặc lỗi hạ tầng Docker
            err_msg = str(e)
            if "docker" in err_msg.lower() or "connection" in err_msg.lower() or "timeout" in err_msg.lower():
                return Report(ok=False, errors=[ErrorItem(file="(hệ thống)", message="Lỗi mạng/Docker Hub: Không thể kéo image để build. Vui lòng kiểm tra lại kết nối mạng của server.")], log=err_msg)
            
            return Report(ok=False, errors=[ErrorItem(file="(chung)", message=f"Không build được: {e}")], log=str(e))
