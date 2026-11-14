"""FastAPI: /chat (pha hỏi đáp), /generate (pha sinh web, chạy nền), /templates, /runs/{id}/zip."""
from typing import List, Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from . import config, orchestrator
from .skills import registry
from .tools import make_zip

app = FastAPI(title="AI Agent Service")


class Msg(BaseModel):
    role: str
    content: str


class ChatIn(BaseModel):
    summary: str = ""
    spec: Optional[dict] = None
    messages: List[Msg]


class GenerateIn(BaseModel):
    run_id: int
    spec: dict
    template: str = "ecommerce_basic"


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/templates")
def templates():
    return {"templates": registry.list_templates(), "designs": [{"name": k, "description": v.get("description", "")} for k, v in registry.list_designs().items()]}


@app.post("/chat")
def chat(body: ChatIn):
    try:
        out = orchestrator.chat_turn(body.summary, body.spec, [m.model_dump() for m in body.messages])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e))
    return out.model_dump()


@app.post("/generate", status_code=202)
def generate(body: GenerateIn, bg: BackgroundTasks):
    bg.add_task(orchestrator.run_generate, body.run_id, body.spec, body.template)
    return {"accepted": True, "run_id": body.run_id}


@app.get("/runs/{run_id}/zip")
def run_zip(run_id: int):
    d = config.OUTPUTS_DIR / f"run_{run_id}"
    if not d.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy project")
    return Response(make_zip(d), media_type="application/zip",
                    headers={"Content-Disposition": f"attachment; filename=run_{run_id}.zip"})
