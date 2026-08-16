from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any
import shutil
import uuid
import os
import asyncio
import ssl
from celery import Celery
from celery.result import AsyncResult
from dotenv import load_dotenv

load_dotenv()

from bunk_bank import BunkBankEngine
from ml_engine import PredictiveMLEngine
from langgraph_agent import chatbot

app = FastAPI(title="AttendX ML Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ml_engine = PredictiveMLEngine()

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "attendx_worker",
    broker=redis_url,
    backend=redis_url
)

# --- Endpoints ---
@app.websocket("/ws/progress/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()
    try:
        while True:
            res = AsyncResult(task_id, app=celery_app)
            if res.state == 'PENDING':
                await websocket.send_json({"progress": 0, "status": "Pending"})
            elif res.state != 'FAILURE':
                meta = res.info or {}
                await websocket.send_json({
                    "progress": meta.get('progress', 0),
                    "status": meta.get('status', 'Processing')
                })
                if res.state == 'SUCCESS':
                    break
            else:
                await websocket.send_json({"progress": 0, "status": "Failed"})
                break
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        print(f"Client disconnected from task {task_id}")

@app.post("/upload/zip")
async def upload_zip(user_id: str, file: UploadFile = File(...)):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only .zip files allowed")
        
    os.makedirs("uploads", exist_ok=True)
    file_path = f"uploads/{uuid.uuid4()}_{file.filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Trigger Celery task
    task = celery_app.send_task("process_zip_upload", args=[file_path, user_id])
    
    return {"status": "accepted", "message": "ZIP upload processing in background", "task_id": task.id}

@app.get("/")
def health_check():
    return {"status": "healthy", "service": "AttendX ML & Background Queue"}

@app.post("/math/safe-leaves")
def safe_leaves(req: MathRequest):
    result = BunkBankEngine.calculate_safe_leaves(
        req.total_conducted, req.total_attended, req.target_margin
    )
    return {"safe_leaves": result}

@app.post("/math/required-classes")
def required_classes(req: MathRequest):
    result = BunkBankEngine.calculate_required_classes(
        req.total_conducted, req.total_attended, req.target_margin
    )
    return {"required_classes": result}

@app.post("/predict/drop-risk")
def predict_risk(req: PredictRequest):
    risk = ml_engine.predict_drop_risk(req.features)
    return {"risk_probability": risk}

@app.post("/ai/chat")
def ai_chat(req: ChatRequest):
    try:
        final_state = chatbot.invoke({"messages": [{"role": "user", "content": req.message}]})
        response = final_state["messages"][-1].content
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
