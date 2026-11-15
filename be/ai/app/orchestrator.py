"""
ORCHESTRATOR — ĐẦU NÃO điều khiển luồng. Chỉ file này quyết định "bước tiếp theo là gì".

  Pha 1 (chat):     chat_turn()      -> Interviewer -> Spec nháp          (mỗi lượt user gửi tin, CHƯA có web)
  Pha 2 (generate): run_generate()   -> copy template -> Planner -> áp theme (code) -> Developer
                                        -> Tester (build thật) -> [lỗi: Developer sửa đúng file lỗi, <= 3 vòng] -> chạy preview
  Pha 3 (feedback): feedback_turn()  -> Reviser.intent: chat hay sửa web?    (mỗi lượt user gửi tin, ĐÃ có web)
                    run_revise()     -> copy web cũ -> [áp theme nếu đổi] -> Reviser.plan (chỉ file cần sửa) -> Developer
                                        -> Tester (cùng vòng sửa lỗi) -> chạy preview -> nhắn lại user kết quả
                                        (thất bại: bật lại web cũ + nhắn lý do)
"""
import json
import hashlib
import re
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Optional

import requests

from . import config, validator
from .agents.base import State
from .agents.developer import Developer
from .agents.interviewer import Interviewer
from .agents.planner import Planner
from .agents.reviser import Reviser
from .agents.tester import Tester
from .schemas import FileTask, InterviewerOut, Plan, RevisionIntent, Spec
from .skills import registry
from .tools import copy_template, list_files, read_file, snapshot, write_file


