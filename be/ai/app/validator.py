"""
VALIDATOR CỨNG (code thường, KHÔNG dùng LLM) kiểm tra giữa các bước:
  - Plan: file sửa phải thuộc vùng editable & đang tồn tại; file thêm phải thuộc vùng editable & chưa tồn tại
  - File: nằm trong Plan, không động vào vùng locked, JSON hợp lệ, SQL không phá bảng lõi
  - Project: import tương đối trỏ đúng file; FE chỉ gọi API có thật (lõi + api_contract)
"""
import json
import re
from pathlib import Path
from typing import Dict, List

from . import config
from .schemas import Plan
from .tools import safe_rel

CORE_API_SEGMENTS = {"auth", "categories", "products", "cart", "orders", "payments", "health"}
CORE_TABLES = r"(users|categories|products|cart_items|orders|order_items|payments)"


def _glob_re(pattern: str) -> re.Pattern:
    out, i = "", 0
    while i < len(pattern):
        c = pattern[i]
        if pattern.startswith("**", i):
            out += ".*"
            i += 2
            continue
        out += "[^/]*" if c == "*" else "[^/]" if c == "?" else re.escape(c)
        i += 1
    return re.compile("^" + out + "$")


def _match(path: str, globs: List[str]) -> bool:
    return any(_glob_re(g).match(path) for g in globs)


def is_locked(path: str, manifest: dict) -> bool:
    return _match(path, manifest.get("locked", []))


def is_editable(path: str, manifest: dict) -> bool:
    return _match(path, manifest.get("editable", [])) and not is_locked(path, manifest)


def contract_segment(path: str) -> str:
    """Segment đầu tiên của path contract, BỎ tiền tố '/api' nếu có.

    Vì client đã có baseURL='/api', contract có thể được planner viết:
        '/reviews/product/:id'   hoặc   '/api/reviews/product/:id'
    Cả hai phải được hiểu là cùng segment 'reviews'.
    """
    parts = [p for p in path.strip("/").split("/") if p]
    if len(parts) >= 2 and parts[0] == "api":
        return parts[1]
    return parts[0] if parts else ""


# ------------------------------------------------------------------ PLAN
def validate_plan(plan: Plan, manifest: dict, project_dir: Path) -> List[str]:
    errs: List[str] = []
    if len(plan.all_paths()) > config.MAX_FILES_PER_RUN:
        errs.append(f"Plan quá lớn (> {config.MAX_FILES_PER_RUN} file). Hãy rút gọn.")
    seen = set()
    for t in plan.files_to_edit:
        try:
            p = safe_rel(t.path)
        except ValueError as e:
            errs.append(str(e))
            continue
        if p in seen:
            errs.append(f"File trùng trong Plan: {p}")
        seen.add(p)
        if is_locked(p, manifest) or not is_editable(p, manifest):
            errs.append(f"files_to_edit: '{p}' thuộc vùng KHÓA hoặc ngoài vùng được sửa")
        elif not (project_dir / p).is_file():
            errs.append(f"files_to_edit: '{p}' chưa tồn tại (hãy đưa vào files_to_add)")
    for t in plan.files_to_add:
        try:
            p = safe_rel(t.path)
        except ValueError as e:
            errs.append(str(e))
            continue
        if p in seen:
            errs.append(f"File trùng trong Plan: {p}")
        seen.add(p)
        if not is_editable(p, manifest):
            errs.append(f"files_to_add: '{p}' nằm ngoài vùng editable (chỉ thêm vào api/routes/custom, web/src/pages|components|custom, db/02_extra.sql...)")
        elif (project_dir / p).exists():
            errs.append(f"files_to_add: '{p}' đã tồn tại (hãy đưa vào files_to_edit)")
    for ep in plan.api_contract:
        if ep.method.upper() not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
            errs.append(f"api_contract: method sai '{ep.method}'")
        if not ep.path.startswith("/"):
            errs.append(f"api_contract: path phải bắt đầu bằng '/': {ep.path}")
        seg = contract_segment(ep.path)
        if seg in CORE_API_SEGMENTS:
            errs.append(f"api_contract: '{ep.path}' trùng API lõi (/{seg}). API mới phải có tên riêng, đặt trong api/routes/custom/<ten>.js")
    return errs


