
"""
Agent 4 — Tester.

1. Kiểm tra tĩnh bằng Validator.
2. Gọi data-service build và chạy website con.
3. Phân loại lỗi hạ tầng và lỗi code.
4. Trả Report để Orchestrator quyết định sửa hoặc dừng.

Lưu ý: data-service chịu trách nhiệm build và kiểm tra runtime.
"""

import os
import socket
import struct
from urllib.parse import urlparse

import requests

from .. import config, validator
from ..schemas import ErrorItem, Report
from .base import BaseAgent, State


INFRA_PATTERNS = (
    "failed to fetch anonymous token",
    "failed to authorize",
    "auth.docker.io",
    "registry-1.docker.io",
    "failed to resolve source metadata",
    "temporary failure in name resolution",
    "no such host",
    "network is unreachable",
    "connection timed out",
    "connection refused",
    "cannot connect to the docker daemon",
    "port is already allocated",
    "toomanyrequests",
    "docker hub rate limit",
)


def is_infrastructure_error(message: str) -> bool:
    text = str(message).lower()
    return any(pattern in text for pattern in INFRA_PATTERNS)


def _gateway_ip() -> str:
    """Docker bridge gateway phía container AI; có thể thay bằng PREVIEW_TEST_HOST."""
    with open("/proc/net/route", encoding="utf-8") as f:
        next(f)
        for line in f:
            cols = line.split()
            if len(cols) > 2 and cols[1] == "00000000":
                return socket.inet_ntoa(struct.pack("<L", int(cols[2], 16)))
    raise RuntimeError("Không xác định được Docker gateway")


def _first_product(payload):
    """Trích sản phẩm từ các kiểu payload phổ biến; không bịa ID."""
    data = payload.get("data", payload) if isinstance(payload, dict) else payload
    if isinstance(data, dict):
        for key in ("products", "items", "rows", "results"):
            if isinstance(data.get(key), list):
                data = data[key]
                break
    if isinstance(data, list):
        return next((p for p in data if isinstance(p, dict) and p.get("id") is not None), None)
    return None


def _smoke_cart(state: State, port: int):
    """Kiểm tra auth -> GET products -> POST cart -> GET cart trên web CON.

    Return (list ErrorItem, log). Không gắn cờ OK nếu test chức năng thất bại.
    Test này chỉ xác minh API; click/điều hướng trình duyệt cần E2E bổ sung.
    """
    host = os.getenv("PREVIEW_TEST_HOST", "").strip() or _gateway_ip()
    base = f"http://{host}:{port}"
    email = os.getenv("SMOKE_TEST_EMAIL", "admin@shop.local")
    password = os.getenv("SMOKE_TEST_PASSWORD", "admin123")
    session = requests.Session()
    errors = []
    logs = []

    def fail(filename: str, msg: str):
        errors.append(ErrorItem(file=filename, message=msg))
        logs.append("FAIL " + msg)
        return errors, "\n".join(logs)

    try:
        auth = session.post(base + "/api/auth/login", json={"email": email, "password": password}, timeout=12)
        if auth.status_code >= 400:
            # Thiếu tài khoản demo là lỗi cấu hình test, không khẳng định source auth bị lỗi.
            return fail("(hạ tầng)", f"Không đăng nhập được tài khoản smoke test: HTTP {auth.status_code}. "
                        "Đặt SMOKE_TEST_EMAIL/SMOKE_TEST_PASSWORD đúng tài khoản web con; không kết luận sửa xong.")
        obj = auth.json()
        data = obj.get("data", obj) if isinstance(obj, dict) else {}
        token = (data.get("token") or data.get("access_token") or data.get("accessToken")) if isinstance(data, dict) else None
        if token:
            session.headers.update({"Authorization": f"Bearer {token}"})
        if not token and not session.cookies:
            return fail("web/src/api/client.js", "Login trả thành công nhưng smoke test không tìm được JWT/cookie; kiểm tra cấu trúc phản hồi auth/client")
        logs.append("OK login with demo/test account")

        products = session.get(base + "/api/products", timeout=12)
        products.raise_for_status()
        product = _first_product(products.json())
        if product is None:
            return fail("(hạ tầng)", "Không có sản phẩm trong API /api/products để kiểm thử giỏ hàng; bổ sung fixture dữ liệu test")
        pid = product["id"]
        logs.append(f"OK product id={pid}")

        add = session.post(base + "/api/cart", json={"product_id": pid, "quantity": 1}, timeout=12)
        if add.status_code >= 400:
            detail = add.text[:260]
            return fail("api/routes/cart.js", f"POST /api/cart sau đăng nhập trả HTTP {add.status_code}: {detail}. "
                        "Kiểm tra auth middleware, payload và cart route trước khi sửa UI.")
        logs.append("OK POST /api/cart")
        cart = session.get(base + "/api/cart", timeout=12)
        if cart.status_code >= 400:
            return fail("api/routes/cart.js", f"GET /api/cart trả HTTP {cart.status_code} sau thêm sản phẩm")
        try:
            cart_data = cart.json()
        except ValueError:
            return fail("api/routes/cart.js", "GET /api/cart không trả JSON hợp lệ")
        def found_id(value):
            if isinstance(value, list):
                return any(found_id(x) for x in value)
            if isinstance(value, dict):
                if str(value.get("product_id", "")) == str(pid):
                    return True
                product_obj = value.get("product")
                if isinstance(product_obj, dict) and str(product_obj.get("id", "")) == str(pid):
                    return True
                return any(found_id(v) for k, v in value.items() if k in ("data", "items", "products", "cart", "rows"))
            return False
        if not found_id(cart_data):
            return fail("api/routes/cart.js", f"POST cart báo OK nhưng GET cart không chứa sản phẩm id={pid}")
        logs.append("OK GET /api/cart: product exists")
        return errors, "\n".join(logs) + "\nLưu ý: API smoke KHÔNG thay thế kiểm thử click bằng trình duyệt."
    except (requests.RequestException, ValueError) as e:
        return fail("(hạ tầng)", f"Không chạy được cart API smoke trên {base}: {e}")


