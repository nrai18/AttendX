import os
import re
from typing import Annotated, List, Dict, Any, Optional
from typing_extensions import TypedDict
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from google import genai
from vector_store import vector_store

# Set up the Typed State definition with full student_context
class ChatState(TypedDict):
    messages: Annotated[list, add_messages]
    standalone_query: str
    context: str
    citations: List[str]
    student_context: Optional[Dict[str, Any]]

def get_message_role(m: Any) -> str:
    if hasattr(m, "type"):
        return "user" if m.type == "human" else "assistant"
    if isinstance(m, dict):
        return m.get("role", "user")
    return "user"

def get_message_content(m: Any) -> str:
    if hasattr(m, "content"):
        return str(m.content)
    if isinstance(m, dict):
        return str(m.get("content", ""))
    return ""

def reformulate_query(state: ChatState):
    """
    Step 1 (History-Aware Question Reformulation):
    Takes chat history and the latest user query, reformulating any follow-up
    pronouns (e.g. 'it', 'this class', 'that goal') into a standalone searchable query.
    """
    messages = state.get("messages", [])
    if not messages:
        return {"standalone_query": ""}
        
    latest_user_message = get_message_content(messages[-1])
    
    # If there is no prior chat history, no reformulation needed
    if len(messages) <= 1:
        return {"standalone_query": latest_user_message}
    
    api_key = os.environ.get("GEMINI_API_KEY", "")
    client = genai.Client(api_key=api_key or "dummy")
    
    history_text = "\n".join([
        f"{get_message_role(m)}: {get_message_content(m)}" 
        for m in messages[:-1][-4:]
    ])
    
    reformulation_prompt = (
        "Given the following conversation history and a follow-up question from a student, "
        "reformulate the question into a standalone inquiry that can be understood "
        "without the prior conversation context. Do NOT answer the question, only reformulate it if needed, "
        "otherwise return it as-is.\n\n"
        f"Conversation History:\n{history_text}\n\n"
        f"Follow-up Question: {latest_user_message}\n\n"
        "Standalone Search Query:"
    )
    
    for model_name in ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash']:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=reformulation_prompt,
            )
            if response and response.text:
                standalone = response.text.strip()
                return {"standalone_query": standalone}
        except Exception:
            continue
        
    return {"standalone_query": latest_user_message}

def retrieve_ordinance_context(state: ChatState):
    """
    Step 2 (Pure Semantic Vector Retrieval):
    Retrieves the most semantically relevant ordinance clauses using gemini-embedding-2.
    """
    query = state.get("standalone_query") or get_message_content(state["messages"][-1])
    
    # Semantic search with gemini-embedding-2
    docs = vector_store.search(query, top_k=2)
    
    context_blocks = []
    citations = []
    
    for doc in docs:
        ref_header = f"[{doc.get('part', 'REGULATIONS')} - Section {doc.get('section', '')}: {doc.get('title', '')}]"
        context_blocks.append(f"{ref_header}\n{doc.get('text', '')}")
        citations.append(f"Section {doc.get('section', '')}")
        
    combined_context = "\n\n---\n\n".join(context_blocks)
    return {"context": combined_context, "citations": citations}

def generate_policy_response(state: ChatState):
    """
    Step 3 (Context-Grounded Answer Generation & Citation Precision):
    Synthesizes a precise response using gemini-3.6-flash, combining live in-app
    student telemetry (attendance logs, calendar events, courses, target goal) and retrieved ordinances.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    client = genai.Client(api_key=api_key or "dummy")
    
    context = state.get("context", "")
    retrieved_citations = state.get("citations", [])
    student_context = state.get("student_context")
    user_message = get_message_content(state["messages"][-1])
    standalone_query = state.get("standalone_query", user_message)
    
    # Build complete real-time in-app data block
    student_info_block = ""
    if student_context:
        overall = student_context.get("overall_percentage", 0)
        target = student_context.get("target_percentage", 75)
        attended = student_context.get("total_attended", 0)
        total = student_context.get("total_classes", 0)
        subjects = student_context.get("subjects", [])
        history_logs = student_context.get("history_logs", [])
        calendar_events = student_context.get("calendar_events", [])
        
        sub_lines = []
        for s in subjects:
            code = s.get('code', '')
            code_str = f" ({code})" if code else ""
            sub_lines.append(f"  * {s.get('name', 'Course')}{code_str}: {s.get('attended', 0)}/{s.get('total', 0)} attended ({s.get('percentage', 0)}%)")
        subs_text = "\n".join(sub_lines) if sub_lines else "No courses registered in AttendX yet."
        
        log_lines = []
        for log in history_logs:
            d_str = log.get('dateFormatted') or log.get('date') or 'Unknown Date'
            sub = log.get('subject', 'Class')
            status = log.get('status', 'UNMARKED')
            time_str = f" at {log.get('time')}" if log.get('time') else ""
            log_lines.append(f"  * {d_str}: {sub} -> {status}{time_str}")
        logs_text = "\n".join(log_lines[:150]) if log_lines else "No attendance session logs recorded yet."
        
        event_lines = []
        for ev in calendar_events:
            event_lines.append(f"  * {ev.get('date', '')}: {ev.get('title', 'Event')} [{ev.get('type', 'academic').upper()}]")
        events_text = "\n".join(event_lines[:50]) if event_lines else "No calendar events logged."

        student_info_block = f"""
