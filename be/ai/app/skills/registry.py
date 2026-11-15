"""
Nạp skill design (BẮT BUỘC đọc) và gộp với yêu cầu riêng của user.
THỨ TỰ ƯU TIÊN CỐ ĐỊNH (code quyết định, không để LLM tự chọn):
    yêu cầu riêng của user (spec.design)  >  skill design  >  mặc định template
"""
import re
from functools import lru_cache
from typing import Dict

import yaml

from .. import config
from ..schemas import Spec

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


@lru_cache(maxsize=1)
def list_designs() -> Dict[str, dict]:
    out = {}
    for f in sorted((config.SKILLS_DIR / "design").glob("*.yaml")):
        data = yaml.safe_load(f.read_text(encoding="utf-8"))
        out[data["name"]] = data
    return out


def load_template_meta(template: str) -> dict:
    base = config.TEMPLATES_DIR / template
    manifest = yaml.safe_load((base / "manifest.yaml").read_text(encoding="utf-8"))
    bindings_f = base / "skill_bindings.yaml"
    bindings = yaml.safe_load(bindings_f.read_text(encoding="utf-8")) if bindings_f.exists() else {}
    return {"manifest": manifest, "bindings": bindings, "dir": base / "files"}


def list_templates() -> list:
    out = []
    for d in sorted(config.TEMPLATES_DIR.iterdir()):
        if (d / "manifest.yaml").exists():
            m = yaml.safe_load((d / "manifest.yaml").read_text(encoding="utf-8"))
            out.append({"name": m.get("name", d.name), "description": m.get("description", "")})
    return out


def _pick_skill(spec: Spec, bindings: dict) -> str:
    designs = list_designs()
    if spec.design.style in designs:
        return spec.design.style
    bt = (spec.business_type or "").lower()
    for key, skill in (bindings.get("by_business_type") or {}).items():
        if key.lower() in bt and skill in designs:
            return skill
    default = bindings.get("default_design", "minimal")
    return default if default in designs else next(iter(designs))


def _lum(h: str) -> float:
    r, g, b = (int(h[i:i + 2], 16) for i in (1, 3, 5))
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255


def _mix(h: str, other: str, t: float) -> str:
    a = [int(h[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(other[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(x + (y - x) * t):02x}" for x, y in zip(a, b))


def resolve_design(spec: Spec, template: str) -> dict:
    """Trả theme cuối cùng: {skill, colors{}, font, radius, rules[]} (user ghi đè skill)."""
    meta = load_template_meta(template)
    name = _pick_skill(spec, meta["bindings"])
    skill = list_designs()[name]
    colors = dict(skill["colors"])
    font, radius = skill.get("font", "Inter"), skill.get("radius", "10px")
    overridden = []

    d = spec.design
    for key, val in (("primary", d.primary_color), ("secondary", d.secondary_color), ("background", d.background_color)):
        if val and HEX.match(val.strip()):
            colors[key] = val.strip().lower()
            overridden.append(key)
    if d.font.strip():
        font = d.font.strip()
        overridden.append("font")

    # user đổi nền -> tự chỉnh màu chữ/bề mặt cho đủ tương phản
    if "background" in overridden:
        if _lum(colors["background"]) > 0.5:
            colors["text"], colors["surface"] = "#0f172a", "#ffffff"
        else:
            colors["text"], colors["surface"] = "#e2e8f0", _mix(colors["background"], "#ffffff", 0.08)

    return {
        "skill": name,
        "colors": colors,
        "font": font,
        "radius": radius,
        "rules": list(skill.get("rules", [])),
        "user_overrides": overridden,
        "user_notes": d.notes,
    }


def design_prompt(theme: dict) -> str:
    """Đoạn text đưa vào prompt Planner/Developer."""
    lines = [
        f"Skill design: {theme['skill']} (user ghi đè: {', '.join(theme['user_overrides']) or 'không'})",
        "Màu (đã chốt, KHÔNG tự đổi, dùng biến CSS var(--primary)...): " + ", ".join(f"{k}={v}" for k, v in theme["colors"].items()),
        f"Font: {theme['font']} | Bo góc: {theme['radius']}",
        "Quy tắc phong cách: " + "; ".join(theme["rules"]),
    ]
    if theme.get("user_notes"):
        lines.append("Ghi chú thiết kế của user (ưu tiên cao nhất): " + theme["user_notes"])
    return "\n".join(lines)
