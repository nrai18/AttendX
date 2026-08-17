from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import shutil
import uuid
import os
import asyncio
import ssl
from celery import Celery
from celery.result import AsyncResult
from dotenv import load_dotenv
from google import genai
import json

load_dotenv()

from bunk_bank import BunkBankEngine
from ml_engine import PredictiveMLEngine
from langgraph_agent import chatbot
from vector_store import vector_store

class MathRequest(BaseModel):
    total_conducted: int
    total_attended: int
    target_margin: float = 0.75

class PredictRequest(BaseModel):
    features: Dict[str, Any]

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, Any]]] = None
    user_id: Optional[str] = None
    student_context: Optional[Dict[str, Any]] = None

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
                error_msg = str(res.info) if res.info else "Unknown error"
                await websocket.send_json({"progress": 0, "status": f"Error: {error_msg}"})
                break
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        print(f"Client disconnected from task {task_id}")

@app.post("/upload/zip")
async def upload_zip(user_id: str, file: UploadFile = File(...)):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only .zip files allowed")
        
    file_bytes = await file.read()
    import base64
    file_b64 = base64.b64encode(file_bytes).decode('utf-8')
    
    # Trigger Celery task
    task = celery_app.send_task("process_zip_upload", args=[file_b64, user_id])
    
    return {"status": "accepted", "message": "ZIP upload processing in background", "task_id": task.id}

@app.post("/upload/calendar-ocr")
async def calendar_ocr(file: UploadFile = File(...)):
    try:
        from google.genai import types
        
        file_bytes = await file.read()
        mime_type = file.content_type or "application/pdf"
        if "pdf" in mime_type:
            mime_type = "application/pdf"
        elif "png" in mime_type:
            mime_type = "image/png"
        elif "jpeg" in mime_type or "jpg" in mime_type:
            mime_type = "image/jpeg"
            
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY", "dummy"))
        
        prompt = """
        You are an expert OCR parser for Indian Institute of Information Technology (IIIT) academic calendars.
        Extract all academic activities, exams, cycle tests, holidays, fests, and vacations from this academic calendar document.

        For each event, accurately parse:
        - title (string: clean, descriptive name of the event)
        - eventType (string: exactly one of 'midsem', 'endsem', 'ct', 'fest', 'institute', 'vacation', 'holiday', 'other')
        - date (YYYY-MM-DD string: start date. Ensure the correct 4-digit year e.g. 2026 or 2027)
        - endDate (YYYY-MM-DD string, optional: end date if it spans multiple days)
        - targetSemester (string: e.g. 'I Sem', 'III & V Sem', 'VII Sem', 'II Sem', 'IV, VI & VIII Sem', or 'All' if applicable to all students)

        Return ONLY a raw JSON array of objects. No additional text, no markdown.
        """
        
        part = types.Part.from_bytes(data=file_bytes, mime_type=mime_type)
        
        resp_text = None
        for model_name in ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash']:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[part, prompt],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json"
                    )
                )
                if response and response.text:
                    resp_text = response.text.strip()
                    break
            except Exception as model_err:
                print(f"Calendar OCR model {model_name} attempt error: {model_err}")
                continue
                
        if not resp_text:
            raise HTTPException(status_code=500, detail="AI Vision model failed to extract calendar events. Please check API key quota.")
            
        if resp_text.startswith("```json"):
            resp_text = resp_text[7:-3].strip()
        elif resp_text.startswith("```"):
            resp_text = resp_text[3:-3].strip()
            
        events = json.loads(resp_text)
        return {"status": "success", "rawEvents": events}
    except Exception as e:
        print("Calendar OCR Error:", e)
        raise HTTPException(status_code=500, detail=f"Failed to process calendar: {str(e)}")

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
        messages = []
        if req.history:
            for item in req.history:
                messages.append({"role": item.get("role", "user"), "content": item.get("content", "")})
        messages.append({"role": "user", "content": req.message})
        
        final_state = chatbot.invoke({
            "messages": messages,
            "student_context": req.student_context
        })
        response = final_state["messages"][-1].content
        citations = final_state.get("citations", [])
        return {"response": response, "citations": citations}
    except Exception as e:
        print("Chatbot invocation error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/search-ordinances")
def search_ordinances(query: str, top_k: int = 4):
    try:
        results = vector_store.search(query, top_k=top_k)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

