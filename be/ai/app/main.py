"""FastAPI: chat/generate và feedback/revise cho website đã tồn tại."""
from typing import List, Optional

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

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


class FeedbackIn(ChatIn):
    base_plan: Optional[dict] = None


class GenerateIn(BaseModel):
    run_id: int = Field(gt=0)
    spec: dict
    template: str = "ecommerce_basic"


class ReviseIn(BaseModel):
    run_id: int = Field(gt=0)
    base_run_id: int = Field(gt=0)
    conversation_id: int = Field(gt=0)
    spec: dict
    prev_spec: Optional[dict] = None
    change_request: str = Field(min_length=1)
    template: str = "ecommerce_basic"
    base_plan: Optional[dict] = None
    base_files: Optional[List[dict]] = None


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/templates")
def templates():
    return {"templates": registry.list_templates(),
            "designs": [{"name": k, "description": v.get("description", "")}
                        for k, v in registry.list_designs().items()]}


@app.post("/chat")
def chat(body: ChatIn):
    try:
        out = orchestrator.chat_turn(body.summary, body.spec,
                                     [m.model_dump() for m in body.messages])
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return out.model_dump()


@app.post("/feedback")
def feedback(body: FeedbackIn):
    try:
        out = orchestrator.feedback_turn(body.summary, body.spec,
                                         [m.model_dump() for m in body.messages],
                                         body.base_plan)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    return out.model_dump()


@app.post("/generate", status_code=202)
def generate(body: GenerateIn, bg: BackgroundTasks):
    bg.add_task(orchestrator.run_generate, body.run_id, body.spec, body.template)
    return {"accepted": True, "run_id": body.run_id}


@app.post("/revise", status_code=202)
def revise(body: ReviseIn, bg: BackgroundTasks):
    if body.run_id == body.base_run_id:
        raise HTTPException(status_code=400, detail="Run sửa phải khác Run gốc")
    if not (config.OUTPUTS_DIR / f"run_{body.base_run_id}" / "docker-compose.yml").is_file():
        raise HTTPException(status_code=404, detail="Không tìm thấy project gốc")
    bg.add_task(
        orchestrator.run_revise,
        body.run_id, body.base_run_id, body.conversation_id,
        body.spec, body.prev_spec, body.change_request,
        body.template, body.base_plan, body.base_files
    )
    return {"accepted": True, "run_id": body.run_id,
            "revision_of": body.base_run_id}


@app.get("/runs/{run_id}/zip")
def run_zip(run_id: int):
    d = config.OUTPUTS_DIR / f"run_{run_id}"
    if not d.exists():
        raise HTTPException(status_code=404, detail="Không tìm thấy project")
    return Response(make_zip(d), media_type="application/zip",
                    headers={"Content-Disposition": f"attachment; filename=run_{run_id}.zip"})