# ------------------------------------------------------------------ báo tiến trình
def _post(path: str, payload: dict) -> bool:
    """Ghi trạng thái/tin nhắn qua data-service; KHÔNG nuốt lỗi HTTP 4xx/5xx."""
    try:
        r = requests.post(
            f"{config.DATA_SERVICE_URL}/internal{path}", json=payload,
            headers={"x-internal-token": config.INTERNAL_TOKEN}, timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        if isinstance(data, dict) and data.get("success") is False:
            raise RuntimeError(data.get("message") or "Data service báo thất bại")
        return True
    except Exception as exc:
        print(f"[orchestrator] POST {path} FAILED: {exc}", flush=True)
        return False


def _status(run_id: int, **fields) -> None:
    _post(f"/runs/{run_id}/status", fields)


def _say(conversation_id: int, content: str) -> bool:
    result = _post(
        f"/conversations/{conversation_id}/messages",
        {"role": "assistant", "content": content},
    )
    print(f"[orchestrator] notify conversation={conversation_id}: {result}", flush=True)
    return result


def _where(e: Exception) -> str:
    """Vị trí lỗi (file:dòng trong code dự án) để hiện ngay trên giao diện, khỏi mở log."""
    frames = [f for f in traceback.extract_tb(e.__traceback__) if "site-packages" not in f.filename]
    if not frames:
        return ""
    f = frames[-1]
    return f"  [{f.filename.replace(chr(92), '/').split('/')[-1]}:{f.lineno} → {(f.line or '').strip()[:110]}]"


# ------------------------------------------------------------------ PHA 1: CHAT (chưa có web)
def chat_turn(summary: str, spec: dict, messages: List[dict]) -> InterviewerOut:
    state = State(summary=summary or "", spec=Spec.model_validate(spec) if spec else None, messages=messages)
    return Interviewer().run(state)


# ------------------------------------------------------------------ PHA 3a: GÓP Ý (đã có web)
def feedback_turn(summary: str, spec: dict, messages: List[dict], base_plan: Optional[dict] = None) -> RevisionIntent:
    state = State(summary=summary or "", spec=Spec.model_validate(spec) if spec else None, messages=messages)
    out = Reviser().intent(state, base_plan)
    if out.action == "revise" and not out.change_request.strip():
        last_user = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
        out.change_request = last_user
    return out


# ------------------------------------------------------------------ áp theme bằng CODE (không tốn LLM)
def apply_theme(state: State) -> None:
    t, spec, d = state.theme, state.spec, state.theme["colors"]
    # theme.css: thay giá trị biến trong :root
    css = read_file(state.project_dir, "web/src/theme/theme.css")
    for key in ("primary", "secondary", "background", "surface", "text", "accent"):
        css = re.sub(rf"(--{key}:\s*)[^;]+;", rf"\g<1>{d[key]};", css, count=1)
    css = re.sub(r"(--radius:\s*)[^;]+;", rf"\g<1>{t['radius']};", css, count=1)
    css = re.sub(r"(--font:\s*)[^;]+;", rf"\g<1>'{t['font']}', system-ui, sans-serif;", css, count=1)
    write_file(state.project_dir, "web/src/theme/theme.css", css)

    # tokens.json: tên shop, slogan, hero
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

    # index.html: title + Google Font
    html = read_file(state.project_dir, "web/index.html")
    html = re.sub(r"<title>.*?</title>", f"<title>{name}</title>", html, flags=re.S)
    fam = t["font"].replace(" ", "+")
    html = re.sub(r"family=[^:&\"]+", f"family={fam}", html, count=1)
    write_file(state.project_dir, "web/index.html", html)


# ------------------------------------------------------------------ các bước dùng chung (generate + revise)
def _change_guard(state: State, path: str, before: str, after: str) -> List[str]:
    """Chặn việc sinh lại phần lớn file khi user chỉ yêu cầu sửa nhỏ."""
    if not state.revise or not before or before == after:
        return []
    request = (state.change_request or '').lower()
    broad = ('toàn bộ', 'viết lại', 'làm lại', 'thiết kế lại', 'refactor', 'redesign')
    if any(x in request for x in broad):
        return []
    import difflib
    old_lines = before.splitlines()
    new_lines = after.splitlines()
    if len(old_lines) < 35:
        return []
    changes = sum(max(i2 - i1, j2 - j1) for tag, i1, i2, j1, j2 in
                  difflib.SequenceMatcher(None, old_lines, new_lines, autojunk=False).get_opcodes()
                  if tag != 'equal')
    # Đây là guard thận trọng; có thể nới theo mục tiêu khi thực sự cần đổi cấu trúc lớn.
    limit = max(35, int(len(old_lines) * 0.45))
    return [f"Bạn thay đổi {changes} dòng so với giới hạn {limit} dòng trong '{path}'. "
            "Chỉ sửa đúng phần được yêu cầu, giữ nguyên phần còn lại."] if changes > limit else []


def _write_one(dev: Developer, state: State, path: str, goal: str) -> str:
    """Viết một file, kiểm tra schema và phạm vi thay đổi trước khi ghi."""
    before = read_file(state.project_dir, path) or ''
    errs: List[str] = []
    for _ in range(3):
        code = dev.run(state, path=path, goal=goal, validation_errors=errs or None)
        errs = validator.validate_file(path, code, state.plan, state.manifest)
        errs.extend(_change_guard(state, path, before, code))
        if not errs:
            return code
    raise RuntimeError(f"Developer không tạo được '{path}' hợp lệ: {'; '.join(errs)}")


def _develop(state: State, dev: Developer) -> None:
    """Developer viết từng file (song song 4 luồng); App.jsx làm sau cùng vì phụ thuộc trang mới."""
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


def _test_and_fix(run_id: int, state: State, dev: Developer) -> None:
    """Build / chẩn đoán / sửa theo file có bằng chứng. Không sửa file ngẫu nhiên."""
    state.build_started = True
    previous_signature = None
    for rnd in range(config.MAX_FIX_ROUNDS + 1):
        _status(run_id, status='testing', current_agent='tester', retry_count=rnd)
        report = Tester().run(state, changed=list(state.files.keys()))
        if report is None:
            raise RuntimeError('Tester không trả Report; kiểm tra agents/tester.py')
        state.report = report
        _status(run_id, report=report.model_dump())
        if report.ok:
            if not report.port:
                raise RuntimeError('Tester báo thành công nhưng không cung cấp cổng preview')
            return
        errors = report.errors or []
        details = '\n'.join(e.message for e in errors)
        if any(e.file == '(hạ tầng)' for e in errors):
            raise RuntimeError('Lỗi Docker/hạ tầng, không phải lỗi code AI: ' + details[-1300:])
        signature = hashlib.sha256((details + '\n' + (report.log or '')[-1200:]).encode()).hexdigest()
        if rnd >= config.MAX_FIX_ROUNDS:
            raise RuntimeError(f'Build vẫn lỗi sau {rnd} lần sửa: ' + details[-1300:])
        if signature == previous_signature:
            raise RuntimeError('Build trả lại lỗi y hệt sau lần sửa. Dừng để tránh sửa lan: ' + details[-1200:])
        previous_signature = signature
        by_file: Dict[str, List[str]] = {}
        for e in errors:
            f = str(e.file or '').replace('\\', '/').removeprefix('./')
            if not validator.is_editable(f, state.manifest):
                continue
            if not (state.project_dir / f).is_file():
                continue
            by_file.setdefault(f, []).append(e.message)
        if not by_file:
            raise RuntimeError('Không xác định được file editable gây lỗi. Không sửa ngẫu nhiên. LOG: ' +
                               ((report.log or details)[-1400:]))
        _status(run_id, status='coding', current_agent='developer')
        changed = 0
        for f, messages in list(by_file.items())[:6]:
            before = read_file(state.project_dir, f) or ''
            if f not in state.plan.all_paths():
                # File có lỗi được xác minh qua Tester: mở rộng Plan hợp lệ, không sửa vùng locked.
                state.plan.files_to_edit.append(FileTask(path=f, goal='Sửa lỗi được Tester xác định (code/runtime/kiểm thử chức năng): ' + '; '.join(messages)[:400]))
            feedback: List[str] = []
            for _ in range(3):
                code = dev.fix(state, f, messages + feedback)
                feedback = validator.validate_file(f, code, state.plan, state.manifest)
                feedback.extend(_change_guard(state, f, before, code))
                if not feedback:
                    break
            if feedback:
                raise RuntimeError(f'Không tạo được bản vá hợp lệ cho {f}: ' + '; '.join(feedback))
            if code != before:
                write_file(state.project_dir, f, code)
                state.files[f] = code
                changed += 1
        if not changed:
            raise RuntimeError('Developer không tạo ra thay đổi nào để sửa lỗi, dừng vòng lặp.')


# ------------------------------------------------------------------ PHA 2: GENERATE
def _plan_with_retry(state: State, planner: Planner) -> Plan:
    errors: List[str] = []
    for _ in range(3):
        plan = planner.run(state, errors=errors or None)
        # Bỏ file do code sở hữu; ép có seed.sql
        owned = lambda p: p.startswith("web/src/theme/") or p == "web/index.html"  # noqa: E731
        plan.files_to_edit = [t for t in plan.files_to_edit if not owned(t.path)]
        plan.files_to_add = [t for t in plan.files_to_add if not owned(t.path)]
        if "db/03_seed.sql" not in plan.all_paths():
            plan.files_to_edit.append(FileTask(path="db/03_seed.sql", goal="Dữ liệu mẫu theo Spec: danh mục và sản phẩm đúng chủ đề."))
        errors = validator.validate_plan(plan, state.manifest, state.project_dir)
        if not errors:
            return plan
    raise RuntimeError("Planner không tạo được Plan hợp lệ: " + "; ".join(errors))


def run_generate(run_id: int, spec_dict: dict, template: str = "ecommerce_basic") -> None:
    """Chạy toàn bộ pipeline. Chạy nền; mọi lỗi được ghi vào run.status = failed."""
    try:
        meta = registry.load_template_meta(template)
        state = State(run_id=run_id, template=template, spec=Spec.model_validate(spec_dict),
                      manifest=meta["manifest"], project_dir=config.OUTPUTS_DIR / f"run_{run_id}")

        # 1) chuẩn bị project từ template + chốt theme (user > skill > mặc định)
        _status(run_id, status="planning", current_agent="planner")
        copy_template(meta["dir"], state.project_dir)
        state.theme = registry.resolve_design(state.spec, template)
        apply_theme(state)

        # 2) Planner -> Plan (đã validate)
        state.plan = _plan_with_retry(state, Planner())
        _status(run_id, plan=state.plan.model_dump(), current_agent="developer", status="coding")

        # 3) Developer viết file
        dev = Developer()
        _develop(state, dev)

        # 4) Tester (build thật) + vòng sửa lỗi
        _test_and_fix(run_id, state, dev)

        # 5) lưu danh sách file + báo xong (data-service đã đặt status=running khi preview lên)
        tpl_files = set(list_files(meta["dir"]))
        files = [{"path": p, "kind": ("generated" if p in state.files and p not in tpl_files else "edited" if p in state.files else "template")}
                 for p in list_files(state.project_dir)]
        _post(f"/runs/{run_id}/files", {"files": files})
        _status(run_id, status="running", current_agent=None)

    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        _status(run_id, status="failed", error=(str(e) + _where(e))[:1500])


# ------------------------------------------------------------------ PHA 3b: SỬA WEB ĐÃ TẠO
def _revise_plan_with_retry(state: State, reviser: Reviser, base_plan: Optional[dict]) -> Plan:
    errors: List[str] = []
    for _ in range(3):
        plan = reviser.plan(state, base_plan, errors=errors or None)
        errors = validator.validate_plan(plan, state.manifest, state.project_dir)
        # Với yêu cầu sửa một chức năng nhỏ, không chấp nhận Plan tràn sang hàng chục file.
        req = (state.change_request or "").lower()
        small_fix = any(k in req for k in ("nút", "button", "thêm vào giỏ", "mua ngay", "lỗi click", "bấm không"))
        if small_fix:
            if not plan.all_paths():
                errors.append("Yêu cầu sửa lỗi chức năng nhưng Plan không chọn file nào để sửa")
            if plan.db_changes:
                errors.append("Không thay đổi DB chỉ để sửa lỗi nút nếu không có bằng chứng cần DB")
            # Không được thay chủ đề trang / theme trong bản vá giỏ hàng.
            disallowed = {"web/src/pages/Home.jsx", "web/src/components/Footer.jsx", "web/src/theme/theme.css", "web/src/theme/tokens.json"}
            if any(p in disallowed for p in plan.all_paths()):
                errors.append("Không chỉnh Home/Footer/theme trong yêu cầu sửa nút")
        if not errors:
            return plan
    raise RuntimeError("Không lập được kế hoạch sửa hợp lệ: " + "; ".join(errors))


def _theme_inputs(s: Optional[Spec]):
    return None if s is None else (s.design.model_dump(), s.site_name, s.tagline, s.description, s.business_type)


def _restore_base(base_run_id: int) -> bool:
    """Sửa thất bại sau khi đã đụng tới web đang chạy -> build + bật lại phiên bản trước."""
    try:
        r = requests.post(f"{config.DATA_SERVICE_URL}/internal/runs/{base_run_id}/build",
                          headers={"x-internal-token": config.INTERNAL_TOKEN}, timeout=900)
        return bool(r.json().get("data", {}).get("ok"))
    except Exception as e:  # noqa: BLE001
        print("[orchestrator] bật lại web cũ lỗi:", e)
        return False


def run_revise(run_id: int, base_run_id: int, conversation_id: int, spec_dict: dict, prev_spec_dict: Optional[dict],
               change_request: str, template: str = "ecommerce_basic", base_plan: Optional[dict] = None,
               base_files: Optional[List[dict]] = None) -> None:
    """Sửa web đã tạo theo góp ý: copy web cũ sang run mới -> Plan tối thiểu -> Developer -> Tester -> preview -> nhắn lại user."""
    state: Optional[State] = None
    try:
        meta = registry.load_template_meta(template)
        base_dir = config.OUTPUTS_DIR / f"run_{base_run_id}"
        if not base_dir.exists():
            raise RuntimeError(f"Không tìm thấy project gốc run_{base_run_id}")
        state = State(run_id=run_id, template=template, spec=Spec.model_validate(spec_dict), manifest=meta["manifest"],
                      project_dir=config.OUTPUTS_DIR / f"run_{run_id}", change_request=change_request, revise=True)

        # 1) copy web cũ; nếu user đổi màu/font/tên shop thì CODE áp lại theme (không tốn LLM)
        _status(run_id, status="planning", current_agent="planner")
        copy_template(base_dir, state.project_dir)
        before = snapshot(state.project_dir)
        state.theme = registry.resolve_design(state.spec, template)
        prev = Spec.model_validate(prev_spec_dict) if prev_spec_dict else None
        if prev is not None and _theme_inputs(prev) != _theme_inputs(state.spec):
            apply_theme(state)

        # 2) Reviser.plan: chỉ những file cần sửa (có thể rỗng nếu chỉ đổi theme)
        state.plan = _revise_plan_with_retry(state, Reviser(), base_plan)
        plan_json = state.plan.model_dump()
        plan_json.update({"revision_of": base_run_id, "change_request": change_request})
        _status(run_id, plan=plan_json, current_agent="developer", status="coding")

        # 3) Developer + Tester dùng lại y nguyên
        dev = Developer()
        _develop(state, dev)
        if state.plan.all_paths() and not any(before.get(p) != snapshot(state.project_dir).get(p) for p in state.plan.all_paths()):
            raise RuntimeError('Developer chưa ghi được file nào theo kế hoạch sửa')
        # Không có chức năng ghi file ngoài kế hoạch. Ngăn side effect không chủ ý.
        after_develop = snapshot(state.project_dir)
        modified = {p for p in set(before) | set(after_develop) if before.get(p) != after_develop.get(p)}
        allowed = set(state.plan.all_paths())
        if prev is not None and _theme_inputs(prev) != _theme_inputs(state.spec):
            allowed.update({'web/src/theme/theme.css', 'web/src/theme/tokens.json', 'web/index.html'})
        extras = sorted(modified - allowed - {'.env'})
        if extras:
            raise RuntimeError('Phát hiện file thay đổi ngoài Plan: ' + ', '.join(extras[:15]))
        _test_and_fix(run_id, state, dev)

        # 4) danh sách file (đánh dấu file mới sửa) + nhắn lại user + báo xong
        after = snapshot(state.project_dir)
        changed = sorted(p for p, c in after.items() if p != ".env" and before.get(p) != c)
        kinds = {f["path"]: f["kind"] for f in (base_files or [])}
        files = [{"path": p, "kind": (("edited" if p in kinds else "generated") if p in changed else kinds.get(p, "template"))}
                 for p in list_files(state.project_dir)]
        _post(f"/runs/{run_id}/files", {"files": files})
        _status(run_id, status="running", current_agent=None)
        _say(conversation_id, Reviser().report(state, changed))

    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        reason = str(e)[:300]
        restored = False
        if state is not None and state.build_started:
            restored = _restore_base(base_run_id)
        tail = (" Mình đã bật lại phiên bản web trước đó." if restored
                else " Web hiện tại vẫn giữ nguyên." if state is None or not state.build_started
                else " Bạn bấm “Bật lại web” ở bản trước trong mục Lịch sử nhé.")
        _say(conversation_id, f"Mình chưa sửa được yêu cầu này: {reason}.{tail} Bạn thử mô tả cụ thể hơn hoặc chia nhỏ yêu cầu giúp mình nhé.")
        _status(run_id, status="failed", error=(str(e) + _where(e))[:1500])