LIVE REAL-TIME STUDENT TELEMETRY (FROM ATTENDX IN-APP DATABASE):
1. Overall Attendance & Goal:
- Current Overall Attendance: {overall}% ({attended}/{total} classes attended)
- Student Personal Target Goal Set in App: {target}%
- Mandatory Institute Minimum Threshold: 75% (Section 6.1)

2. Enrolled Courses:
{subs_text}

3. Date-Wise Class Attendance History Logs (Exact Sessions Logged):
{logs_text}

4. Academic Calendar Events & Holidays:
{events_text}
"""

    system_instruction = (
        "You are AttendX AI, the intelligent in-app academic companion and policy advisor for IIIT Una.\n"
        "You have direct real-time access to the student's live in-app database (attendance records, dates, courses, holidays, target goal) "
        "and the official IIIT Una Ordinances (IIITUGORD02).\n\n"
        "REASONING & ANSWERING PRINCIPLES:\n"
        "1. Personal In-App Questions (e.g. 'What is my goal?', 'On which date did I attend X class?', 'What are my subjects?', 'When is the next holiday?'):\n"
        "   - Use the LIVE REAL-TIME STUDENT TELEMETRY above to give direct, exact numbers, dates, and times.\n"
        "   - If the student asks about their 'target' or 'goal', answer with their 'Student Personal Target Goal Set in App' (e.g. 53% or 80%).\n"
        "2. Institute Regulation Questions (e.g. '9-day leave rule', '30% pass mark', 'N-2 mess rebate'):\n"
        "   - Answer based on the Official Ordinance Context and cite the specific Section number.\n"
        "3. Tone: Concise, direct, accurate. 2 to 4 crisp bullet points without introductory fluff. Under 80 words."
    )
    
    prompt = (
        f"{system_instruction}\n\n"
        f"{student_info_block}\n\n"
        f"Official Ordinance Context (IIITUGORD02):\n"
        f"{context}\n\n"
        f"Student Query: {user_message}\n"
        f"Standalone Contextualized Inquiry: {standalone_query}\n\n"
        f"Direct Response:"
    )
    
    answer_text = None
    for model_name in ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash']:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            if response and response.text:
                answer_text = response.text.strip()
                break
        except Exception as e:
            print(f"Model {model_name} generation error: {e}")
            continue

    if not answer_text:
        answer_text = (
            f"Relevant Information:\n\n"
            f"{context}"
        )
    
    # Filter citations: Only include sections that are actually mentioned or cited in the answer
    final_citations = []
    for cite in retrieved_citations:
        sec_num_match = re.search(r"Section\s+([0-9\.\-\s]+)", cite)
        if sec_num_match:
            sec_num = sec_num_match.group(1).strip()
            # If the specific section is explicitly mentioned in the generated text, keep it
            if f"Section {sec_num}" in answer_text or f"Section 6" in answer_text or sec_num in answer_text:
                if cite not in final_citations:
                    final_citations.append(cite)
        elif cite in answer_text:
            final_citations.append(cite)
            
    return {"messages": [{"role": "assistant", "content": answer_text}], "citations": final_citations}

# Construct the Multi-Node LangGraph RAG Workflow
graph_builder = StateGraph(ChatState)
graph_builder.add_node("reformulate", reformulate_query)
graph_builder.add_node("retrieve", retrieve_ordinance_context)
graph_builder.add_node("generate", generate_policy_response)

# Workflow edges: START -> reformulate -> retrieve -> generate -> END
graph_builder.add_edge(START, "reformulate")
graph_builder.add_edge("reformulate", "retrieve")
graph_builder.add_edge("retrieve", "generate")
graph_builder.add_edge("generate", END)

chatbot = graph_builder.compile()
