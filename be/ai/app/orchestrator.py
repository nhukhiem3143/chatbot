"""
ORCHESTRATOR — ĐẦU NÃO điều khiển luồng. Chỉ file này quyết định "bước tiếp theo là gì".
"""
import json
import re
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List

import requests

from . import config, validator
from .agents.base import State
from .agents.developer import Developer
from .agents.interviewer import Interviewer
from .agents.planner import Planner
from .agents.tester import Tester
from .schemas import InterviewerOut, Plan, Spec, FileTask
from .skills import registry
from .tools import copy_template, list_files, read_file, write_file


# ------------------------------------------------------------------ báo tiến trình
def _post(path: str, payload: dict) -> None:
    try:
        requests.post(f"{config.DATA_SERVICE_URL}/internal{path}", json=payload,
                      headers={"x-internal-token": config.INTERNAL_TOKEN}, timeout=15)
    except Exception as e:  # noqa: BLE001
        print("[orchestrator] báo tiến trình lỗi:", e)


def _status(run_id: int, **fields) -> None:
    _post(f"/runs/{run_id}/status", fields)


# ------------------------------------------------------------------ PHA 1: CHAT
def chat_turn(summary: str, spec: dict, messages: List[dict]) -> InterviewerOut:
    state = State(summary=summary or "", spec=Spec.model_validate(spec) if spec else None, messages=messages)
    return Interviewer().run(state)


# ------------------------------------------------------------------ áp theme bằng CODE (không tốn LLM)
def apply_theme(state: State) -> None:
    t, spec, d = state.theme, state.spec, state.theme["colors"]
    # theme.css
    css = read_file(state.project_dir, "web/src/theme/theme.css")
    for key in ("primary", "secondary", "background", "surface", "text", "accent"):
        css = re.sub(rf"(--{key}:\s*)[^;]+;", rf"\g<1>{d[key]};", css, count=1)
    css = re.sub(r"(--radius:\s*)[^;]+;", rf"\g<1>{t['radius']};", css, count=1)
    css = re.sub(r"(--font:\s*)[^;]+;", rf"\g<1>'{t['font']}', system-ui, sans-serif;", css, count=1)
    write_file(state.project_dir, "web/src/theme/theme.css", css)

    # tokens.json
    tokens = json.loads(read_file(state.project_dir, "web/src/theme/tokens.json"))
    name = spec.site_name or "Cửa hàng"
    tokens.update({
        "siteName": name,
        "tagline": spec.tagline or spec.business_type or tokens["tagline"],
        "heroTitle": f"Chào mừng đến với {name}",
        "heroSubtitle": (spec.description or spec.tagline or tokens["heroSubtitle"])[:140],
        "colors": d, "font": t["font"], "radius": t["radius"],
    })
    write_file(state.project_dir, "web/src/theme/tokens.json", json.dumps(tokens, ensure_ascii=False, indent=2) + "\n")

    # index.html
    html = read_file(state.project_dir, "web/index.html")
    html = re.sub(r"<title>.*?</title>", f"<title>{name}</title>", html, flags=re.S)
    fam = t["font"].replace(" ", "+")
    html = re.sub(r"family=[^:&\"]+", f"family={fam}", html, count=1)
    write_file(state.project_dir, "web/index.html", html)


# ------------------------------------------------------------------ PHA 2: GENERATE
def _plan_with_retry(state: State, planner: Planner) -> Plan:
    errors: List[str] = []
    for _ in range(3):
        plan = planner.run(state, errors=errors or None)
        owned = lambda p: p.startswith("web/src/theme/") or p == "web/index.html"  # noqa: E731
        plan.files_to_edit = [t for t in plan.files_to_edit if not owned(t.path)]
        plan.files_to_add = [t for t in plan.files_to_add if not owned(t.path)]
        if "db/03_seed.sql" not in plan.all_paths():
            plan.files_to_edit.append(FileTask(path="db/03_seed.sql", goal="Dữ liệu mẫu theo Spec."))
        errors = validator.validate_plan(plan, state.manifest, state.project_dir)
        if not errors:
            return plan
    raise RuntimeError("Planner không tạo được Plan hợp lệ: " + "; ".join(errors))


def _write_one(dev: Developer, state: State, path: str, goal: str) -> str:
    errs: List[str] = []
    for _ in range(3):
        code = dev.run(state, path=path, goal=goal, validation_errors=errs or None)
        errs = validator.validate_file(path, code, state.plan, state.manifest)
        if not errs:
            return code
    raise RuntimeError(f"Developer không tạo được '{path}' hợp lệ: {'; '.join(errs)}")