class Tester(BaseAgent):
    name = "tester"

    def run(self, state: State, changed=None, **kwargs) -> Report:
        changed = changed or list(state.files.keys())

        # 1. Kiểm tra tĩnh
        static = validator.check_project(
            state.project_dir,
            changed,
            state.plan,
        )

        if static:
            return Report(
                ok=False,
                errors=[ErrorItem(**e) for e in static],
                log="Static validation failed",
            )

        # 2. Yêu cầu data-service build website
        try:
            response = requests.post(
                f"{config.DATA_SERVICE_URL}/internal/runs/"
                f"{state.run_id}/build",
                headers={
                    "x-internal-token": config.INTERNAL_TOKEN
                },
                timeout=900,
            )

            response.raise_for_status()
            payload = response.json()

            if not isinstance(payload, dict):
                raise ValueError("API trả về dữ liệu không hợp lệ")

            data = payload.get("data")

            if not isinstance(data, dict):
                raise ValueError("API thiếu trường data")

        except (requests.RequestException, ValueError) as exc:
            return Report(
                ok=False,
                errors=[
                    ErrorItem(
                        file="(hạ tầng)",
                        message=f"Lỗi gọi API build: {exc}",
                    )
                ],
                log=str(exc),
            )

        # 3. Đọc log và lỗi
        log = str(data.get("log") or "")
        raw_errors = data.get("errors") or []

        errors = []

        for item in raw_errors:
            if not isinstance(item, dict):
                continue

            filename = str(item.get("file") or "(chung)")
            message = str(item.get("message") or "Unknown error")

            if is_infrastructure_error(message):
                filename = "(hạ tầng)"

            errors.append(
                ErrorItem(
                    file=filename,
                    message=message,
                )
            )

        # 4. Trường hợp data-service không trả lỗi
        # nhưng log vẫn chứa thông tin lỗi hạ tầng
        if not data.get("ok") and is_infrastructure_error(log):
            errors = [
                ErrorItem(
                    file="(hạ tầng)",
                    message="Docker build thất bại do hạ tầng. "
                            + log[-1500:],
                )
            ]

        if not data.get("ok") and not errors:
            errors.append(
                ErrorItem(
                    file="(chung)",
                    message="Build thất bại nhưng data-service "
                            "không trả danh sách lỗi. "
                            + log[-1000:],
                )
            )

        # 5. Kiểm thử HÀNH VI thật sau build (chỉ yêu cầu liên quan giỏ hàng).
        # Build/HTTP 200 đơn thuần không được coi là test chức năng đã đạt.
        request_text = (getattr(state, "change_request", "") or "").lower()
        need_cart_test = bool(getattr(state, "revise", False)) and any(
            term in request_text for term in ("giỏ", "cart", "mua ngay", "checkout")
        )
        if bool(data.get("ok")) and need_cart_test:
            if not data.get("port"):
                errors.append(ErrorItem(file="(hạ tầng)", message="Build OK nhưng thiếu port để chạy functional smoke"))
            else:
                functional_errors, functional_log = _smoke_cart(state, int(data["port"]))
                errors.extend(functional_errors)
                log += "\n=== FUNCTIONAL SMOKE ===\n" + functional_log

        # 6. Kết quả cuối; mọi test bắt buộc phải PASS.
        return Report(
            ok=bool(data.get("ok")) and not errors,
            errors=errors,
            log=log,
            port=data.get("port"),
        )
