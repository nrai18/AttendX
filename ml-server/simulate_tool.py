import os
import psycopg2
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

def simulate_semester_attendance_logic(user_id: str, semester_id: str, skip_count: int = 0, custom_start: str = None, custom_end: str = None):
    try:
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cursor = conn.cursor()
        
        # 1. Fetch semester dates
        cursor.execute('SELECT "startDate", "endDate" FROM semesters WHERE id = %s', (semester_id,))
        sem_row = cursor.fetchone()
        if not sem_row:
            return "Error: Semester not found."
            
        sem_start = sem_row[0]
        sem_end = sem_row[1]
        
        # 2. Fetch events to find commencement or last working day
        cursor.execute('SELECT date, "endDate", "eventType", "isHolidayList", title FROM events WHERE "semesterId" = %s', (semester_id,))
        events = cursor.fetchall()
        
        # Override dates if provided
        start_date = datetime.strptime(custom_start, "%Y-%m-%d").date() if custom_start else None
        end_date = datetime.strptime(custom_end, "%Y-%m-%d").date() if custom_end else None
        
        if not start_date:
            # try to find commencement
            comm_events = [e for e in events if e[2] == 'institute' and 'commencement' in str(e[4]).lower()]
            if comm_events:
                start_date = comm_events[0][0]
            else:
                start_date = sem_start
                
        if not end_date:
            # try to find last working day
            last_events = [e for e in events if 'last' in str(e[4]).lower() and 'working' in str(e[4]).lower()]
            if last_events:
                end_date = last_events[0][0]
            else:
                end_date = sem_end
                
        today = datetime.now().date()
        sim_start = today if today > start_date else start_date
        sim_start = sim_start + timedelta(days=1) # start from tomorrow
        
        if sim_start > end_date:
            return "Simulation complete: No future days left in the semester to simulate."
            
        # 3. Fetch subjects and timetable
        cursor.execute('SELECT id, name, "targetAttendance" FROM subjects WHERE "semesterId" = %s', (semester_id,))
        subjects = cursor.fetchall()
        sub_map = {s[0]: {"name": s[1], "target": s[2] or 75, "total": 0, "attended": 0, "remaining": 0, "max_remaining": 0} for s in subjects}
        
        # Fetch current attendance
        cursor.execute('SELECT "subjectId", status FROM attendance WHERE "userId" = %s', (user_id,))
        logs = cursor.fetchall()
        for log in logs:
            sub_id = log[0]
            status = log[1]
            if sub_id in sub_map:
                if status in ['present', 'absent', 'medical', 'od']:
                    sub_map[sub_id]["total"] += 1
                if status in ['present', 'medical', 'od']:
                    sub_map[sub_id]["attended"] += 1
                    
        # Fetch timetable
        cursor.execute('SELECT "subjectId", "dayOfWeek" FROM timetable_slots WHERE "semesterId" = %s', (semester_id,))
        slots = cursor.fetchall()
        
        # Fetch overrides
        cursor.execute('SELECT "subjectId", date, "overrideType" FROM timetable_overrides WHERE "semesterId" = %s AND date >= %s', (semester_id, sim_start))
        overrides = cursor.fetchall()
        
        # 4. Simulate day by day
        curr = sim_start
        while curr <= end_date:
            # Check events for this day
            is_holiday = False
            is_restricted = False
            
            for e in events:
                e_start = e[0]
                e_end = e[1] if e[1] else e_start
                if e_start <= curr <= e_end:
                    if e[3] or e[2] in ['holiday', 'vacation', 'midsem', 'endsem', 'exam', 'lab_exam']:
                        is_holiday = True
                    if e[2] == 'restricted_holiday':
                        is_restricted = True
                        
            db_day_of_week = 6 if curr.weekday() == 6 else curr.weekday()
            
            if not is_holiday:
                for slot in slots:
                    if slot[1] == db_day_of_week:
                        sub_id = slot[0]
                        if sub_id in sub_map:
                            if is_restricted:
                                sub_map[sub_id]["max_remaining"] += 1
                            else:
                                sub_map[sub_id]["remaining"] += 1
                                sub_map[sub_id]["max_remaining"] += 1
            curr += timedelta(days=1)
            
        # Apply overrides
        for o in overrides:
            sub_id = o[0]
            o_type = o[2]
            if sub_id in sub_map:
                if o_type == 'extra_class':
                    sub_map[sub_id]["remaining"] += 1
                    sub_map[sub_id]["max_remaining"] += 1
                elif o_type in ['cancelled', 'holiday']:
                    sub_map[sub_id]["remaining"] = max(0, sub_map[sub_id]["remaining"] - 1)
                    sub_map[sub_id]["max_remaining"] = max(0, sub_map[sub_id]["max_remaining"] - 1)
                    
        # Build report
        report = []
        report.append(f"Simulation Context: From {sim_start} to {end_date}.")
        for sub_id, data in sub_map.items():
            rem = data["remaining"]
            max_rem = data["max_remaining"]
            tot = data["total"]
            att = data["attended"]
            target = data["target"]
            
            final_tot = tot + rem - skip_count
            final_att = att + rem - skip_count
            final_pct = (final_att / final_tot * 100) if final_tot > 0 else 0
            
            range_str = f"{rem}" if rem == max_rem else f"{rem}-{max_rem}"
            report.append(f"Subject: {data['name']} | Remaining Classes: {range_str} | With {skip_count} skips: Final % = {final_pct:.1f}% (Target: {target}%)")
            
        return "\n".join(report)
        
    except Exception as e:
        return f"Simulation failed: {str(e)}"