def run_generate(run_id: int, spec_dict: dict, template: str = "ecommerce_basic") -> None:
    """Chạy toàn bộ pipeline."""
    try:
        meta = registry.load_template_meta(template)
        state = State(run_id=run_id, template=template, spec=Spec.model_validate(spec_dict),
                      manifest=meta["manifest"], project_dir=config.OUTPUTS_DIR / f"run_{run_id}")

        # 1) chuẩn bị project từ template
        _status(run_id, status="planning", current_agent="planner")
        copy_template(meta["dir"], state.project_dir)
        state.theme = registry.resolve_design(state.spec, template)
        apply_theme(state)

        # 2) Planner -> Plan
        state.plan = _plan_with_retry(state, Planner())
        _status(run_id, plan=state.plan.model_dump(), current_agent="developer", status="coding")

        # 3) Developer: viết từng file
        dev = Developer()
        tasks = [(t.path, t.goal) for t in state.plan.files_to_add + state.plan.files_to_edit]
        first = [t for t in tasks if t[0] != "web/src/App.jsx"]
        last = [t for t in tasks if t[0] == "web/src/App.jsx"]

        def work(item):
            return item[0], _write_one(dev, state, item[0], item[1])

        for batch in (first, last):
            if not batch:
                continue
            with ThreadPoolExecutor(max_workers=4) as ex:
                for path, code in ex.map(work, batch):
                    write_file(state.project_dir, path, code)
                    state.files[path] = code

        # 4) Tester (build thật) + vòng sửa lỗi THÔNG MINH
        # Sử dụng config.MAX_FIX_ROUNDS (khuyên dùng 5-10)
        for rnd in range(config.MAX_FIX_ROUNDS + 1):
            _status(run_id, status="testing", current_agent="tester", retry_count=rnd)
            report = Tester().run(state, changed=list(state.files.keys()))
            state.report = report
            _status(run_id, report=report.model_dump())
            if report.ok:
                break
            if rnd == config.MAX_FIX_ROUNDS:
                raise RuntimeError(f"Build vẫn lỗi sau {rnd} vòng sửa: " + "; ".join(e.message[:120] for e in report.errors[:3]))

            _status(run_id, status="coding", current_agent="developer")
            by_file: Dict[str, List[str]] = {}
            for e in report.errors:
                by_file.setdefault(e.file, []).append(e.message)

            # ---> SỬA LỖI TẠI ĐÂY: Không dùng điều kiện .exists() chặn file mới
            targets = []
            for f in by_file:
                if validator.is_editable(f, state.manifest):
                    targets.append(f)
            
            # Nếu không tìm thấy file lỗi cụ thể, sửa các file do AI viết
            if not targets:
                targets = [p for p in state.files if p.endswith((".js", ".jsx", ".sql"))][:6]
                for t in targets:
                    by_file[t] = [e.message for e in report.errors]

            for f in targets:
                # Nếu file chưa tồn tại trong plan, tự động thêm vào plan để hợp lệ hóa
                if f not in state.plan.all_paths():
                    try:
                        state.plan.files_to_add.append(FileTask(path=f, goal="Tạo file mới để sửa lỗi: " + ", ".join(by_file[f])[:200]))
                    except Exception as ex:
                        print(f"[orchestrator] Không thể thêm file {f} vào plan: {ex}")

                # Nếu file đã có trên ổ cứng -> Gọi fix. Nếu chưa có -> Gọi run (tạo mới)
                is_existing = (state.project_dir / f).exists()
                if is_existing:
                    code = dev.fix(state, f, by_file[f])
                else:
                    goal = next((t.goal for t in state.plan.files_to_add if t.path == f), "Tạo file để sửa lỗi build")
                    code = _write_one(dev, state, f, goal)

                if not validator.validate_file(f, code, state.plan, state.manifest):
                    write_file(state.project_dir, f, code)
                    state.files[f] = code

        # 5) lưu danh sách file + báo xong
        tpl_files = set(list_files(meta["dir"]))
        files = [{"path": p, "kind": ("generated" if p in state.files and p not in tpl_files else "edited" if p in state.files else "template")}
                 for p in list_files(state.project_dir)]
        _post(f"/runs/{run_id}/files", {"files": files})
        
        # ---> SỬA DÒNG DƯỚI ĐÂY: Truyền thêm port vào để giao diện tự cập nhật
        final_port = state.report.port if state.report else None
        _status(run_id, status="running", current_agent=None, port=final_port)

    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        _status(run_id, status="failed", error=str(e)[:1500])