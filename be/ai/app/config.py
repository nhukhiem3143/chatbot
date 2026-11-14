"""Đọc biến môi trường một chỗ duy nhất."""
import os
from pathlib import Path

DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

DATA_SERVICE_URL = os.getenv("DATA_SERVICE_URL", "http://data-service:5000")
INTERNAL_TOKEN = os.getenv("INTERNAL_TOKEN", "dev-internal")
OUTPUTS_DIR = Path(os.getenv("OUTPUTS_DIR", "/app/outputs"))

BASE_DIR = Path(__file__).resolve().parent
SKILLS_DIR = BASE_DIR / "skills"
TEMPLATES_DIR = BASE_DIR / "templates"

MAX_FIX_ROUNDS = 7         # số vòng Developer sửa lỗi tối đa sau khi Tester báo lỗi
MAX_FILES_PER_RUN = 25      # chặn Plan quá lớn
LLM_TIMEOUT = 120
