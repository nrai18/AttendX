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
task_status = {}

@app.websocket("/ws/progress/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()
    try:
        while True:
            if task_id not in task_status:
                await websocket.send_json({"progress": 0, "status": "Pending"})
            else:
                res = task_status[task_id]
                if res['state'] != 'FAILURE':
                    meta = res['meta']
                    if isinstance(meta, Exception):
                        await websocket.send_json({"progress": 0, "status": f"Error: {str(meta)}"})
                        break
                    
                    progress = meta.get('progress', 0) if isinstance(meta, dict) else 0
                    status_msg = meta.get('status', 'Processing') if isinstance(meta, dict) else str(meta)
                    
                    await websocket.send_json({
                        "progress": progress,
                        "status": status_msg
                    })
                    if res['state'] == 'SUCCESS':
                        break
                else:
                    error_msg = str(res['meta']) if res['meta'] else "Unknown error"
                    await websocket.send_json({"progress": 0, "status": f"Error: {error_msg}"})
                    break
            
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        print(f"Client disconnected from task {task_id}")

@app.post("/upload/zip")
async def upload_zip(user_id: str, file: UploadFile = File(...), background_tasks: BackgroundTasks = BackgroundTasks()):
    if not file.filename.endswith('.zip'):
        raise HTTPException(status_code=400, detail="Only .zip files allowed")
        
    file_bytes = await file.read()
    import base64
    file_b64 = base64.b64encode(file_bytes).decode('utf-8')
    
    import uuid
    task_id = str(uuid.uuid4())
    task_status[task_id] = {"state": "PENDING", "meta": {"progress": 0, "status": "Pending"}}
    
    def update_state(state, meta):
        task_status[task_id] = {"state": state, "meta": meta}
    
    def background_job():
        try:
            from tasks import process_zip_upload_sync
            res = process_zip_upload_sync(file_b64, user_id, file.filename, update_state)
            update_state("SUCCESS", res)
        except Exception as e:
            update_state("FAILURE", str(e))
            
    import threading
    threading.Thread(target=background_job).start()
    
    return {"status": "accepted", "message": "ZIP upload processing in background", "task_id": task_id}

@app.post("/upload/calendar-ocr")
async def calendar_ocr(file: UploadFile = File(...)):
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage
        from pydantic import BaseModel, Field
        from typing import List, Optional
        import base64
        
        file_bytes = await file.read()
        mime_type = file.content_type or "application/pdf"
        if "pdf" in mime_type:
            mime_type = "application/pdf"
        elif "png" in mime_type:
            mime_type = "image/png"
        elif "jpeg" in mime_type or "jpg" in mime_type:
            mime_type = "image/jpeg"
            
        class AcademicEvent(BaseModel):
            title: str = Field(description="Clean, descriptive name of the event")
            eventType: str = Field(description="Exactly one of 'midsem', 'endsem', 'ct', 'fest', 'institute', 'vacation', 'holiday', 'other'")
            date: str = Field(description="Start date in YYYY-MM-DD format. Ensure correct year.")
            endDate: Optional[str] = Field(None, description="End date in YYYY-MM-DD format if spanning multiple days")
            targetSemester: str = Field(description="e.g. 'I Sem', 'III & V Sem', or 'All'")
            
        class EventList(BaseModel):
            rawEvents: List[AcademicEvent]

        llm = ChatGoogleGenerativeAI(model="gemini-3.6-flash", temperature=0)
        structured_llm = llm.with_structured_output(EventList)
        
        prompt = "You are an expert OCR parser for academic calendars. Extract all academic activities, exams, cycle tests, holidays, fests, and vacations."
        
        file_data = base64.b64encode(file_bytes).decode('utf-8')
        message = HumanMessage(
            content=[
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{file_data}"}}
            ]
        )
        
        # In case it's a PDF, we should technically pass it as a document or use the genai file API. 
        # But ChatGoogleGenerativeAI supports base64 inline passing for images/PDFs natively if it's gemini-1.5/3.6.
        # However, passing PDF via `image_url` is supported in some LangChain versions, otherwise we fallback to PyPDFLoader.
        if mime_type == "application/pdf":
            import tempfile
            from langchain_community.document_loaders import PyPDFLoader
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name
            loader = PyPDFLoader(tmp_path)
            docs = loader.load()
            text_content = "\n".join([doc.page_content for doc in docs])
            os.remove(tmp_path)
            message = HumanMessage(content=f"{prompt}\n\nDocument Text:\n{text_content}")

        result = structured_llm.invoke([message])
        
        return {
            "status": "needs_setup",
            "rawEvents": [event.dict() for event in result.rawEvents]
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

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
        actions = final_state.get("actions", [])
        return {"response": response, "citations": citations, "actions": actions}
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

