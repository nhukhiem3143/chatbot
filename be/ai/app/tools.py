"""Tiện ích file: bóc code Markdown, ghi file an toàn, copy template, nén ZIP."""
import io
import re
import shutil
import zipfile
from pathlib import Path
from typing import Dict, List


def extract_code(text: str) -> str:
    """Lấy nội dung khối ``` đầu tiên (bỏ tên ngôn ngữ). Không có khối thì trả nguyên văn."""
    m = re.search(r"```[\w+-]*\n(.*?)```", text, re.S)
    if m:
        return m.group(1).rstrip() + "\n"
    return text.strip() + "\n"


def safe_rel(path: str) -> str:
    """Chuẩn hóa đường dẫn tương đối; chặn '..' và đường dẫn tuyệt đối."""
    p = path.strip().replace("\\", "/")
    while p.startswith("./"):
        p = p[2:]
    if not p or p.startswith("/") or ".." in p.split("/") or re.match(r"^[A-Za-z]:", p):
        raise ValueError(f"Đường dẫn không hợp lệ: {path}")
    return p


def write_file(project_dir: Path, rel: str, content: str) -> None:
    rel = safe_rel(rel)
    target = (project_dir / rel).resolve()
    if not str(target).startswith(str(project_dir.resolve())):
        raise ValueError("Path traversal")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def read_file(project_dir: Path, rel: str) -> str:
    p = project_dir / safe_rel(rel)
    return p.read_text(encoding="utf-8") if p.exists() else ""


def copy_template(src: Path, dst: Path) -> None:
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)


def list_files(project_dir: Path) -> List[str]:
    skip = {"node_modules", "dist", ".git"}
    out = []
    for p in sorted(project_dir.rglob("*")):
        if p.is_file() and not (set(p.relative_to(project_dir).parts) & skip):
            out.append(p.relative_to(project_dir).as_posix())
    return out


def snapshot(project_dir: Path) -> Dict[str, str]:
    snap = {}
    for rel in list_files(project_dir):
        try:
            snap[rel] = (project_dir / rel).read_text(encoding="utf-8")
        except UnicodeDecodeError:
            pass
    return snap


def make_zip(project_dir: Path) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in list_files(project_dir):
            z.write(project_dir / rel, rel)
    return buf.getvalue()
