from celery import Celery
import os
import zipfile
import json
import psycopg2
import uuid
import ssl
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "attendx_worker",
    broker=redis_url,
    backend=redis_url
)

# Limit concurrency to 2 to prevent Out-Of-Memory errors on Render's free tier
celery_app.conf.worker_concurrency = 2

def get_db_connection():
    return psycopg2.connect(os.getenv("DATABASE_URL", "postgresql://attendx:attendx_password@localhost:5432/attendx"))

import csv
import datetime

def process_zip_upload_sync(file_b64: str, user_id: str, filename: str, update_state):
    try:
        update_state(state='PROGRESS', meta={'progress': 10, 'status': 'Extracting ZIP'})
        import base64
        import io
        
        zip_bytes = base64.b64decode(file_b64)
        
        extract_dir = f"uploads/{uuid.uuid4()}_extracted"
        os.makedirs(extract_dir, exist_ok=True)
        
        with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zip_ref:
            zip_ref.extractall(extract_dir)
            
        update_state(state='PROGRESS', meta={'progress': 30, 'status': 'Validating CSV files'})
        
        subject_csv_1 = os.path.join(extract_dir, 'subject_stats.csv')
        subject_csv_2 = os.path.join(extract_dir, 'subjects.csv')
        subject_csv = subject_csv_1 if os.path.exists(subject_csv_1) else subject_csv_2
        
        timetable_csv = os.path.join(extract_dir, 'timetable.csv')
        
        logs_csv_1 = os.path.join(extract_dir, 'attendance_logs.csv')
        logs_csv_2 = os.path.join(extract_dir, 'records.csv')
        logs_csv = logs_csv_1 if os.path.exists(logs_csv_1) else logs_csv_2
        
        if not os.path.exists(subject_csv) or not os.path.exists(timetable_csv) or not os.path.exists(logs_csv):
            import shutil
            shutil.rmtree(extract_dir, ignore_errors=True)
            return {'progress': 0, 'status': 'Error: Invalid ZIP format. Missing required CSV files.'}
            
        update_state(state='PROGRESS', meta={'progress': 50, 'status': 'Connecting to Database'})
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            # 1. Find active semester
            cursor.execute('SELECT id FROM semesters WHERE "userId" = %s AND "isActive" = true LIMIT 1', (user_id,))
            sem_row = cursor.fetchone()
            if not sem_row:
                raise ValueError("No active semester found. Please create a semester first.")
            sem_id = sem_row[0]
            
            now = datetime.datetime.now(datetime.timezone.utc)
            
            update_state(state='PROGRESS', meta={'progress': 60, 'status': 'Parsing Subjects'})
            
            # 3. Import Subjects
            subject_map = {}
            subject_values = []
            
            # Array of vibrant UI colors to cycle through
            ui_colors = [
                "#ef4444", # Red
                "#f97316", # Orange
                "#f59e0b", # Amber
                "#10b981", # Emerald
                "#06b6d4", # Cyan
                "#3b82f6", # Blue
                "#6366f1", # Indigo
                "#8b5cf6", # Violet
                "#d946ef", # Fuchsia
                "#f43f5e", # Rose
            ]
            
            with open(subject_csv, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for idx, row in enumerate(reader):
                    sub_name = row.get("Subject", "").strip()
                    if not sub_name: continue
                    criteria = row.get("Criteria", "75")
                    target = int(''.join(filter(str.isdigit, criteria)) or 75)
                    
                    sub_id = str(uuid.uuid4())
                    subject_map[sub_name] = sub_id
                    
                    # Pick a color based on the index
                    color = ui_colors[idx % len(ui_colors)]
                    subject_values.append((sub_id, sem_id, user_id, sub_name, target, color, now, now))
                    
            if not subject_values:
                return {'progress': 0, 'status': 'Error: The ZIP file contains no valid subjects.'}

            update_state(state='PROGRESS', meta={'progress': 70, 'status': 'Wiping old semester data & Importing'})
            
            # 2. Wipe current semester data (Cascades to slots and logs)
            cursor.execute('DELETE FROM timetable_overrides WHERE "semesterId" = %s', (sem_id,))
            cursor.execute('DELETE FROM subjects WHERE "semesterId" = %s', (sem_id,))
            
            execute_values(cursor, 'INSERT INTO subjects (id, "semesterId", "userId", name, "targetAttendance", "colorHex", "createdAt", "updatedAt") VALUES %s', subject_values)
                
            update_state(state='PROGRESS', meta={'progress': 80, 'status': 'Importing Timetable Slots'})
            
            # 4. Import Timetable
            days_map = {"Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3, "Friday": 4, "Saturday": 5, "Sunday": 6}
            day_slot_counts = {i: 0 for i in range(7)}
            slot_values = []
            
            with open(timetable_csv, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    day_name = row.get("Day of Week", "").strip()
                    sub_name = row.get("Subject", "").strip()
                    day_idx = days_map.get(day_name, 0)
                    sub_id = subject_map.get(sub_name)
                    
                    if not sub_id: continue
                    
                    start_hour = 9 + day_slot_counts[day_idx]
                    start_str = f"{start_hour:02d}:00"
                    end_str = f"{start_hour:02d}:50"
                    day_slot_counts[day_idx] += 1
                    
                    slot_id = str(uuid.uuid4())
                    slot_values.append((slot_id, sem_id, sub_id, day_idx, start_str, end_str, "lecture", now, now))
                    
            if slot_values:
                execute_values(cursor, 'INSERT INTO timetable_slots (id, "semesterId", "subjectId", "dayOfWeek", "startTime", "endTime", "slotType", "createdAt", "updatedAt") VALUES %s', slot_values)
                
            update_state(state='PROGRESS', meta={'progress': 90, 'status': 'Importing Attendance Logs'})
            
            # 5. Import Logs
            override_values = []
            att_values = []
            
            with open(logs_csv, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    sub_name = row.get("Subject", "").strip()
                    sub_id = subject_map.get(sub_name)
                    if not sub_id: continue
                    
                    date_str = row.get("Date", "").strip()
                    if not date_str: continue
                    date_obj = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
                    
                    att_str = row.get("Attendance", "").strip()
                    status = "present"
                    if att_str == "Missed": status = "absent"
                    if att_str == "Off": status = "off"
                    
                    type_str = row.get("Type", "").strip()
                    is_override = type_str in ["Extra", "override"]
                    
                    override_id = None
                    if is_override:
                        override_id = str(uuid.uuid4())
                        override_values.append((override_id, sem_id, date_obj, "extra_class", sub_id, now))
                        
                    att_id = str(uuid.uuid4())
                    att_values.append((att_id, user_id, sub_id, date_obj, status, override_id, now, now, now))
                    
            if override_values:
                execute_values(cursor, 'INSERT INTO timetable_overrides (id, "semesterId", date, "overrideType", "subjectId", "createdAt") VALUES %s', override_values)
                
            if att_values:
                execute_values(cursor, 'INSERT INTO attendance (id, "userId", "subjectId", date, status, "overrideId", "markedAt", "createdAt", "updatedAt") VALUES %s', att_values)
                
            # Invalidate Redis cache so frontend sees new data
            import redis
            r = redis.Redis.from_url(os.getenv("REDIS_URL"))
            keys = r.smembers(f"user_keys:{user_id}")
            if keys:
                r.delete(*keys)
            r.delete(f"user_keys:{user_id}")
            
            # Save ZIP document to DB
            doc_id = str(uuid.uuid4())
            cursor.execute(
                'INSERT INTO "StoredDocument" (id, "userId", name, type, "mimeType", size, "fileUrl", "createdAt") VALUES (%s, %s, %s, %s, %s, %s, %s, %s)',
                (doc_id, user_id, filename, 'BACKUP', 'application/zip', len(zip_bytes), '', now)
            )
            
            # Save file to server/uploads
            server_uploads_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'server', 'uploads')
            os.makedirs(server_uploads_dir, exist_ok=True)
            file_path = os.path.join(server_uploads_dir, f"{doc_id}.zip")
            with open(file_path, 'wb') as df:
                df.write(zip_bytes)
                
            cursor.execute('UPDATE "StoredDocument" SET "fileUrl" = %s WHERE id = %s', (f"/uploads/{doc_id}.zip", doc_id))
            conn.commit()

            # Clean up
            import shutil
            shutil.rmtree(extract_dir, ignore_errors=True)
            
            update_state(state='PROGRESS', meta={'progress': 100, 'status': 'Completed successfully'})
            return {'progress': 100, 'status': 'Completed successfully'}
            
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
            
    except Exception as e:
        raise e
