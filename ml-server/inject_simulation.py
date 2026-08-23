import re
from simulate_tool import simulate_semester_attendance_logic

def inject_simulation_if_needed(standalone_query, student_context):
    query_lower = standalone_query.lower()
    is_simulation = any(word in query_lower for word in ['simulate', 'forecast', 'expect', 'percentage if i', 'classes can i', 'total number of classes'])
    
    if is_simulation and student_context and student_context.get("active_semester_id") and student_context.get("user_id"):
        # extract skip count if mentioned
        skip_count = 0
        skip_match = re.search(r'skip\s*(\d+)', query_lower)
        if skip_match:
            skip_count = int(skip_match.group(1))
            
        sim_result = simulate_semester_attendance_logic(
            user_id=student_context.get("user_id"),
            semester_id=student_context.get("active_semester_id"),
            skip_count=skip_count
        )
        return f"\n[REAL-TIME FORECAST SIMULATOR RESULTS]:\n{sim_result}\n"
    return ""