# ------------------------------------------------------------------ FILE
def validate_file(path: str, content: str, plan: Plan, manifest: dict) -> List[str]:
    errs: List[str] = []
    try:
        path = safe_rel(path)
    except ValueError as e:
        return [str(e)]
    if path not in plan.all_paths():
        errs.append(f"'{path}' không nằm trong Plan")
    if not is_editable(path, manifest):
        errs.append(f"'{path}' nằm ngoài vùng editable")
    if is_locked(path, manifest):
        errs.append(f"'{path}' thuộc vùng KHÓA, không được ghi")
    if not content.strip():
        errs.append("File rỗng")
    if "```" in content:
        errs.append("File còn chứa ký hiệu markdown ```")
    if len(content) > 120_000:
        errs.append("File quá lớn")
    if path.endswith(".json"):
        try:
            json.loads(content)
        except json.JSONDecodeError as e:
            errs.append(f"JSON không hợp lệ: {e}")
    if path.endswith(".sql"):
        if re.search(r"\b(DROP|TRUNCATE)\b", content, re.I):
            errs.append("SQL không được chứa DROP/TRUNCATE")
        if re.search(rf"ALTER\s+TABLE\s+`?users`?", content, re.I) or re.search(r"INSERT\s+INTO\s+`?users`?", content, re.I):
            errs.append("Không được sửa/chèn vào bảng users (admin do api/server.js tạo)")
        if re.search(rf"\bDELETE\s+FROM\s+{CORE_TABLES}\b", content, re.I):
            errs.append("SQL không được DELETE bảng lõi")
    if path.startswith("api/routes/custom/") and path.endswith(".js"):
        if "module.exports" not in content:
            errs.append("Route custom phải `module.exports = router`")
        if re.search(r"\bimport\s+.+\s+from\s+", content):
            errs.append("API dùng CommonJS (require / module.exports), không dùng import")
    return errs


# ------------------------------------------------------------------ PROJECT
_IMPORT_RE = re.compile(r"""(?:import\s+(?:[^'"]*?from\s+)?|require\(\s*)['"](\.{1,2}/[^'"]+)['"]""")
_CALL_RE = re.compile(r"""\bapi\.(?:get|post|put|patch|delete)\(\s*[`'"]/([\w-]+)""")


def _resolve(base: Path, spec: str) -> bool:
    t = (base / spec).resolve()
    if t.is_file():
        return True
    for ext in (".js", ".jsx", ".json", ".css"):
        if Path(str(t) + ext).is_file():
            return True
    return any((t / f"index{e}").is_file() for e in (".js", ".jsx"))


def check_project(project_dir: Path, changed: List[str], plan: Plan) -> List[dict]:
    """Kiểm tra liên-file. Trả [{file, message}]."""
    errs: List[dict] = []
    contract_segments = {contract_segment(ep.path) for ep in plan.api_contract}
    allowed_api = CORE_API_SEGMENTS | contract_segments
    for rel in changed:
        p = project_dir / rel
        if not p.is_file() or not rel.endswith((".js", ".jsx")):
            continue
        text = p.read_text(encoding="utf-8")
        for imp in _IMPORT_RE.findall(text):
            if not _resolve(p.parent, imp):
                errs.append({"file": rel, "message": f"import '{imp}' không trỏ tới file nào có thật"})
        if rel.startswith("web/"):
            for seg in set(_CALL_RE.findall(text)):
                if seg not in allowed_api:
                    errs.append({"file": rel, "message": f"gọi API '/{seg}' không có trong API lõi hay api_contract"})
    # route custom trong Plan phải có file tương ứng
    for ep in plan.api_contract:
        seg = contract_segment(ep.path)
        if seg in CORE_API_SEGMENTS:
            # API lõi đã có sẵn trong template, không cần file custom
            continue
        if not (project_dir / "api" / "routes" / "custom" / f"{seg}.js").exists():
            errs.append({"file": f"api/routes/custom/{seg}.js", "message": f"api_contract có '{ep.path}' nhưng chưa có file route /{seg}"})
    return errs