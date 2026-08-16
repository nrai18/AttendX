from celery import Celery
import os
import zipfile
import json
import psycopg2
import uuid
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

celery_app = Celery(
    "attendx_worker",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0")
)

def get_db_connection():
    return psycopg2.connect(os.getenv("DATABASE_URL", "postgresql://attendx:attendx_password@localhost:5432/attendx"))

@celery_app.task(bind=True, name="process_zip_upload")
def process_zip_upload(self, file_path: str, user_id: str):
    try:
        self.update_state(state='PROGRESS', meta={'progress': 10, 'status': 'Extracting ZIP'})
        extract_dir = f"uploads/{uuid.uuid4()}_extracted"
        os.makedirs(extract_dir, exist_ok=True)
        
        with zipfile.ZipFile(file_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
            
        self.update_state(state='PROGRESS', meta={'progress': 30, 'status': 'Validating JSON schemas'})
        
        schedule_path = os.path.join(extract_dir, 'schedule.json')
        if not os.path.exists(schedule_path):
            return {'progress': 0, 'status': 'Error: schedule.json missing in ZIP'}
            
        with open(schedule_path, 'r') as f:
            data = json.load(f)
            
        self.update_state(state='PROGRESS', meta={'progress': 50, 'status': 'Connecting to Database'})
        
        # We assume data has 'subjects' and 'slots'
        subjects = data.get("subjects", [])
        slots = data.get("slots", [])
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        self.update_state(state='PROGRESS', meta={'progress': 70, 'status': 'Executing Bulk Inserts'})
        
        # 1. Bulk insert subjects
        if subjects:
            subject_query = """
                INSERT INTO "Subject" (id, "semesterId", "userId", name, code, type)
                VALUES %s ON CONFLICT (id) DO NOTHING
            """
            subject_values = [
                (s["id"], s["semesterId"], user_id, s["name"], s.get("code"), s["type"]) 
                for s in subjects
            ]
            execute_values(cursor, subject_query, subject_values)
            
        # 2. Bulk insert slots
        if slots:
            slot_query = """
                INSERT INTO "TimetableSlot" (id, "semesterId", "subjectId", "dayOfWeek", "startTime", "endTime", room)
                VALUES %s ON CONFLICT (id) DO NOTHING
            """
            slot_values = [
                (sl["id"], sl["semesterId"], sl["subjectId"], sl["dayOfWeek"], sl["startTime"], sl["endTime"], sl.get("room")) 
                for sl in slots
            ]
            execute_values(cursor, slot_query, slot_values)
            
        conn.commit()
        cursor.close()
        conn.close()
        
        # Clean up
        os.remove(file_path)
        
        self.update_state(state='PROGRESS', meta={'progress': 100, 'status': 'Completed successfully'})
        return {'progress': 100, 'status': 'Completed successfully'}
        
    except Exception as e:
        self.update_state(state='FAILURE', meta={'progress': 0, 'status': f'Error: {str(e)}'})
        raise e
